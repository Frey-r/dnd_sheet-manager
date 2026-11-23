package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/foundry"
	"dnd-campaign-manager/internal/repository"
)

// FoundrySyncService performs the one-way Foundry -> app mirror sync.
// See openspec/specs/foundry-integration.md.
type FoundrySyncService struct {
	cfg        config.FoundryConfig
	client     *foundry.Client
	repo       *repository.FoundryRepository
	embeddings interface{ Vectorize(int64) error }
}

func NewFoundrySyncService(cfg config.FoundryConfig, client *foundry.Client, repo *repository.FoundryRepository, embeddings interface{ Vectorize(int64) error }) *FoundrySyncService {
	return &FoundrySyncService{cfg: cfg, client: client, repo: repo, embeddings: embeddings}
}

// Status returns the last recorded sync state for a campaign.
func (s *FoundrySyncService) Status(ctx context.Context, campaignID int64) (*domain.FoundrySyncState, error) {
	return s.repo.GetSyncState(ctx, campaignID)
}

// Health checks relay connectivity.
func (s *FoundrySyncService) Health(ctx context.Context) error {
	if !s.cfg.Enabled() {
		return fmt.Errorf("foundry integration not configured")
	}
	return s.client.Health(ctx)
}

// ErrorSeparator joins the individual sync errors in foundry_sync_state.error so
// the status endpoint can return them as an array.
const ErrorSeparator = "\n"

// SplitSyncErrors turns the stored error text back into the spec's errors array.
func SplitSyncErrors(stored string) []string {
	errs := []string{}
	for _, e := range strings.Split(stored, ErrorSeparator) {
		if e = strings.TrimSpace(e); e != "" {
			errs = append(errs, e)
		}
	}
	return errs
}

// Sync pulls all configured entity types from Foundry and upserts the mirror.
// gmUserID becomes the owner of mirrored character actors (Foundry has no app users).
//
// Each entity type (actors, scenes, journal, monsters) is fetched first and then
// written inside its own transaction: a failure while fetching or writing a type
// leaves that type's mirror untouched (rolled back) while the other types still
// sync, and every error is recorded in foundry_sync_state (resilience.md).
func (s *FoundrySyncService) Sync(ctx context.Context, campaignID, gmUserID int64) (domain.SyncCounts, error) {
	var counts domain.SyncCounts
	if !s.cfg.Enabled() {
		return counts, fmt.Errorf("foundry integration not configured")
	}
	if err := s.repo.BeginSync(ctx, campaignID); err != nil {
		return counts, err
	}

	var syncErrs []string
	type syncGroup struct {
		name string
		run  func(context.Context, int64, int64, *domain.SyncCounts) error
	}
	groups := []syncGroup{
		{"actors", s.syncActors},
		{"scenes", s.syncScenes},
		{"journal", s.syncJournal},
	}
	if s.cfg.SyncCompendium {
		groups = append(groups, syncGroup{"monsters", s.syncMonsters})
	}
	for _, g := range groups {
		var delta domain.SyncCounts
		if err := g.run(ctx, campaignID, gmUserID, &delta); err != nil {
			syncErrs = append(syncErrs, g.name+": "+err.Error())
			continue // delta is discarded: that type was not (or was rolled back, not) written
		}
		counts.Characters += delta.Characters
		counts.NPCs += delta.NPCs
		counts.Items += delta.Items
		counts.Scenes += delta.Scenes
		counts.Journal += delta.Journal
		counts.Monsters += delta.Monsters
	}

	status := "ok"
	errStr := ""
	if len(syncErrs) > 0 {
		status = "error"
		errStr = truncateText(strings.Join(syncErrs, ErrorSeparator), 4000)
	}
	// Record on a fresh context so a cancelled request still leaves a final state.
	recordCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.repo.FinishSync(recordCtx, campaignID, status, counts, errStr); err != nil {
		log.Printf("foundry sync: failed to record state: %v", err)
	}
	if status == "error" {
		return counts, fmt.Errorf("foundry sync completed with errors: %s", strings.Join(syncErrs, "; "))
	}
	return counts, nil
}

// fetchAll searches and loads every full document; any failure aborts the type
// so a partial view of Foundry is never written.
func (s *FoundrySyncService) fetchAll(ctx context.Context, opts foundry.SearchOpts) ([]*foundry.Document, error) {
	summaries, err := s.client.Search(ctx, opts)
	if err != nil {
		return nil, err
	}
	docs := make([]*foundry.Document, 0, len(summaries))
	for _, summary := range summaries {
		doc, err := s.client.Get(ctx, summary.UUID)
		if err != nil {
			return nil, fmt.Errorf("get %s: %w", summary.UUID, err)
		}
		docs = append(docs, doc)
	}
	return docs, nil
}

func (s *FoundrySyncService) syncActors(ctx context.Context, campaignID, gmUserID int64, out *domain.SyncCounts) error {
	docs, err := s.fetchAll(ctx, foundry.SearchOpts{DocumentType: "Actor", ExcludeCompendiums: true})
	if err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(tx *repository.FoundryRepository) error {
		*out = domain.SyncCounts{} // a retried/rolled back run must not double count
		if err := tx.MarkOrphans(ctx, campaignID, "actors"); err != nil {
			return err
		}
		for _, doc := range docs {
			switch doc.Type {
			case "character":
				ch := foundry.MapCharacter(doc, gmUserID, campaignID)
				charID, err := tx.UpsertCharacter(ctx, &ch)
				if err != nil {
					return fmt.Errorf("character %s: %w", doc.Name, err)
				}
				out.Characters++
				for i := range doc.Items {
					it := foundry.MapItem(&doc.Items[i], charID)
					if err := tx.UpsertItem(ctx, &it); err != nil {
						return fmt.Errorf("item %s: %w", it.Name, err)
					}
					out.Items++
				}
			case "npc":
				npc := foundry.MapNPC(doc, campaignID)
				if err := tx.UpsertNPC(ctx, &npc); err != nil {
					return fmt.Errorf("npc %s: %w", doc.Name, err)
				}
				out.NPCs++
			}
		}
		return nil
	})
}

func (s *FoundrySyncService) syncScenes(ctx context.Context, campaignID, _ int64, out *domain.SyncCounts) error {
	docs, err := s.fetchAll(ctx, foundry.SearchOpts{DocumentType: "Scene", ExcludeCompendiums: true})
	if err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(tx *repository.FoundryRepository) error {
		*out = domain.SyncCounts{}
		if err := tx.MarkOrphans(ctx, campaignID, "scenes"); err != nil {
			return err
		}
		for _, doc := range docs {
			m := foundry.MapScene(doc, campaignID)
			if err := tx.UpsertMap(ctx, &m); err != nil {
				return fmt.Errorf("map %s: %w", doc.Name, err)
			}
			out.Scenes++
		}
		return nil
	})
}

func (s *FoundrySyncService) syncJournal(ctx context.Context, campaignID, _ int64, out *domain.SyncCounts) error {
	docs, err := s.fetchAll(ctx, foundry.SearchOpts{DocumentType: "JournalEntry", ExcludeCompendiums: true})
	if err != nil {
		return err
	}
	tier := domain.LoreTier(s.cfg.DefaultLoreTier)
	if tier == "" {
		tier = domain.LoreTierCampaignPlot
	}
	var inserted []int64
	err = s.repo.InTx(ctx, func(tx *repository.FoundryRepository) error {
		*out = domain.SyncCounts{}
		inserted = inserted[:0]
		if err := tx.MarkOrphans(ctx, campaignID, "journal"); err != nil {
			return err
		}
		for _, doc := range docs {
			title, content := foundry.JournalText(doc)
			if content == "" {
				continue
			}
			uuid := doc.UUID
			entry := &domain.LoreEntry{CampaignID: campaignID, ContentText: content, LoreTier: tier, Title: title, FoundryUUID: &uuid}
			// New entries and entries whose text changed are (re-)embedded after the commit.
			id, needsEmbedding, err := tx.UpsertLore(ctx, entry)
			if err != nil {
				return fmt.Errorf("lore %s: %w", title, err)
			}
			out.Journal++
			if needsEmbedding {
				inserted = append(inserted, id)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	// Embeddings only after the commit, and never blocking on Ollama.
	for _, id := range inserted {
		s.enqueueEmbedding(id)
	}
	return nil
}

// syncMonsters mirrors compendium/world NPC actors into srd_monsters (is_srd=FALSE).
func (s *FoundrySyncService) syncMonsters(ctx context.Context, _, _ int64, out *domain.SyncCounts) error {
	docs, err := s.fetchAll(ctx, foundry.SearchOpts{DocumentType: "Actor", SubType: "npc"})
	if err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(tx *repository.FoundryRepository) error {
		*out = domain.SyncCounts{}
		for _, doc := range docs {
			m := foundry.ToSRDMonster(doc)
			if err := tx.UpsertMonster(ctx, &m); err != nil {
				return fmt.Errorf("monster %s: %w", doc.Name, err)
			}
			out.Monsters++
		}
		return nil
	})
}

func truncateText(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// syncReferenceType is the atomic unit of the reference sync: every document of
// one entity type is fetched first (any fetch failure aborts the type with nothing
// written) and then upserted inside a single transaction supplied by inTx, so a
// failing upsert rolls the whole type back (resilience.md). It returns the number
// of documents written, which is 0 whenever an error is returned.
func syncReferenceType[R any](
	ctx context.Context,
	fetch func(context.Context) ([]*foundry.Document, error),
	inTx func(context.Context, func(R) error) error,
	apply func(R, *foundry.Document) error,
) (int, error) {
	docs, err := fetch(ctx)
	if err != nil {
		return 0, err
	}
	written := 0
	err = inTx(ctx, func(tx R) error {
		written = 0 // a retried/rolled back run must not double count
		for _, d := range docs {
			if err := apply(tx, d); err != nil {
				return fmt.Errorf("%s: %w", d.Name, err)
			}
			written++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return written, nil
}

// recordReferenceResult folds a per-type result into the counts map and error list
// recorded in foundry_sync_state. A failed type contributes an error and no count.
func recordReferenceResult(counts map[string]int, errs *[]string, name string, n int, err error) {
	if err != nil {
		*errs = append(*errs, name+": "+err.Error())
		return
	}
	counts[name] += n
}

// SyncReference imports Foundry compendium reference data into the srd_* catalogs
// (Foundry-wins), keyed by foundry_uuid. See openspec/specs/foundry-integration.md.
// campaignID > 0 also records the outcome in foundry_sync_state for that campaign.
// Each reference type (spells, monsters, classes, subclasses, races, items) is
// written in its own transaction: if it fails it is rolled back and recorded as an
// error while the remaining types still sync.
func (s *FoundrySyncService) SyncReference(ctx context.Context, campaignID int64) (map[string]int, error) {
	if !s.cfg.Enabled() {
		return nil, fmt.Errorf("foundry integration not configured")
	}
	if campaignID > 0 {
		if err := s.repo.BeginSync(ctx, campaignID); err != nil {
			return nil, err
		}
	}
	counts := map[string]int{}
	var errs []string

	fetchOne := func(opts foundry.SearchOpts) func(context.Context) ([]*foundry.Document, error) {
		return func(ctx context.Context) ([]*foundry.Document, error) {
			return s.fetchAll(ctx, opts)
		}
	}
	run := func(name string, fetch func(context.Context) ([]*foundry.Document, error), apply func(*repository.FoundryRepository, *foundry.Document) error) {
		n, err := syncReferenceType(ctx, fetch, s.repo.InTx, apply)
		recordReferenceResult(counts, &errs, name, n, err)
	}

	run("spells", fetchOne(foundry.SearchOpts{DocumentType: "Item", SubType: "spell"}), func(tx *repository.FoundryRepository, d *foundry.Document) error {
		return tx.UpsertSRDSpell(ctx, foundry.ToSRDSpell(d), d.UUID, foundry.IsSRDDocument(d))
	})
	run("monsters", fetchOne(foundry.SearchOpts{DocumentType: "Actor", SubType: "npc"}), func(tx *repository.FoundryRepository, d *foundry.Document) error {
		return tx.UpsertSRDMonster(ctx, foundry.ToSRDMonster(d), foundry.IsSRDDocument(d))
	})
	run("classes", fetchOne(foundry.SearchOpts{DocumentType: "Item", SubType: "class"}), func(tx *repository.FoundryRepository, d *foundry.Document) error {
		return tx.UpsertSRDClass(ctx, foundry.ToSRDClass(d), d.UUID, foundry.IsSRDDocument(d))
	})
	run("subclasses", fetchOne(foundry.SearchOpts{DocumentType: "Item", SubType: "subclass"}), func(tx *repository.FoundryRepository, d *foundry.Document) error {
		return tx.UpsertSRDSubclass(ctx, foundry.ToSRDSubclass(d), foundry.IsSRDDocument(d))
	})
	run("races", fetchOne(foundry.SearchOpts{DocumentType: "Item", SubType: "race"}), func(tx *repository.FoundryRepository, d *foundry.Document) error {
		return tx.UpsertSRDRace(ctx, foundry.ToSRDRace(d), d.UUID, foundry.IsSRDDocument(d))
	})
	itemSubtypes := []string{"weapon", "equipment", "consumable", "tool", "loot", "container"}
	run("items", func(ctx context.Context) ([]*foundry.Document, error) {
		var all []*foundry.Document
		for _, sub := range itemSubtypes {
			docs, err := s.fetchAll(ctx, foundry.SearchOpts{DocumentType: "Item", SubType: sub})
			if err != nil {
				return nil, fmt.Errorf("%s: %w", sub, err)
			}
			all = append(all, docs...)
		}
		return all, nil
	}, func(tx *repository.FoundryRepository, d *foundry.Document) error {
		var probe struct {
			Rarity string `json:"rarity"`
		}
		_ = json.Unmarshal(d.System, &probe)
		if r := strings.ToLower(probe.Rarity); r != "" && r != "common" {
			return tx.UpsertSRDMagicItem(ctx, foundry.ToSRDMagicItem(d), d.UUID, foundry.IsSRDDocument(d))
		}
		return tx.UpsertSRDEquipment(ctx, foundry.ToSRDEquipment(d), d.UUID, foundry.IsSRDDocument(d))
	})

	status, stored := "ok", ""
	if len(errs) > 0 {
		status = "error"
		stored = truncateText(strings.Join(errs, ErrorSeparator), 4000)
	}
	if campaignID > 0 {
		recordCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := s.repo.FinishReference(recordCtx, campaignID, status, counts, stored); err != nil {
			log.Printf("foundry reference sync: failed to record state: %v", err)
		}
	}
	if len(errs) > 0 {
		return counts, fmt.Errorf("reference sync completed with errors: %s", truncateText(strings.Join(errs, "; "), 2000))
	}
	return counts, nil
}

// enqueueEmbedding vectorizes a freshly-imported lore entry without blocking the
// sync request (best-effort; failures are logged). See resilience.md.
func (s *FoundrySyncService) enqueueEmbedding(loreID int64) {
	if s.embeddings == nil {
		return
	}
	if err := s.embeddings.Vectorize(loreID); err != nil {
		log.Printf("foundry sync: embedding lore %d failed: %v", loreID, err)
	}
}

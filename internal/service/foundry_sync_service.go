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
	cfg    config.FoundryConfig
	client *foundry.Client
	repo   *repository.FoundryRepository
	ragSvc *RAGService // optional; used to enqueue lore embeddings
}

func NewFoundrySyncService(cfg config.FoundryConfig, client *foundry.Client, repo *repository.FoundryRepository, ragSvc *RAGService) *FoundrySyncService {
	return &FoundrySyncService{cfg: cfg, client: client, repo: repo, ragSvc: ragSvc}
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

// Sync pulls all configured entity types from Foundry and upserts the mirror.
// gmUserID becomes the owner of mirrored character actors (Foundry has no app users).
func (s *FoundrySyncService) Sync(ctx context.Context, campaignID, gmUserID int64) (domain.SyncCounts, error) {
	var counts domain.SyncCounts
	if !s.cfg.Enabled() {
		return counts, fmt.Errorf("foundry integration not configured")
	}

	if err := s.repo.BeginSync(ctx, campaignID); err != nil {
		return counts, err
	}
	if err := s.repo.MarkAllOrphan(ctx, campaignID); err != nil {
		s.fail(ctx, campaignID, counts, err)
		return counts, err
	}

	var syncErrs []string

	// ── Actors → characters / npcs (+ embedded items) ──
	actors, err := s.client.Search(ctx, foundry.SearchOpts{DocumentType: "Actor", ExcludeCompendiums: true})
	if err != nil {
		syncErrs = append(syncErrs, "actors: "+err.Error())
	}
	for _, summary := range actors {
		doc, err := s.client.Get(ctx, summary.UUID)
		if err != nil {
			syncErrs = append(syncErrs, "actor "+summary.UUID+": "+err.Error())
			continue
		}
		switch doc.Type {
		case "character":
			ch := foundry.MapCharacter(doc, gmUserID, campaignID)
			charID, err := s.repo.UpsertCharacter(ctx, &ch)
			if err != nil {
				syncErrs = append(syncErrs, "character "+doc.Name+": "+err.Error())
				continue
			}
			counts.Characters++
			for i := range doc.Items {
				it := foundry.MapItem(&doc.Items[i], charID)
				if err := s.repo.UpsertItem(ctx, &it); err != nil {
					syncErrs = append(syncErrs, "item "+it.Name+": "+err.Error())
					continue
				}
				counts.Items++
			}
		case "npc":
			npc := foundry.MapNPC(doc, campaignID)
			if err := s.repo.UpsertNPC(ctx, &npc); err != nil {
				syncErrs = append(syncErrs, "npc "+doc.Name+": "+err.Error())
				continue
			}
			counts.NPCs++
		}
	}

	// ── Scenes → maps ──
	scenes, err := s.client.Search(ctx, foundry.SearchOpts{DocumentType: "Scene", ExcludeCompendiums: true})
	if err != nil {
		syncErrs = append(syncErrs, "scenes: "+err.Error())
	}
	for _, summary := range scenes {
		doc, err := s.client.Get(ctx, summary.UUID)
		if err != nil {
			syncErrs = append(syncErrs, "scene "+summary.UUID+": "+err.Error())
			continue
		}
		m := foundry.MapScene(doc, campaignID)
		if err := s.repo.UpsertMap(ctx, &m); err != nil {
			syncErrs = append(syncErrs, "map "+doc.Name+": "+err.Error())
			continue
		}
		counts.Scenes++
	}

	// ── Journal entries → lore (+ enqueue embeddings) ──
	journal, err := s.client.Search(ctx, foundry.SearchOpts{DocumentType: "JournalEntry", ExcludeCompendiums: true})
	if err != nil {
		syncErrs = append(syncErrs, "journal: "+err.Error())
	}
	tier := domain.LoreTier(s.cfg.DefaultLoreTier)
	if tier == "" {
		tier = domain.LoreTierCampaignPlot
	}
	for _, summary := range journal {
		doc, err := s.client.Get(ctx, summary.UUID)
		if err != nil {
			syncErrs = append(syncErrs, "journal "+summary.UUID+": "+err.Error())
			continue
		}
		title, content := foundry.JournalText(doc)
		if content == "" {
			continue
		}
		uuid := doc.UUID
		entry := &domain.LoreEntry{
			CampaignID:  campaignID,
			ContentText: content,
			LoreTier:    tier,
			Title:       title,
			FoundryUUID: &uuid,
		}
		id, inserted, err := s.repo.UpsertLore(ctx, entry)
		if err != nil {
			syncErrs = append(syncErrs, "lore "+title+": "+err.Error())
			continue
		}
		counts.Journal++
		if inserted {
			s.enqueueEmbedding(id)
		}
	}

	status := "ok"
	errStr := ""
	if len(syncErrs) > 0 {
		status = "error"
		errStr = strings.Join(syncErrs, "; ")
		if len(errStr) > 2000 {
			errStr = errStr[:2000]
		}
	}
	if err := s.repo.FinishSync(ctx, campaignID, status, counts, errStr); err != nil {
		log.Printf("foundry sync: failed to record state: %v", err)
	}
	if status == "error" {
		return counts, fmt.Errorf("foundry sync completed with errors: %s", errStr)
	}
	return counts, nil
}

// SyncReference imports Foundry compendium reference data into the srd_* catalogs
// (Foundry-wins), keyed by foundry_uuid. See openspec/specs/foundry-integration.md.
func (s *FoundrySyncService) SyncReference(ctx context.Context) (map[string]int, error) {
	if !s.cfg.Enabled() {
		return nil, fmt.Errorf("foundry integration not configured")
	}
	counts := map[string]int{}
	var errs []string

	run := func(name string, opts foundry.SearchOpts, handle func(*foundry.Document) error) {
		docs, err := s.client.Search(ctx, opts)
		if err != nil {
			errs = append(errs, name+": "+err.Error())
			return
		}
		for _, summary := range docs {
			d, err := s.client.Get(ctx, summary.UUID)
			if err != nil {
				errs = append(errs, name+" "+summary.UUID+": "+err.Error())
				continue
			}
			if err := handle(d); err != nil {
				errs = append(errs, name+" "+d.Name+": "+err.Error())
				continue
			}
			counts[name]++
		}
	}

	run("spells", foundry.SearchOpts{DocumentType: "Item", SubType: "spell"}, func(d *foundry.Document) error {
		return s.repo.UpsertSRDSpell(ctx, foundry.ToSRDSpell(d), d.UUID, true)
	})
	run("monsters", foundry.SearchOpts{DocumentType: "Actor", SubType: "npc"}, func(d *foundry.Document) error {
		return s.repo.UpsertSRDMonster(ctx, foundry.ToSRDMonster(d), true)
	})
	run("classes", foundry.SearchOpts{DocumentType: "Item", SubType: "class"}, func(d *foundry.Document) error {
		return s.repo.UpsertSRDClass(ctx, foundry.ToSRDClass(d), d.UUID, true)
	})
	run("subclasses", foundry.SearchOpts{DocumentType: "Item", SubType: "subclass"}, func(d *foundry.Document) error {
		return s.repo.UpsertSRDSubclass(ctx, foundry.ToSRDSubclass(d), true)
	})
	run("races", foundry.SearchOpts{DocumentType: "Item", SubType: "race"}, func(d *foundry.Document) error {
		return s.repo.UpsertSRDRace(ctx, foundry.ToSRDRace(d), d.UUID, true)
	})
	for _, sub := range []string{"weapon", "equipment", "consumable", "tool", "loot", "container"} {
		run("items", foundry.SearchOpts{DocumentType: "Item", SubType: sub}, func(d *foundry.Document) error {
			var probe struct {
				Rarity string `json:"rarity"`
			}
			_ = json.Unmarshal(d.System, &probe)
			if r := strings.ToLower(probe.Rarity); r != "" && r != "common" {
				return s.repo.UpsertSRDMagicItem(ctx, foundry.ToSRDMagicItem(d), d.UUID, true)
			}
			return s.repo.UpsertSRDEquipment(ctx, foundry.ToSRDEquipment(d), d.UUID, true)
		})
	}

	if len(errs) > 0 {
		msg := strings.Join(errs, "; ")
		if len(msg) > 2000 {
			msg = msg[:2000]
		}
		return counts, fmt.Errorf("reference sync completed with errors: %s", msg)
	}
	return counts, nil
}

// enqueueEmbedding vectorizes a freshly-imported lore entry without blocking the
// sync request (best-effort; failures are logged). See resilience.md.
func (s *FoundrySyncService) enqueueEmbedding(loreID int64) {
	if s.ragSvc == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		if err := s.ragSvc.VectorizeLoreEntry(ctx, loreID); err != nil {
			log.Printf("foundry sync: embedding lore %d failed: %v", loreID, err)
		}
	}()
}

func (s *FoundrySyncService) fail(ctx context.Context, campaignID int64, counts domain.SyncCounts, err error) {
	_ = s.repo.FinishSync(ctx, campaignID, "error", counts, err.Error())
}

package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"dnd-campaign-manager/internal/domain"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// ErrNPCNotFound: the NPC does not exist in the campaign.
var ErrNPCNotFound = errors.New("npc not found")

// NPCRepository stores the campaign clock and the NPC sheets: agenda, combat, purse and items (npc-agenda.md).
type NPCRepository struct{ db *sqlx.DB }

func NewNPCRepository(db *sqlx.DB) *NPCRepository { return &NPCRepository{db: db} }

func npcNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNPCNotFound
	}
	return err
}

// Clock returns the campaign day, time of day and first weekday setting ("" = default).
func (r *NPCRepository) Clock(ctx context.Context, campaignID int64) (int, string, string, error) {
	var row struct {
		Day   int    `db:"game_day"`
		Time  string `db:"time_of_day"`
		First string `db:"first"`
	}
	err := r.db.GetContext(ctx, &row, `SELECT game_day, time_of_day, COALESCE(settings->>'first_weekday', '') AS first FROM campaigns WHERE id=$1`, campaignID)
	return row.Day, row.Time, row.First, npcNotFound(err)
}

// SetClock stores the clock; first (when not nil) goes into campaigns.settings.first_weekday.
func (r *NPCRepository) SetClock(ctx context.Context, campaignID int64, day int, tod string, first *string) error {
	var err error
	if first != nil {
		_, err = r.db.ExecContext(ctx, `UPDATE campaigns SET game_day=$2, time_of_day=$3,
			settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('first_weekday', $4::text) WHERE id=$1`, campaignID, day, tod, *first)
	} else {
		_, err = r.db.ExecContext(ctx, `UPDATE campaigns SET game_day=$2, time_of_day=$3 WHERE id=$1`, campaignID, day, tod)
	}
	return err
}

// NPCSheet is one campaign NPC with everything the sheet document carries.
type NPCSheet struct {
	ID         int64            `db:"id"`
	Name       string           `db:"name"`
	Role       string           `db:"role"`
	Status     string           `db:"status"`
	Race       string           `db:"race"`
	Class      string           `db:"class"`
	Combat     []byte           `db:"combat"`
	PurseCP    int64            `db:"purse_cp"`
	Agenda     domain.Agenda    `db:"agenda"`
	HPCurrent  *int             `db:"hp_current"`
	Appearance []byte           `db:"appearance"`
	ImageURL   string           `db:"image_url"`
	Items      []domain.NPCItem `db:"-"`
}

const npcSheetCols = `id, name, role, status, race, class, stats->'combat' AS combat, purse_cp, agenda, hp_current, appearance, image_url`

// Sheets lists the campaign NPCs (all, or the given ids), ordered by name, optionally with their items.
func (r *NPCRepository) Sheets(ctx context.Context, campaignID int64, ids []int64, withItems bool) ([]NPCSheet, error) {
	sheets := []NPCSheet{}
	q := `SELECT ` + npcSheetCols + ` FROM campaign_npcs WHERE campaign_id=$1`
	args := []any{campaignID}
	if len(ids) > 0 {
		q += ` AND id = ANY($2)`
		args = append(args, pq.Array(ids))
	}
	if err := r.db.SelectContext(ctx, &sheets, q+` ORDER BY name, id`, args...); err != nil {
		return nil, err
	}
	if !withItems || len(sheets) == 0 {
		return sheets, nil
	}
	items := []domain.NPCItem{}
	if err := r.db.SelectContext(ctx, &items, `SELECT i.* FROM npc_items i JOIN campaign_npcs n ON n.id = i.npc_id
		WHERE n.campaign_id=$1 ORDER BY i.location, i.name, i.id`, campaignID); err != nil {
		return nil, err
	}
	byNPC := map[int64]int{}
	for i := range sheets {
		byNPC[sheets[i].ID] = i
	}
	for _, it := range items {
		if i, ok := byNPC[it.NPCID]; ok {
			sheets[i].Items = append(sheets[i].Items, it)
		}
	}
	return sheets, nil
}

// Agenda returns one NPC's agenda.
func (r *NPCRepository) Agenda(ctx context.Context, campaignID, npcID int64) (domain.Agenda, error) {
	var a domain.Agenda
	err := r.db.GetContext(ctx, &a, `SELECT agenda FROM campaign_npcs WHERE campaign_id=$1 AND id=$2`, campaignID, npcID)
	return a, npcNotFound(err)
}

// SaveAgenda replaces one NPC's agenda.
func (r *NPCRepository) SaveAgenda(ctx context.Context, campaignID, npcID int64, a domain.Agenda) error {
	res, err := r.db.ExecContext(ctx, `UPDATE campaign_npcs SET agenda=$3, updated_at=NOW() WHERE campaign_id=$1 AND id=$2`, campaignID, npcID, a)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNPCNotFound
	}
	return nil
}

// SheetImport is what an import writes for one NPC; nil fields are left untouched.
type SheetImport struct {
	NPCID   int64
	PJ      *domain.NPCDocPJ
	Combat  *domain.NPCCombat
	PurseCP *int64           // set ⇔ the inventory section is present
	Items   []domain.NPCItem // replaces every item of the NPC when PurseCP is set
	Agenda  *domain.Agenda
}

// ImportSheets writes every NPC of an import in one transaction (all or nothing).
func (r *NPCRepository) ImportSheets(ctx context.Context, campaignID int64, plans []SheetImport) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	exec := func(q string, args ...any) {
		if err == nil {
			_, err = tx.ExecContext(ctx, q, args...)
		}
	}
	for _, p := range plans {
		if p.PJ != nil {
			exec(`UPDATE campaign_npcs SET role=$3, status=$4, race=$5, class=$6, updated_at=NOW() WHERE campaign_id=$1 AND id=$2`,
				campaignID, p.NPCID, p.PJ.Rol, p.PJ.Relacion, p.PJ.Raza, p.PJ.Clase)
		}
		if p.Combat != nil {
			b, _ := json.Marshal(p.Combat)
			exec(`UPDATE campaign_npcs SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{combat}', $3::jsonb), updated_at=NOW()
				WHERE campaign_id=$1 AND id=$2`, campaignID, p.NPCID, string(b))
		}
		if p.PurseCP != nil {
			exec(`UPDATE campaign_npcs SET purse_cp=$3, updated_at=NOW() WHERE campaign_id=$1 AND id=$2`, campaignID, p.NPCID, *p.PurseCP)
			exec(`DELETE FROM npc_items WHERE npc_id=$1`, p.NPCID)
			for _, it := range p.Items {
				exec(`INSERT INTO npc_items (npc_id, name, quantity, value_cp, description, location, source, equipped) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
					p.NPCID, it.Name, it.Quantity, it.ValueCP, it.Description, it.Location, it.Source, it.Equipped)
			}
		}
		if p.Agenda != nil {
			exec(`UPDATE campaign_npcs SET agenda=$3, updated_at=NOW() WHERE campaign_id=$1 AND id=$2`, campaignID, p.NPCID, *p.Agenda)
		}
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

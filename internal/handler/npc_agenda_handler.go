package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// maxSheetImportBytes bounds an import body (npc-agenda.md §2: 64 KB per agenda, a few dozen NPCs).
const maxSheetImportBytes = 4 << 20

// NPCAgendaHandler serves the game clock and the NPC sheets (openspec/specs/npc-agenda.md §6).
type NPCAgendaHandler struct{ svc *service.NPCAgenda }

func NewNPCAgendaHandler(svc *service.NPCAgenda) *NPCAgendaHandler {
	return &NPCAgendaHandler{svc: svc}
}

func (h *NPCAgendaHandler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/campaigns/:id/clock", h.Clock)
	g.PUT("/campaigns/:id/clock", h.SetClock)
	g.POST("/campaigns/:id/clock/apply", h.ApplyClock)
	g.GET("/campaigns/:id/npcs/:resource_id/agenda", h.Agenda)
	g.PUT("/campaigns/:id/npcs/:resource_id/agenda", h.SaveAgenda)
	g.GET("/campaigns/:id/npcs/:resource_id/agenda/resolve", h.Resolve)
	g.GET("/campaigns/:id/npcs/:resource_id/sheet", h.ExportOne)
	g.GET("/campaigns/:id/npc-sheets", h.ExportAll)
	g.POST("/campaigns/:id/npc-sheets/import", h.Import)
	g.GET("/campaigns/:id/npc-whereabouts", h.Whereabouts)
}

// fail is the single error mapping of these routes: safe 4xx messages, generic 500 with a log line.
func (h *NPCAgendaHandler) fail(c *gin.Context, err error, msg string) {
	var agendaErr service.AgendaError
	switch {
	case errors.As(err, &agendaErr):
		c.JSON(http.StatusBadRequest, gin.H{"error": "La agenda o la ficha tiene errores", "problems": agendaErr.Problems})
	case errors.Is(err, service.ErrInvalidClock):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrNPCNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	default:
		log.Printf("npc agenda: %s: %v", msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
	}
}

func (h *NPCAgendaHandler) Clock(c *gin.Context) {
	clock, err := h.svc.Clock(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "clock")
		return
	}
	c.JSON(http.StatusOK, clock)
}

// SetClock: {game_day, time_of_day} or {step}, optional first_weekday; answers the clock and what moved.
func (h *NPCAgendaHandler) SetClock(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	var in service.ClockChange
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	clock, summary, err := h.svc.ChangeClock(c.Request.Context(), parseID(c.Param("id")), in)
	if err != nil {
		h.fail(c, err, "set clock")
		return
	}
	c.JSON(http.StatusOK, gin.H{"clock": clock, "summary": summary})
}

// ApplyClock re-applies the agenda of the current time without moving the clock.
func (h *NPCAgendaHandler) ApplyClock(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	summary, err := h.svc.ApplyAgendas(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "apply agendas")
		return
	}
	c.JSON(http.StatusOK, gin.H{"summary": summary})
}

func (h *NPCAgendaHandler) Agenda(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	a, err := h.svc.Agenda(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")))
	if err != nil {
		h.fail(c, err, "agenda")
		return
	}
	if a == nil {
		a = domain.Agenda{}
	}
	c.JSON(http.StatusOK, a)
}

// SaveAgenda: PUT the entries (an array) or a sheet document with an "agenda" section.
func (h *NPCAgendaHandler) SaveAgenda(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
	var a domain.Agenda
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON no válido: " + safeJSONError(err)})
		return
	}
	if err := h.svc.SaveAgenda(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), a); err != nil {
		h.fail(c, err, "save agenda")
		return
	}
	h.Agenda(c)
}

// Resolve: ?dia=3&momento=tarde → the entry that applies (or null).
func (h *NPCAgendaHandler) Resolve(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	day, err := strconv.Atoi(c.Query("dia"))
	if err != nil || day < 1 || !service.ValidTimeOfDay(c.Query("momento")) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dia ≥ 1 y momento dia/tarde/noche"})
		return
	}
	e, ok, err := h.svc.Resolve(c.Request.Context(), parseID(c.Param("id")), parseID(c.Param("resource_id")), day, c.Query("momento"))
	if err != nil {
		h.fail(c, err, "resolve")
		return
	}
	if !ok {
		c.JSON(http.StatusOK, gin.H{"entry": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"entry": e})
}

func sectionsParam(c *gin.Context) []string {
	if s := strings.TrimSpace(c.Query("secciones")); s != "" {
		return strings.Split(s, ",")
	}
	return nil
}

func (h *NPCAgendaHandler) ExportOne(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	docs, err := h.svc.Export(c.Request.Context(), parseID(c.Param("id")), []int64{parseID(c.Param("resource_id"))}, sectionsParam(c))
	if err != nil {
		h.fail(c, err, "export sheet")
		return
	}
	if len(docs) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, docs[0])
}

func (h *NPCAgendaHandler) ExportAll(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	docs, err := h.svc.Export(c.Request.Context(), parseID(c.Param("id")), nil, sectionsParam(c))
	if err != nil {
		h.fail(c, err, "export sheets")
		return
	}
	c.JSON(http.StatusOK, docs)
}

// Import: an array of sheet documents (or a single one); ?dry_run=1 validates only, ?actualizar_datos=1 writes pj data.
func (h *NPCAgendaHandler) Import(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSheetImportBytes)
	raw, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "El archivo es demasiado grande"})
		return
	}
	docs, err := service.ParseNPCDocuments(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON no válido: " + safeJSONError(err)})
		return
	}
	report, err := h.svc.Import(c.Request.Context(), parseID(c.Param("id")), docs,
		service.ImportOptions{DryRun: c.Query("dry_run") == "1", UpdateData: c.Query("actualizar_datos") == "1"})
	if err != nil {
		h.fail(c, err, "import sheets")
		return
	}
	c.JSON(http.StatusOK, report)
}

// Whereabouts: every NPC with where it is now and what comes next (npc-agenda.md §5).
func (h *NPCAgendaHandler) Whereabouts(c *gin.Context) {
	if !middleware.IsGM(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "gm membership required"})
		return
	}
	w, err := h.svc.Whereabouts(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "whereabouts")
		return
	}
	c.JSON(http.StatusOK, w)
}

// safeJSONError keeps decoding messages short; they only describe the client's own document.
func safeJSONError(err error) string {
	msg := err.Error()
	if len(msg) > 200 {
		msg = msg[:200]
	}
	return msg
}

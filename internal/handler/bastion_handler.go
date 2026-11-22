package handler

import (
	"errors"
	"log"
	"net/http"

	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"

	"github.com/gin-gonic/gin"
)

// BastionHandler serves Bastions (openspec/specs/market-bastions.md §6–§7).
type BastionHandler struct {
	svc *service.Bastions
}

func NewBastionHandler(svc *service.Bastions) *BastionHandler { return &BastionHandler{svc: svc} }

func (h *BastionHandler) RegisterRoutes(g *gin.RouterGroup) {
	g.GET("/campaigns/:id/bastions", h.List)
	g.POST("/campaigns/:id/bastions", h.Found)
	g.POST("/campaigns/:id/bastions/turn", h.Turn)
	g.GET("/campaigns/:id/bastions/:bid", h.Get)
	g.PUT("/campaigns/:id/bastions/:bid", h.Update)
	g.POST("/campaigns/:id/bastions/:bid/facilities", h.AddFacility)
	g.DELETE("/campaigns/:id/bastion-facilities/:fid", h.DeleteFacility)
	g.PUT("/campaigns/:id/bastion-facilities/:fid/order", h.Order)
	g.POST("/campaigns/:id/bastions/:bid/sell", h.Sell)
	g.POST("/campaigns/:id/bastions/:bid/take", h.Take)
	g.GET("/campaigns/:id/bastion-catalog", h.Catalog)
	g.PUT("/campaigns/:id/bastion-catalog", h.SaveCatalog)
}

func (h *BastionHandler) fail(c *gin.Context, err error, msg string) {
	switch {
	case errors.Is(err, repository.ErrBastionNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
	case service.IsBastionUserError(err):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		log.Printf("bastion: %s: %v", msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
	}
}

func (h *BastionHandler) List(c *gin.Context) {
	out, err := h.svc.List(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c))
	if err != nil {
		h.fail(c, err, "no se pudieron cargar los bastiones")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) Get(c *gin.Context) {
	out, err := h.svc.Get(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("bid")))
	if err != nil {
		h.fail(c, err, "no se pudo cargar el bastión")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) Found(c *gin.Context) {
	var in service.FoundInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	out, err := h.svc.Found(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), in)
	if err != nil {
		h.fail(c, err, "no se pudo fundar el bastión")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) Update(c *gin.Context) {
	var in struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	out, err := h.svc.Rename(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("bid")), in.Name, in.Description)
	if err != nil {
		h.fail(c, err, "no se pudo guardar el bastión")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) AddFacility(c *gin.Context) {
	var in service.FacilityInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	out, err := h.svc.AddFacility(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("bid")), in)
	if err != nil {
		h.fail(c, err, "no se pudo añadir la instalación")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) DeleteFacility(c *gin.Context) {
	err := h.svc.RemoveFacility(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), middleware.IsGM(c), parseID(c.Param("fid")))
	if err != nil {
		h.fail(c, err, "no se pudo borrar la instalación")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *BastionHandler) Order(c *gin.Context) {
	var in service.OrderInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	out, err := h.svc.IssueOrder(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), parseID(c.Param("fid")), in)
	if err != nil {
		h.fail(c, err, "no se pudo dar la orden")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) Turn(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	out, err := h.svc.RunTurn(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "no se pudo ejecutar el turno")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) Sell(c *gin.Context) {
	var in service.SaleInput
	if err := c.ShouldBindJSON(&in); err != nil || in.WarehouseID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Falta el objeto del almacén"})
		return
	}
	out, err := h.svc.SellWarehouse(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), parseID(c.Param("bid")), in)
	if err != nil {
		h.fail(c, err, "no se pudo vender")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) Take(c *gin.Context) {
	var in service.SaleInput
	if err := c.ShouldBindJSON(&in); err != nil || in.WarehouseID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Falta el objeto del almacén"})
		return
	}
	msg, err := h.svc.TakeWarehouse(c.Request.Context(), parseID(c.Param("id")), middleware.GetUserID(c), parseID(c.Param("bid")), in)
	if err != nil {
		h.fail(c, err, "no se pudo mover al inventario")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": msg})
}

func (h *BastionHandler) Catalog(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	out, err := h.svc.Catalog(c.Request.Context(), parseID(c.Param("id")))
	if err != nil {
		h.fail(c, err, "no se pudo cargar el catálogo")
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *BastionHandler) SaveCatalog(c *gin.Context) {
	if !gmOnly(c) {
		return
	}
	var in service.CatalogPayload
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	out, err := h.svc.SaveCatalog(c.Request.Context(), parseID(c.Param("id")), &in)
	if err != nil {
		h.fail(c, err, "no se pudo guardar el catálogo")
		return
	}
	c.JSON(http.StatusOK, out)
}

package handler

import (
	"net/http"
	"strconv"

	"dnd-campaign-manager/internal/domain"
	"dnd-campaign-manager/internal/repository"

	"github.com/gin-gonic/gin"
)

type ContentHandler struct{ repo *repository.ContentRepository }

func NewContentHandler(repo *repository.ContentRepository) *ContentHandler {
	return &ContentHandler{repo: repo}
}
func (h *ContentHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/content", h.Search)
	group.GET("/content/categories", h.Categories)
	group.GET("/content/sources", h.Sources)
	group.GET("/content/:id", h.Get)
}
func (h *ContentHandler) Search(c *gin.Context) {
	var filters domain.ContentFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.repo.Search(c.Request.Context(), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not search content"})
		return
	}
	c.JSON(http.StatusOK, result)
}
func (h *ContentHandler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content id"})
		return
	}
	entity, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load content"})
		return
	}
	if entity == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "content not found"})
		return
	}
	c.JSON(http.StatusOK, entity)
}
func (h *ContentHandler) Categories(c *gin.Context) {
	items, err := h.repo.Categories(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load categories"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}
func (h *ContentHandler) Sources(c *gin.Context) {
	items, err := h.repo.Sources(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load sources"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

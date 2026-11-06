package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

const maxUploadBytes = 15 << 20

var imageExt = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}

// UploadHandler stores GM-provided images (maps, tokens) under the upload
// directory, served by the router at /uploads. See openspec/specs/vtt.md §2.
type UploadHandler struct{ dir string }

func NewUploadHandler(dir string) *UploadHandler { return &UploadHandler{dir: dir} }

func (h *UploadHandler) RegisterRoutes(g *gin.RouterGroup) {
	g.POST("/campaigns/:id/uploads", h.Upload)
}

func (h *UploadHandler) Upload(c *gin.Context) {
	if !requireGM(c) {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes+1<<20)
	header, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required (max 15 MB)"})
		return
	}
	if header.Size > maxUploadBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file exceeds 15 MB"})
		return
	}
	src, err := header.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read file"})
		return
	}
	defer src.Close()
	sniff := make([]byte, 512)
	n, _ := io.ReadFull(src, sniff)
	ext, ok := imageExt[http.DetectContentType(sniff[:n])]
	if !ok {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "only PNG, JPEG or WebP images are allowed"})
		return
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read file"})
		return
	}
	campaignDir := filepath.Join(h.dir, fmt.Sprintf("c%d", parseID(c.Param("id"))))
	if err := os.MkdirAll(campaignDir, 0o755); err != nil {
		log.Printf("upload: mkdir: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not store file"})
		return
	}
	rnd := make([]byte, 12)
	_, _ = rand.Read(rnd)
	name := hex.EncodeToString(rnd) + ext
	dst, err := os.Create(filepath.Join(campaignDir, name))
	if err != nil {
		log.Printf("upload: create: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not store file"})
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		log.Printf("upload: copy: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not store file"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"url": fmt.Sprintf("/uploads/c%d/%s", parseID(c.Param("id")), name)})
}

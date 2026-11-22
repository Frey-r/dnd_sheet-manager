package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"dnd-campaign-manager/internal/config"
	"dnd-campaign-manager/internal/foundry"
	"dnd-campaign-manager/internal/handler"
	"dnd-campaign-manager/internal/middleware"
	"dnd-campaign-manager/internal/pubsub"
	"dnd-campaign-manager/internal/realtime"
	"dnd-campaign-manager/internal/repository"
	"dnd-campaign-manager/internal/service"
	"dnd-campaign-manager/migrations"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func main() {
	cfg, err := config.Load(getenv("CONFIG_PATH", "config.yaml"))
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if cfg.IsPlaceholderSecret() {
		log.Fatalf("load config: jwt.secret is the example placeholder; set JWT_SECRET")
	}
	db, err := sqlx.Connect("postgres", cfg.Database.DSN)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetimeDuration())
	if err := migrations.Up(context.Background(), db.DB); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	redis := pubsub.NewRedisPubSub(cfg.Redis.Addr, cfg.Redis.DB)
	defer redis.Close()
	if err := redis.Ping(context.Background()); err != nil {
		log.Fatalf("connect redis: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	campaignRepo := repository.NewCampaignRepository(db)
	charRepo := repository.NewCharacterRepository(db)
	itemRepo := repository.NewItemRepository(db)
	msgRepo := repository.NewMessageRepository(db)
	tradeRepo := repository.NewTradeRepository(db)
	loreRepo := repository.NewLoreRepository(db)
	srdRepo := repository.NewSRDRepository(db)
	contentRepo := repository.NewContentRepository(db)
	foundryRepo := repository.NewFoundryRepository(db)
	resourceRepo := repository.NewCampaignResourceRepository(db)
	combatRepo := repository.NewCombatRepository(db)
	vttRepo := repository.NewVTTRepository(db)

	authSvc := service.NewAuthService(userRepo, cfg.JWT)
	campaignSvc := service.NewCampaignService(campaignRepo, userRepo)
	statRollRepo := repository.NewStatRollRepository(db)
	charSvc := service.NewCharacterService(charRepo, campaignRepo, itemRepo).WithStatRolls(statRollRepo).WithContent(contentRepo).WithCatalog(srdRepo)
	msgSvc := service.NewMessageService(msgRepo, campaignRepo, userRepo)
	tradeSvc := service.NewTradeService(tradeRepo, charRepo, itemRepo, campaignRepo)
	srdSvc := service.NewSRDService(srdRepo)
	ragSvc := service.NewRAGService(cfg.Ollama, loreRepo, charRepo)
	foundryClient := foundry.New(cfg.Foundry)
	lorePool := service.NewLoreWorkerPool(ragSvc, cfg.Worker)
	defer lorePool.Close()
	foundrySync := service.NewFoundrySyncService(cfg.Foundry, foundryClient, foundryRepo, lorePool)

	authHandler := handler.NewAuthHandler(authSvc)
	campaignHandler := handler.NewCampaignHandler(campaignSvc, charSvc, itemRepo, tradeSvc)
	charHandler := handler.NewCharacterHandler(charSvc, campaignSvc)
	msgHandler := handler.NewMessageHandler(msgSvc, campaignSvc)
	tradeHandler := handler.NewTradeHandler(tradeSvc, charSvc)
	srdHandler := handler.NewSRDHandler(srdSvc)
	contentHandler := handler.NewContentHandler(contentRepo)
	foundryHandler := handler.NewFoundryHandler(foundrySync, campaignSvc).WithSyncLimit(cfg.RateLimit.FoundrySyncPerMinute)
	loreHandler := handler.NewLoreHandler(loreRepo, charRepo, lorePool)
	realtimeHub := realtime.NewHub(db, redis, authSvc, campaignSvc, cfg.Server.AllowedOrigins)
	realtimeHub.Configure(cfg.RateLimit, middleware.NewIPBlacklist())
	msgHandler.WithPresence(realtimeHub)
	middleware.SetAuditCapacity(cfg.RateLimit.AuditBufferSize)
	resourceHandler := handler.NewCampaignResourceHandler(resourceRepo).WithBotLLM(lorePool)
	combatHandler := handler.NewCombatHandler(combatRepo)
	vttPlay := service.NewVTTPlay(vttRepo, realtimeHub)
	realtimeHub.On("vtt.move", vttPlay.HandleMove)
	timerCtx, stopTimers := context.WithCancel(context.Background())
	defer stopTimers()
	go vttPlay.RunTimers(timerCtx)
	go func() {
		t := time.NewTicker(time.Minute)
		defer t.Stop()
		for {
			select {
			case <-timerCtx.Done():
				return
			case <-t.C:
				if err := tradeSvc.ExpireStaleTrades(timerCtx); err != nil {
					log.Printf("trade expiry: %v", err)
				}
			}
		}
	}()
	vttHandler := handler.NewVTTHandler(vttRepo, realtimeHub, vttPlay)
	uploadHandler := handler.NewUploadHandler(cfg.Server.UploadDir)
	marketRepo := repository.NewMarketRepository(db)
	marketHandler := handler.NewMarketHandler(marketRepo, service.NewMarket(marketRepo, vttRepo))
	bastionHandler := handler.NewBastionHandler(service.NewBastions(repository.NewBastionRepository(db)))
	rateLimiter := middleware.NewRateLimiter(cfg.RateLimit.RequestsPerMinute).WithBursts(cfg.RateLimit.Burst)

	r := gin.New()
	// Without this gin trusts every X-Forwarded-For, letting clients spoof the IP used by
	// rate limits, the WebSocket ban and the audit log.
	if err := r.SetTrustedProxies(cfg.Server.TrustedProxies); err != nil {
		log.Fatalf("server.trusted_proxies: %v", err)
	}
	r.Use(gin.Recovery(), gin.Logger(), corsMiddleware(cfg.Server.AllowedOrigins), securityHeaders(frameAncestorsFor(cfg)), middleware.AuditLogger())
	r.GET("/health", func(c *gin.Context) {
		if err := db.PingContext(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "database": "error"})
			return
		}
		if err := redis.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "redis": "error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/ws", realtimeHub.Handle)

	api := r.Group("/api")
	authIPLimit := middleware.AuthIPRateLimit(rateLimiter)
	api.POST("/auth/login", authIPLimit, authHandler.Login)
	api.POST("/auth/register", authIPLimit, authHandler.Register)
	api.POST("/auth/refresh", authIPLimit, authHandler.Refresh)
	api.POST("/auth/logout", authIPLimit, authHandler.Logout)
	auth := api.Group("")
	auth.Use(middleware.AuthMiddleware(authSvc), middleware.RBACMiddleware(campaignSvc), middleware.CharacterAuthorizationMiddleware(charSvc), middleware.RateLimitMiddleware(rateLimiter), realtimeHub.Middleware())
	{
		auth.GET("/auth/me", authHandler.Me)
		auth.PUT("/auth/profile", authHandler.UpdateProfile)
		auth.POST("/auth/password", authHandler.ChangePassword)
		auth.POST("/auth/2fa/setup", authHandler.SetupTOTP)
		auth.POST("/auth/2fa/enable", authHandler.EnableTOTP)
		auth.POST("/auth/2fa/disable", authHandler.DisableTOTP)
		auth.GET("/campaigns", campaignHandler.List)
		auth.POST("/campaigns", campaignHandler.Create)
		auth.GET("/campaigns/:id", campaignHandler.Get)
		auth.PUT("/campaigns/:id", campaignHandler.Update)
		auth.DELETE("/campaigns/:id", campaignHandler.Delete)
		auth.POST("/campaigns/:id/join", campaignHandler.Join)
		auth.GET("/campaigns/:id/members", campaignHandler.GetMembers)
		auth.GET("/campaigns/:id/sync", realtimeHub.Sync)
		auth.GET("/campaigns/:id/characters", campaignHandler.GetCharacters)
		auth.GET("/campaigns/:id/characters/:character_id/tradeable-items", campaignHandler.TradeableItems)
		// Market: shops replace the old single marketplace list (openspec/specs/market-bastions.md).
		auth.GET("/campaigns/:id/messages", msgHandler.GetConversations)
		auth.GET("/campaigns/:id/messages/:user_id", msgHandler.GetConversation)
		auth.POST("/campaigns/:id/messages", msgHandler.SendMessage)
		auth.GET("/campaigns/:id/presence", msgHandler.Presence)
		auth.POST("/messages/mark-read", msgHandler.MarkAsRead)
		auth.POST("/characters", charHandler.Create)
		auth.GET("/characters/:id", charHandler.Get)
		auth.PUT("/characters/:id", charHandler.Update)
		auth.PUT("/characters/:id/hp", charHandler.UpdateHP)
		auth.PUT("/characters/:id/appearance", charHandler.UpdateAppearance)
		auth.POST("/characters/:id/long-rest", charHandler.LongRest)
		auth.GET("/characters/:id/inventory", charHandler.GetInventory)
		auth.POST("/characters/:id/inventory", charHandler.AddItem)
		auth.PUT("/characters/:id/inventory/:itemId", charHandler.UpdateItem)
		auth.DELETE("/characters/:id/inventory/:itemId", charHandler.RemoveItem)
		auth.PUT("/characters/:id/inventory/:itemId/equip", charHandler.EquipItem)
		auth.GET("/characters/:id/spells", charHandler.GetSpells)
		auth.POST("/characters/:id/spells", charHandler.AddSpell)
		auth.GET("/characters/:id/spell-slots", charHandler.GetSpellSlots)
		auth.PUT("/characters/:id/spell-slots/:level", charHandler.SetSpellSlotTotal)
		auth.POST("/characters/:id/spells/:spellId/cast", charHandler.CastSpell)
		auth.GET("/characters/:id/features", charHandler.GetFeatures)
		auth.POST("/characters/:id/trades", tradeHandler.CreateOffer)
		auth.PUT("/trades/:id/accept", tradeHandler.AcceptTrade)
		auth.PUT("/trades/:id/reject", tradeHandler.RejectTrade)
		auth.PUT("/trades/:id/cancel", tradeHandler.CancelTrade)
		auth.GET("/trades", tradeHandler.List)
		auth.POST("/trades/:id/counter", tradeHandler.CounterOffer)
		srdHandler.RegisterRoutes(auth)
		contentHandler.RegisterRoutes(auth)
		resourceHandler.RegisterRoutes(auth)
		loreHandler.RegisterRoutes(auth)
		auth.GET("/campaigns/:id/combat", combatHandler.State)
		auth.POST("/campaigns/:id/combat/combatants", combatHandler.Add)
		auth.POST("/campaigns/:id/combat/encounter", combatHandler.AddEncounter)
		auth.DELETE("/campaigns/:id/combat/combatants/:combatant_id", combatHandler.Remove)
		auth.PUT("/campaigns/:id/combat/combatants/:combatant_id/hp", combatHandler.UpdateHP)
		auth.POST("/campaigns/:id/combat/next-turn", combatHandler.Next)
		auth.POST("/campaigns/:id/combat/reset", combatHandler.Reset)
		foundryHandler.RegisterRoutes(auth)
		vttHandler.RegisterRoutes(auth)
		uploadHandler.RegisterRoutes(auth)
		marketHandler.RegisterRoutes(auth)
		bastionHandler.RegisterRoutes(auth)
		handler.NewStatRollHandler(statRollRepo).RegisterRoutes(auth)
	}

	r.Static("/uploads", cfg.Server.UploadDir)
	r.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet || strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
			return
		}
		// Static asset of the built SPA (JS, CSS, images): serve it if it exists inside dist.
		if clean := filepath.Clean("/" + c.Request.URL.Path); clean != "/" {
			file := filepath.Join(cfg.Server.FrontendDist, filepath.FromSlash(clean))
			if info, err := os.Stat(file); err == nil && !info.IsDir() {
				if strings.HasPrefix(clean, "/assets/") {
					c.Header("Cache-Control", "public, max-age=31536000, immutable")
				}
				c.File(file)
				return
			}
		}
		index := filepath.Join(cfg.Server.FrontendDist, "index.html")
		c.Header("Cache-Control", "no-cache")
		if _, err := os.Stat(index); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "frontend build not found"})
			return
		}
		c.File(index)
	})

	srv := &http.Server{
		Addr:              cfg.Server.Address(),
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		log.Printf("server listening on %s", cfg.Server.Address())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	// Graceful shutdown (resilience.md): refuse new sockets and close every open
	// WebSocket with 1001, drain in-flight HTTP requests, then close Redis.
	realtimeHub.Shutdown()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	stopTimers()
	redis.Close()
	log.Printf("shutdown complete")
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func corsMiddleware(allowed []string) gin.HandlerFunc {
	origins := make(map[string]bool, len(allowed))
	for _, origin := range allowed {
		origins[strings.TrimSuffix(origin, "/")] = true
	}
	return func(c *gin.Context) {
		origin := strings.TrimSuffix(c.GetHeader("Origin"), "/")
		if origins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Max-Age", "600")
		}
		if c.Request.Method == http.MethodOptions {
			if origin != "" && !origins[origin] {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// frameAncestorsFor returns the extra origins allowed to frame the app. They are
// only honoured when Foundry is enabled (game_mode "foundry" deployments); wildcards
// are rejected at config load.
func frameAncestorsFor(cfg *config.Config) []string {
	if !cfg.Foundry.Enabled() {
		return nil
	}
	return cfg.Foundry.FrameAncestors
}

// frameAncestorsPolicy builds the CSP frame-ancestors directive: 'self' plus the
// configured origins, never a wildcard (security.md -> iframe / Cross-Origin).
func frameAncestorsPolicy(ancestors []string) string {
	policy := "frame-ancestors 'self'"
	for _, origin := range ancestors {
		if origin = strings.TrimSpace(origin); origin != "" && !strings.Contains(origin, "*") {
			policy += " " + origin
		}
	}
	return policy
}

func securityHeaders(frameAncestors []string) gin.HandlerFunc {
	csp := frameAncestorsPolicy(frameAncestors)
	// X-Frame-Options cannot list foreign origins and would block the Foundry
	// iframe, so it is sent only while no extra ancestor is configured.
	sameOriginOnly := len(frameAncestors) == 0
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		if sameOriginOnly {
			c.Header("X-Frame-Options", "SAMEORIGIN")
		}
		c.Header("Content-Security-Policy", csp)
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}

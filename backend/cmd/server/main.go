package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"magic_store/backend/internal/api"
	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	var dialector gorm.Dialector

	if strings.HasPrefix(dbURL, "postgres://") || strings.HasPrefix(dbURL, "postgresql://") {
		dialector = postgres.Open(dbURL)
	} else {
		if dbURL == "" {
			dbURL = "magic_store.db"
		}
		dialector = sqlite.Open(dbURL)
	}

	db, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err := db.AutoMigrate(
		&model.StoreSetting{},
		&model.Category{},
		&model.Product{},
		&model.ProductVariant{},
		&model.UomConversion{},
		&model.ModifierGroup{},
		&model.ModifierItem{},
		&model.ProductModifierGroup{},
		&model.InventoryBatch{},
		&model.InventoryMovement{},
		&model.BomRecipe{},
		&model.BomItem{},
		&model.ProductionOrder{},
		&model.Partner{},
		&model.PosSession{},
		&model.SalesOrder{},
		&model.SalesOrderItem{},
		&model.DebtLedger{},
		&model.CashbookTransaction{},
	); err != nil {
		log.Fatalf("failed to auto-migrate database: %v", err)
	}

	uomSvc := service.NewUOMService(db)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)

	srv := api.NewServer(db, uomSvc, ledgerSvc, bomSvc)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Magic Store API server listening on %s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
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
		&model.Warehouse{},
		&model.WarehouseStock{},
		&model.WarehouseStockBalance{},
		&model.StockTransfer{},
		&model.StockTransferItem{},
		&model.Unit{},
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

	// Ensure default warehouse exists
	var whCount int64
	db.Model(&model.Warehouse{}).Count(&whCount)
	if whCount == 0 {
		defaultWH := model.Warehouse{
			Code:      "KHO_TONG",
			Name:      "Kho Tổng (Mặc định)",
			Type:      model.WarehouseTypeStorage,
			Address:   "Trụ sở chính",
			IsActive:  true,
			IsDefault: true,
		}
		_ = db.Create(&defaultWH).Error
	}

	uomSvc := service.NewUOMService(db)
	ledgerSvc := service.NewInventoryLedgerService(db)
	bomSvc := service.NewBOMProductionService(db, ledgerSvc)

	minioEndpoint := os.Getenv("MINIO_ENDPOINT")
	if minioEndpoint == "" {
		minioEndpoint = "localhost:9000"
	}
	minioAccessKey := os.Getenv("MINIO_ACCESS_KEY")
	if minioAccessKey == "" {
		minioAccessKey = "minioadmin"
	}
	minioSecretKey := os.Getenv("MINIO_SECRET_KEY")
	if minioSecretKey == "" {
		minioSecretKey = "minioadmin"
	}
	minioBucket := os.Getenv("MINIO_BUCKET")
	if minioBucket == "" {
		minioBucket = "products"
	}
	minioPublicURL := os.Getenv("MINIO_PUBLIC_URL")
	if minioPublicURL == "" {
		minioPublicURL = fmt.Sprintf("http://%s", minioEndpoint)
	}

	storageSvc, err := service.NewStorageService(service.StorageConfig{
		Endpoint:   minioEndpoint,
		AccessKey:  minioAccessKey,
		SecretKey:  minioSecretKey,
		BucketName: minioBucket,
		UseSSL:     os.Getenv("MINIO_USE_SSL") == "true",
		PublicURL:  minioPublicURL,
	})
	if err != nil {
		log.Printf("warning: minio storage service failed to initialize: %v", err)
	}

	srv := api.NewServer(db, uomSvc, ledgerSvc, bomSvc, storageSvc)

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

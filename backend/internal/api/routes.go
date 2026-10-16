package api

import (
	"net/http"

	"gorm.io/gorm"

	"magic_store/backend/internal/service"
)

// Server coordinates domain services and handles HTTP routing for the ERP backend.
type Server struct {
	db             *gorm.DB
	uomService     *service.UOMService
	ledgerService  *service.InventoryLedgerService
	bomService     *service.BOMProductionService
	storageService *service.StorageService
	router         http.Handler
}

// NewServer initializes router, routes, CORS middleware, and domain services.
// ponytail: standard ServeMux router; upgrade to chi/gin if route params complexity increases.
func NewServer(
	db *gorm.DB,
	uomSvc *service.UOMService,
	ledgerSvc *service.InventoryLedgerService,
	bomSvc *service.BOMProductionService,
	storageSvc *service.StorageService,
) *Server {
	s := &Server{
		db:             db,
		uomService:     uomSvc,
		ledgerService:  ledgerSvc,
		bomService:     bomSvc,
		storageService: storageSvc,
	}

	mux := http.NewServeMux()

	// Settings & Presets
	mux.HandleFunc("GET /api/settings", s.handleGetSettings)
	mux.HandleFunc("PUT /api/settings", s.handleUpdateSettings)
	mux.HandleFunc("POST /api/settings/preset", s.handlePresetSettings)

	// Units
	mux.HandleFunc("GET /api/units", s.handleGetUnits)
	mux.HandleFunc("POST /api/units", s.handleCreateUnit)
	mux.HandleFunc("PUT /api/units/{id}", s.handleUpdateUnit)
	mux.HandleFunc("DELETE /api/units/{id}", s.handleDeleteUnit)

	// Catalog & Products
	mux.HandleFunc("GET /api/categories", s.handleGetCategories)
	mux.HandleFunc("POST /api/categories", s.handleCreateCategory)
	mux.HandleFunc("PUT /api/categories/{id}", s.handleUpdateCategory)
	mux.HandleFunc("DELETE /api/categories/{id}", s.handleDeleteCategory)
	mux.HandleFunc("GET /api/products", s.handleGetProducts)
	mux.HandleFunc("POST /api/products", s.handleCreateProduct)

	// Partners
	mux.HandleFunc("GET /api/partners", s.handleGetPartners)
	mux.HandleFunc("POST /api/partners", s.handleCreatePartner)
	mux.HandleFunc("PUT /api/partners/{id}", s.handleUpdatePartner)
	mux.HandleFunc("DELETE /api/partners/{id}", s.handleDeletePartner)

	// Inventory
	mux.HandleFunc("POST /api/inventory/purchase", s.handlePurchaseReceiving)
	mux.HandleFunc("POST /api/inventory/wastage", s.handleWastage)

	// Batches & Traceability
	mux.HandleFunc("GET /api/batches", s.handleGetBatches)
	mux.HandleFunc("GET /api/batches/{id}/trace", s.handleGetBatchTrace)
	mux.HandleFunc("PUT /api/batches/{id}", s.handleUpdateBatch)

	// BOM & Production
	mux.HandleFunc("GET /api/bom/recipes", s.handleGetBomRecipes)
	mux.HandleFunc("POST /api/bom/recipes", s.handleCreateBomRecipe)
	mux.HandleFunc("POST /api/production/assembly", s.handleAssembly)
	mux.HandleFunc("POST /api/production/disassembly", s.handleDisassembly)

	// POS Terminal
	mux.HandleFunc("POST /api/pos/checkout", s.handlePosCheckout)

	// Object Storage Uploads
	mux.HandleFunc("POST /api/upload/presigned-url", s.handleGetPresignedUploadURL)

	s.router = corsMiddleware(mux)
	return s
}

func (s *Server) DB() *gorm.DB {
	return s.db
}

func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

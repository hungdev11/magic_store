package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ----------------------------------------------------------------------------
// Settings & Preset Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	var setting model.StoreSetting
	if err := s.db.First(&setting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setting = model.StoreSetting{
				ID:             uuid.New().String(),
				Name:           "Cửa Hàng Mặc Định",
				Currency:       "VND",
				CostingMethod:  model.CostingMethodWAC,
				EnabledModules: `{}`,
			}
			if err := s.db.Create(&setting).Error; err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, setting)
}

type updateSettingsInput struct {
	Name           string              `json:"name"`
	Currency       string              `json:"currency"`
	CostingMethod  model.CostingMethod `json:"costing_method"`
	EnabledModules any                 `json:"enabled_modules"`
}

func (s *Server) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var input updateSettingsInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var setting model.StoreSetting
	if err := s.db.First(&setting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			setting = model.StoreSetting{
				ID: uuid.New().String(),
			}
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if input.Name != "" {
		setting.Name = input.Name
	}
	if input.Currency != "" {
		setting.Currency = input.Currency
	}
	if input.CostingMethod != "" {
		setting.CostingMethod = input.CostingMethod
	}
	if input.EnabledModules != nil {
		switch v := input.EnabledModules.(type) {
		case string:
			setting.EnabledModules = v
		default:
			bytes, err := json.Marshal(v)
			if err == nil {
				setting.EnabledModules = string(bytes)
			}
		}
	}

	if err := s.db.Save(&setting).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, setting)
}

type presetInput struct {
	Preset string `json:"preset"`
}

func (s *Server) handlePresetSettings(w http.ResponseWriter, r *http.Request) {
	var input presetInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var modules string
	switch strings.ToUpper(input.Preset) {
	case "SEAFOOD":
		modules = `{"catch_weight":true,"batch_expiry":true,"dynamic_pos_pricing":true}`
	case "APPAREL":
		modules = `{"matrix_variants":true,"credit_ledger":true}`
	case "FOOD":
		modules = `{"bom_production":true,"product_modifiers":true,"dynamic_pos_pricing":true}`
	default:
		writeError(w, http.StatusBadRequest, "unknown preset: "+input.Preset)
		return
	}

	var setting model.StoreSetting
	if err := s.db.First(&setting).Error; err != nil {
		setting = model.StoreSetting{
			ID:             uuid.New().String(),
			Name:           "Cửa Hàng",
			Currency:       "VND",
			CostingMethod:  model.CostingMethodWAC,
			EnabledModules: modules,
		}
		if err := s.db.Create(&setting).Error; err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		setting.EnabledModules = modules
		if err := s.db.Save(&setting).Error; err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, setting)
}

// ----------------------------------------------------------------------------
// Category Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetCategories(w http.ResponseWriter, r *http.Request) {
	var categories []model.Category
	if err := s.db.Find(&categories).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, categories)
}

func (s *Server) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	var cat model.Category
	if err := json.NewDecoder(r.Body).Decode(&cat); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if cat.ID == "" {
		cat.ID = uuid.New().String()
	}
	if err := s.db.Create(&cat).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, cat)
}

// ----------------------------------------------------------------------------
// Product Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetProducts(w http.ResponseWriter, r *http.Request) {
	var products []model.Product
	if err := s.db.Preload("Variants.UomConversions").Preload("Variants").Preload("Category").Find(&products).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, products)
}

type CreateUomConversionDTO struct {
	UomName            string           `json:"uom_name"`
	ConversionFactor   decimal.Decimal  `json:"conversion_factor"`
	IsVariableRatio    bool             `json:"is_variable_ratio"`
	DefaultPriceForUom *decimal.Decimal `json:"default_price_for_uom,omitempty"`
}

type CreateProductDTO struct {
	Name             string                   `json:"name"`
	Code             string                   `json:"code"`
	CategoryID       string                   `json:"category_id"`
	ProductType      model.ProductType        `json:"product_type"`
	BaseUom          string                   `json:"base_uom"`
	IsWeighable      bool                     `json:"is_weighable"`
	TrackInventory   *bool                    `json:"track_inventory"`
	TrackBatches     bool                     `json:"track_batches"`
	ProductionMode   model.ProductionMode     `json:"production_mode"`
	CostPrice        decimal.Decimal          `json:"cost_price"`
	BaseSellingPrice decimal.Decimal          `json:"base_selling_price"`
	MinSellingPrice  decimal.Decimal          `json:"min_selling_price"`
	MatrixAttributes map[string][]string      `json:"matrix_attributes"`
	UomConversions   []CreateUomConversionDTO `json:"uom_conversions"`
	Variants         []model.ProductVariant   `json:"variants"`
}

func (s *Server) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	var input CreateProductDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if input.ProductType == "" {
		input.ProductType = model.ProductTypeFinishedGood
	}
	if input.ProductionMode == "" {
		input.ProductionMode = model.ProductionModeNone
	}
	trackInv := true
	if input.TrackInventory != nil {
		trackInv = *input.TrackInventory
	}

	productID := uuid.New().String()
	product := model.Product{
		ID:             productID,
		Name:           input.Name,
		Code:           input.Code,
		CategoryID:     input.CategoryID,
		ProductType:    input.ProductType,
		BaseUom:        input.BaseUom,
		IsWeighable:    input.IsWeighable,
		TrackInventory: trackInv,
		TrackBatches:   input.TrackBatches,
		ProductionMode: input.ProductionMode,
	}

	if len(input.MatrixAttributes) > 0 {
		keys := make([]string, 0, len(input.MatrixAttributes))
		for k := range input.MatrixAttributes {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		combos := cartesianProduct(keys, input.MatrixAttributes)
		for _, combo := range combos {
			var parts []string
			for _, k := range keys {
				parts = append(parts, combo[k])
			}
			attrJSON, _ := json.Marshal(combo)
			vID := uuid.New().String()
			sku := fmt.Sprintf("%s_%s", input.Code, strings.Join(parts, "_"))
			varName := fmt.Sprintf("%s - %s", input.Name, strings.Join(parts, " - "))

			variant := model.ProductVariant{
				ID:               vID,
				ProductID:        productID,
				Sku:              sku,
				VariantName:      varName,
				Attributes:       string(attrJSON),
				CostPrice:        input.CostPrice,
				BaseSellingPrice: input.BaseSellingPrice,
				MinSellingPrice:  input.MinSellingPrice,
				CurrentStock:     decimal.Zero,
			}
			for _, uom := range input.UomConversions {
				variant.UomConversions = append(variant.UomConversions, model.UomConversion{
					ID:                 uuid.New().String(),
					VariantID:          vID,
					UomName:            uom.UomName,
					ConversionFactor:   uom.ConversionFactor,
					IsVariableRatio:    uom.IsVariableRatio,
					DefaultPriceForUom: uom.DefaultPriceForUom,
				})
			}
			product.Variants = append(product.Variants, variant)
		}
	} else if len(input.Variants) > 0 {
		for _, v := range input.Variants {
			if v.ID == "" {
				v.ID = uuid.New().String()
			}
			v.ProductID = productID
			if len(v.UomConversions) == 0 && len(input.UomConversions) > 0 {
				for _, uom := range input.UomConversions {
					v.UomConversions = append(v.UomConversions, model.UomConversion{
						ID:                 uuid.New().String(),
						VariantID:          v.ID,
						UomName:            uom.UomName,
						ConversionFactor:   uom.ConversionFactor,
						IsVariableRatio:    uom.IsVariableRatio,
						DefaultPriceForUom: uom.DefaultPriceForUom,
					})
				}
			}
			product.Variants = append(product.Variants, v)
		}
	} else {
		vID := uuid.New().String()
		variant := model.ProductVariant{
			ID:               vID,
			ProductID:        productID,
			Sku:              input.Code,
			VariantName:      input.Name,
			Attributes:       "{}",
			CostPrice:        input.CostPrice,
			BaseSellingPrice: input.BaseSellingPrice,
			MinSellingPrice:  input.MinSellingPrice,
			CurrentStock:     decimal.Zero,
		}
		for _, uom := range input.UomConversions {
			variant.UomConversions = append(variant.UomConversions, model.UomConversion{
				ID:                 uuid.New().String(),
				VariantID:          vID,
				UomName:            uom.UomName,
				ConversionFactor:   uom.ConversionFactor,
				IsVariableRatio:    uom.IsVariableRatio,
				DefaultPriceForUom: uom.DefaultPriceForUom,
			})
		}
		product.Variants = append(product.Variants, variant)
	}

	if err := s.db.Create(&product).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var created model.Product
	if err := s.db.Preload("Variants.UomConversions").Preload("Variants").Preload("Category").First(&created, "id = ?", product.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func cartesianProduct(keys []string, attrs map[string][]string) []map[string]string {
	if len(keys) == 0 {
		return nil
	}
	result := []map[string]string{{}}
	for _, key := range keys {
		vals := attrs[key]
		if len(vals) == 0 {
			continue
		}
		var next []map[string]string
		for _, r := range result {
			for _, val := range vals {
				combo := make(map[string]string, len(r)+1)
				for k, v := range r {
					combo[k] = v
				}
				combo[key] = val
				next = append(next, combo)
			}
		}
		result = next
	}
	return result
}

// ----------------------------------------------------------------------------
// Partner Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetPartners(w http.ResponseWriter, r *http.Request) {
	partnerType := r.URL.Query().Get("type")
	var partners []model.Partner
	query := s.db
	if partnerType != "" {
		query = query.Where("partner_type = ?", partnerType)
	}
	if err := query.Find(&partners).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, partners)
}

type CreatePartnerDTO struct {
	Name        string            `json:"name"`
	Phone       *string           `json:"phone,omitempty"`
	Address     *string           `json:"address,omitempty"`
	PartnerType model.PartnerType `json:"partner_type"`
}

func (s *Server) handleCreatePartner(w http.ResponseWriter, r *http.Request) {
	var input CreatePartnerDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if input.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if input.PartnerType == "" {
		input.PartnerType = model.PartnerTypeSupplier
	}
	p := model.Partner{
		Name:        input.Name,
		Phone:       input.Phone,
		Address:     input.Address,
		PartnerType: input.PartnerType,
	}
	if err := s.db.Create(&p).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

// ----------------------------------------------------------------------------
// Inventory Handlers
// ----------------------------------------------------------------------------

type PurchaseItemDTO struct {
	VariantID  string          `json:"variant_id"`
	Qty        decimal.Decimal `json:"qty"`
	UnitCost   decimal.Decimal `json:"unit_cost"`
	UOM        string          `json:"uom"`
	BatchCode  *string         `json:"batch_code"`
	ExpiryDate *time.Time      `json:"expiry_date"`
}

type PurchaseDTO struct {
	SupplierID  *string           `json:"supplier_id"`
	ReferenceID *string           `json:"reference_id"`
	Notes       *string           `json:"notes"`
	Items       []PurchaseItemDTO `json:"items"`
}

func (s *Server) handlePurchaseReceiving(w http.ResponseWriter, r *http.Request) {
	var input PurchaseDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range input.Items {
			// Calculate new WAC first before stock increment
			if _, err := s.ledgerService.CalculateNewWAC(r.Context(), tx, item.VariantID, item.Qty, item.UnitCost); err != nil {
				return err
			}

			var batchID *string
			if item.BatchCode != nil && *item.BatchCode != "" {
				batch := model.InventoryBatch{
					ID:           uuid.New().String(),
					VariantID:    item.VariantID,
					BatchCode:    *item.BatchCode,
					SupplierID:   input.SupplierID,
					ReceivedDate: time.Now(),
					ExpiryDate:   item.ExpiryDate,
					InitialQty:   item.Qty,
					RemainingQty: decimal.Zero,
					UnitCost:     item.UnitCost,
				}
				if err := tx.Create(&batch).Error; err != nil {
					return err
				}
				batchID = &batch.ID
			}

			if _, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
				VariantID:      item.VariantID,
				BatchID:        batchID,
				MovementType:   model.MovementTypePurchaseIn,
				QtyInBaseUom:   item.Qty,
				InputUOM:       item.UOM,
				InputQty:       item.Qty,
				UnitCostAtTime: item.UnitCost,
				ReferenceID:    input.ReferenceID,
				ReasonNote:     input.Notes,
			}); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"message": "purchase received successfully"})
}

type WastageDTO struct {
	VariantID        string          `json:"variant_id"`
	BatchID          *string         `json:"batch_id"`
	LostQty          decimal.Decimal `json:"lost_qty"`
	InputUOM         string          `json:"input_uom"`
	ReasonNote       string          `json:"reason_note"`
	RecordToCashbook bool            `json:"record_to_cashbook"`
	ReferenceID      *string         `json:"reference_id"`
}

func (s *Server) handleWastage(w http.ResponseWriter, r *http.Request) {
	var input WastageDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	mov, cashTx, err := s.bomService.RecordWastage(r.Context(), nil, service.WastageParams{
		VariantID:        input.VariantID,
		BatchID:          input.BatchID,
		LostQty:          input.LostQty,
		InputUOM:         input.InputUOM,
		ReasonNote:       input.ReasonNote,
		RecordToCashbook: input.RecordToCashbook,
		ReferenceID:      input.ReferenceID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"movement":             mov,
		"cashbook_transaction": cashTx,
	})
}

// ----------------------------------------------------------------------------
// BOM & Production Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetBomRecipes(w http.ResponseWriter, r *http.Request) {
	var recipes []model.BomRecipe
	if err := s.db.Preload("Items.ComponentVariant").Preload("TargetVariant").Find(&recipes).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, recipes)
}

type CreateBomItemDTO struct {
	ComponentVariantID    string          `json:"component_variant_id"`
	QtyRequired           decimal.Decimal `json:"qty_required"`
	CostAllocationPercent decimal.Decimal `json:"cost_allocation_percent"`
}

type CreateBomRecipeDTO struct {
	TargetVariantID        string             `json:"target_variant_id"`
	RecipeType             model.RecipeType   `json:"recipe_type"`
	OutputQty              decimal.Decimal    `json:"output_qty"`
	ExpectedWastagePercent decimal.Decimal    `json:"expected_wastage_percent"`
	Items                  []CreateBomItemDTO `json:"items"`
}

func (s *Server) handleCreateBomRecipe(w http.ResponseWriter, r *http.Request) {
	var input CreateBomRecipeDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	recipeID := uuid.New().String()
	recipe := model.BomRecipe{
		ID:                     recipeID,
		TargetVariantID:        input.TargetVariantID,
		RecipeType:             input.RecipeType,
		OutputQty:              input.OutputQty,
		ExpectedWastagePercent: input.ExpectedWastagePercent,
	}
	for _, item := range input.Items {
		recipe.Items = append(recipe.Items, model.BomItem{
			ID:                    uuid.New().String(),
			RecipeID:              recipeID,
			ComponentVariantID:    item.ComponentVariantID,
			QtyRequired:           item.QtyRequired,
			CostAllocationPercent: item.CostAllocationPercent,
		})
	}

	if err := s.db.Create(&recipe).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var created model.BomRecipe
	if err := s.db.Preload("Items.ComponentVariant").Preload("TargetVariant").First(&created, "id = ?", recipe.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

type AssemblyDTO struct {
	RecipeID        string          `json:"recipe_id"`
	TargetOutputQty decimal.Decimal `json:"target_output_qty"`
	BatchCode       *string         `json:"batch_code"`
	OtherCost       decimal.Decimal `json:"other_cost"`
	ExpiryDate      *time.Time      `json:"expiry_date"`
	SupplierID      *string         `json:"supplier_id"`
	Notes           *string         `json:"notes"`
}

func (s *Server) handleAssembly(w http.ResponseWriter, r *http.Request) {
	var input AssemblyDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	order, err := s.bomService.ExecuteAssembly(r.Context(), nil, service.AssemblyParams{
		RecipeID:        input.RecipeID,
		TargetOutputQty: input.TargetOutputQty,
		BatchCode:       input.BatchCode,
		OtherCost:       input.OtherCost,
		ExpiryDate:      input.ExpiryDate,
		SupplierID:      input.SupplierID,
		Notes:           input.Notes,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, order)
}

type DisassemblyYieldDTO struct {
	ComponentVariantID string          `json:"component_variant_id"`
	ActualQty          decimal.Decimal `json:"actual_qty"`
	BatchCode          *string         `json:"batch_code"`
	ExpiryDate         *time.Time      `json:"expiry_date"`
}

type DisassemblyDTO struct {
	RecipeID     string                `json:"recipe_id"`
	InputQty     decimal.Decimal       `json:"input_qty"`
	YieldOutputs []DisassemblyYieldDTO `json:"yield_outputs"`
	BatchCode    *string               `json:"batch_code"`
	OtherCost    decimal.Decimal       `json:"other_cost"`
	Notes        *string               `json:"notes"`
}

func (s *Server) handleDisassembly(w http.ResponseWriter, r *http.Request) {
	var input DisassemblyDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var yieldOutputs []service.DisassemblyYieldOutput
	for _, yo := range input.YieldOutputs {
		yieldOutputs = append(yieldOutputs, service.DisassemblyYieldOutput{
			ComponentVariantID: yo.ComponentVariantID,
			ActualQty:          yo.ActualQty,
			BatchCode:          yo.BatchCode,
			ExpiryDate:         yo.ExpiryDate,
		})
	}

	order, err := s.bomService.ExecuteDisassembly(r.Context(), nil, service.DisassemblyParams{
		RecipeID:     input.RecipeID,
		InputQty:     input.InputQty,
		YieldOutputs: yieldOutputs,
		BatchCode:    input.BatchCode,
		OtherCost:    input.OtherCost,
		Notes:        input.Notes,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, order)
}

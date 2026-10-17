package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
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

func slugifyVietnamese(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	var sb strings.Builder
	for _, r := range strings.ToLower(s) {
		switch r {
		case 'à', 'á', 'ả', 'ã', 'ạ', 'ă', 'ằ', 'ắ', 'ẳ', 'ẵ', 'ặ', 'â', 'ầ', 'ấ', 'ẩ', 'ẫ', 'ậ':
			sb.WriteRune('a')
		case 'đ':
			sb.WriteRune('d')
		case 'è', 'é', 'ẻ', 'ẽ', 'ẹ', 'ê', 'ề', 'ế', 'ể', 'ễ', 'ệ':
			sb.WriteRune('e')
		case 'ì', 'í', 'ỉ', 'ĩ', 'ị':
			sb.WriteRune('i')
		case 'ò', 'ó', 'ỏ', 'õ', 'ọ', 'ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ', 'ơ', 'ờ', 'ớ', 'ở', 'ỡ', 'ợ':
			sb.WriteRune('o')
		case 'ù', 'ú', 'ủ', 'ũ', 'ụ', 'ư', 'ừ', 'ứ', 'ử', 'ữ', 'ự':
			sb.WriteRune('u')
		case 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ':
			sb.WriteRune('y')
		default:
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				sb.WriteRune(r)
			} else if r == ' ' || r == '-' || r == '_' || r == '/' {
				sb.WriteRune('_')
			}
		}
	}
	raw := sb.String()
	for strings.Contains(raw, "__") {
		raw = strings.ReplaceAll(raw, "__", "_")
	}
	raw = strings.Trim(raw, "_")
	return strings.ToUpper(raw)
}

var defaultUnits = []model.Unit{
	{Code: "KG", Name: "Kilogram", Description: "Đơn vị đo khối lượng"},
	{Code: "G", Name: "Gram", Description: "Đơn vị đo khối lượng nhỏ"},
	{Code: "LIT", Name: "Lít", Description: "Đơn vị đo thể tích chất lỏng"},
	{Code: "ML", Name: "Mililit", Description: "Đơn vị đo thể tích nhỏ"},
	{Code: "CAI", Name: "Cái", Description: "Đơn vị đếm chiếc, cái"},
	{Code: "HOP", Name: "Hộp", Description: "Đơn vị đóng hộp"},
	{Code: "THUNG", Name: "Thùng", Description: "Đơn vị đóng thùng carton/két"},
	{Code: "LON", Name: "Lon", Description: "Đơn vị đóng lon nhôm/kim loại"},
	{Code: "CHAI", Name: "Chai", Description: "Đơn vị đóng chai thủy tinh/nhựa"},
	{Code: "TUI", Name: "Túi", Description: "Đơn vị đóng túi nilong/zipper"},
	{Code: "BAO", Name: "Bao", Description: "Đơn vị đóng bao tải 25kg/50kg"},
	{Code: "GOI", Name: "Gói", Description: "Đơn vị gói nhỏ"},
	{Code: "DON", Name: "Đòn", Description: "Đơn vị đòn chả/bánh"},
	{Code: "CON", Name: "Con", Description: "Đơn vị đếm cá, gia súc, gia cầm"},
	{Code: "KHAY", Name: "Khay", Description: "Đơn vị đóng khay thực phẩm"},
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
		modules = `{"catch_weight":true,"batch_expiry":true,"bom_production":true,"dynamic_pos_pricing":true}`
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
// Unit Handlers
// ----------------------------------------------------------------------------

type unitInput struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    *bool  `json:"is_active"`
}

func (s *Server) handleGetUnits(w http.ResponseWriter, r *http.Request) {
	var count int64
	s.db.Model(&model.Unit{}).Count(&count)
	if count == 0 {
		for _, u := range defaultUnits {
			u.ID = uuid.New().String()
			u.IsActive = true
			_ = s.db.Create(&u).Error
		}
	}

	query := s.db.Model(&model.Unit{})
	if r.URL.Query().Get("active_only") == "true" || r.URL.Query().Get("active_only") == "1" {
		query = query.Where("is_active = ?", true)
	}

	var units []model.Unit
	if err := query.Order("code asc").Find(&units).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, units)
}

func (s *Server) handleCreateUnit(w http.ResponseWriter, r *http.Request) {
	var input unitInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	code := strings.ToUpper(strings.TrimSpace(input.Code))
	if code == "" {
		code = slugifyVietnamese(name)
		if code == "" {
			code = "UOM_" + uuid.New().String()[:8]
		}
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	unit := model.Unit{
		ID:          uuid.New().String(),
		Code:        code,
		Name:        name,
		Description: strings.TrimSpace(input.Description),
		IsActive:    isActive,
	}

	if err := s.db.Create(&unit).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, unit)
}

func (s *Server) handleUpdateUnit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "unit id is required")
		return
	}

	var unit model.Unit
	if err := s.db.First(&unit, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "unit not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var input unitInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if trimmedCode := strings.ToUpper(strings.TrimSpace(input.Code)); trimmedCode != "" {
		unit.Code = trimmedCode
	}
	if trimmedName := strings.TrimSpace(input.Name); trimmedName != "" {
		unit.Name = trimmedName
	}
	if input.Description != "" {
		unit.Description = strings.TrimSpace(input.Description)
	}
	if input.IsActive != nil {
		unit.IsActive = *input.IsActive
	}

	if err := s.db.Save(&unit).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, unit)
}

func (s *Server) handleDeleteUnit(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "unit id is required")
		return
	}

	var unit model.Unit
	if err := s.db.First(&unit, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "unit not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// ponytail: manual referential check on code; upgrade to schema FK constraints when DB migration strategy stabilizes.
	var prodCount int64
	if err := s.db.Model(&model.Product{}).Where("base_uom = ?", unit.Code).Count(&prodCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var convCount int64
	if err := s.db.Model(&model.UomConversion{}).Where("uom_name = ?", unit.Code).Count(&convCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if prodCount > 0 || convCount > 0 {
		writeError(w, http.StatusConflict, "Đơn vị đang được sử dụng ở sản phẩm hoặc bảng quy đổi, không thể xóa.")
		return
	}

	if err := s.db.Delete(&unit).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// ----------------------------------------------------------------------------
// Category Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetCategories(w http.ResponseWriter, r *http.Request) {
	var categories []model.Category
	if err := s.db.Preload("Parent").Find(&categories).Error; err != nil {
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
	cat.Name = strings.TrimSpace(cat.Name)
	if cat.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	cat.Code = strings.TrimSpace(cat.Code)
	if cat.Code == "" {
		cat.Code = slugifyVietnamese(cat.Name)
		if cat.Code == "" {
			cat.Code = "CAT_" + uuid.New().String()[:8]
		}
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

type updateCategoryInput struct {
	Name     string  `json:"name"`
	Code     string  `json:"code"`
	IsActive *bool   `json:"is_active"`
	ParentID *string `json:"parent_id"`
}

func (s *Server) handleUpdateCategory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "category id is required")
		return
	}

	var cat model.Category
	if err := s.db.First(&cat, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "category not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var input updateCategoryInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if trimmed := strings.TrimSpace(input.Code); trimmed != "" {
		cat.Code = trimmed
	}
	if trimmed := strings.TrimSpace(input.Name); trimmed != "" {
		cat.Name = trimmed
	}
	if input.IsActive != nil {
		cat.IsActive = *input.IsActive
	}
	if input.ParentID != nil {
		trimmed := strings.TrimSpace(*input.ParentID)
		if trimmed == "" {
			cat.ParentID = nil
		} else {
			if trimmed == id {
				writeError(w, http.StatusBadRequest, "category cannot be its own parent")
				return
			}
			cat.ParentID = &trimmed
		}
	}

	if err := s.db.Save(&cat).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, cat)
}

func (s *Server) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "category id is required")
		return
	}

	var cat model.Category
	if err := s.db.First(&cat, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "category not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// ponytail: manual referential check on code; upgrade to schema FK constraints when DB migration strategy stabilizes.
	var prodCount int64
	if err := s.db.Model(&model.Product{}).Where("category_id = ?", id).Count(&prodCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var childCount int64
	if err := s.db.Model(&model.Category{}).Where("parent_id = ?", id).Count(&childCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if prodCount > 0 || childCount > 0 {
		writeError(w, http.StatusConflict, "Danh mục đang chứa sản phẩm hoặc danh mục con, không thể xóa.")
		return
	}

	if err := s.db.Delete(&cat).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// ----------------------------------------------------------------------------
// Product Handlers
// ----------------------------------------------------------------------------

func (s *Server) handleGetProducts(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	catID := strings.TrimSpace(r.URL.Query().Get("category_id"))
	prodType := strings.TrimSpace(r.URL.Query().Get("product_type"))
	archetype := strings.TrimSpace(r.URL.Query().Get("archetype"))
	pageStr := strings.TrimSpace(r.URL.Query().Get("page"))
	pageSizeStr := strings.TrimSpace(r.URL.Query().Get("page_size"))

	query := s.db.Model(&model.Product{})
	if q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR code LIKE ? OR id IN (SELECT product_id FROM product_variants WHERE sku LIKE ? OR variant_name LIKE ?)", like, like, like, like)
	}
	if catID != "" && catID != "ALL" {
		query = query.Where("category_id = ?", catID)
	}
	if prodType != "" && prodType != "ALL" {
		query = query.Where("product_type = ?", prodType)
	}
	if archetype != "" && archetype != "ALL" {
		query = query.Where("archetype = ?", archetype)
	}

	var total int64
	query.Count(&total)

	if pageStr != "" || pageSizeStr != "" {
		page, _ := strconv.Atoi(pageStr)
		if page < 1 {
			page = 1
		}
		pageSize, _ := strconv.Atoi(pageSizeStr)
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		var products []model.Product
		if err := query.Preload("Variants.Batches", "remaining_qty > 0").
			Preload("Variants.UomConversions").
			Preload("Variants").
			Preload("Category").
			Order("created_at desc").
			Limit(pageSize).
			Offset(offset).
			Find(&products).Error; err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"items":     products,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		})
		return
	}

	var products []model.Product
	if err := query.Preload("Variants.Batches", "remaining_qty > 0").
		Preload("Variants.UomConversions").
		Preload("Variants").
		Preload("Category").
		Order("created_at desc").
		Find(&products).Error; err != nil {
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
	Barcode            *string          `json:"barcode,omitempty"`
	SellingPrice       *decimal.Decimal `json:"selling_price,omitempty"`
}

type CreateProductDTO struct {
	Name              string                   `json:"name"`
	Code              string                   `json:"code"`
	CategoryID        string                   `json:"category_id"`
	ProductType       model.ProductType        `json:"product_type"`
	Archetype         model.ProductArchetype   `json:"archetype"`
	BaseUom           string                   `json:"base_uom"`
	IsWeighable       bool                     `json:"is_weighable"`
	TrackInventory    *bool                    `json:"track_inventory"`
	TrackBatches      bool                     `json:"track_batches"`
	ShelfLifeDays     *int                     `json:"shelf_life_days"`
	ExpiryWarningDays *int                     `json:"expiry_warning_days"`
	ProductionMode    model.ProductionMode     `json:"production_mode"`
	ImageURL          string                   `json:"image_url"`
	CostPrice         decimal.Decimal          `json:"cost_price"`
	BaseSellingPrice  decimal.Decimal          `json:"base_selling_price"`
	MinSellingPrice   decimal.Decimal          `json:"min_selling_price"`
	MatrixAttributes  map[string][]string      `json:"matrix_attributes"`
	UomConversions    []CreateUomConversionDTO `json:"uom_conversions"`
	Variants          []model.ProductVariant   `json:"variants"`
}

func ensureUnitExists(db *gorm.DB, name string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}
	var count int64
	db.Model(&model.Unit{}).Where("LOWER(name) = ?", strings.ToLower(name)).Count(&count)
	if count == 0 {
		slug := slugifyVietnamese(name)
		if slug == "" {
			slug = strings.ToUpper(name)
		}
		u := model.Unit{
			ID:       uuid.New().String(),
			Name:     name,
			Code:     slug,
			IsActive: true,
		}
		_ = db.Create(&u).Error
	}
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
	if input.Archetype == "" {
		input.Archetype = model.ProductArchetypeStandard
	}
	if input.ProductionMode == "" {
		input.ProductionMode = model.ProductionModeNone
	}
	trackInv := true
	if input.TrackInventory != nil {
		trackInv = *input.TrackInventory
	}

	ensureUnitExists(s.db, input.BaseUom)
	for _, uom := range input.UomConversions {
		ensureUnitExists(s.db, uom.UomName)
	}

	productID := uuid.New().String()
	product := model.Product{
		ID:                productID,
		Name:              input.Name,
		Code:              input.Code,
		CategoryID:        input.CategoryID,
		ProductType:       input.ProductType,
		Archetype:         input.Archetype,
		BaseUom:           input.BaseUom,
		IsWeighable:       input.IsWeighable,
		TrackInventory:    trackInv,
		TrackBatches:      input.TrackBatches,
		ShelfLifeDays:     input.ShelfLifeDays,
		ExpiryWarningDays: input.ExpiryWarningDays,
		ProductionMode:    input.ProductionMode,
		ImageURL:          input.ImageURL,
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
					Barcode:            uom.Barcode,
					SellingPrice:       uom.SellingPrice,
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
					Barcode:            uom.Barcode,
					SellingPrice:       uom.SellingPrice,
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
					Barcode:            uom.Barcode,
					SellingPrice:       uom.SellingPrice,
			})
		}
		product.Variants = append(product.Variants, variant)
	}

	if err := s.db.Create(&product).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !trackInv {
		s.db.Model(&product).Update("track_inventory", false)
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
	partnerType := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("type")))
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
	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if input.PartnerType == "" {
		input.PartnerType = model.PartnerTypeSupplier
	}
	var phone *string
	if input.Phone != nil {
		trimmed := strings.TrimSpace(*input.Phone)
		phone = &trimmed
	}
	var address *string
	if input.Address != nil {
		trimmed := strings.TrimSpace(*input.Address)
		address = &trimmed
	}
	p := model.Partner{
		Name:        name,
		Phone:       phone,
		Address:     address,
		PartnerType: input.PartnerType,
	}
	if err := s.db.Create(&p).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

type updatePartnerInput struct {
	Name        string            `json:"name"`
	Phone       *string           `json:"phone,omitempty"`
	Address     *string           `json:"address,omitempty"`
	PartnerType model.PartnerType `json:"partner_type,omitempty"`
	PriceTier   string            `json:"price_tier,omitempty"`
	CreditLimit *decimal.Decimal  `json:"credit_limit,omitempty"`
	IsActive    *bool             `json:"is_active,omitempty"`
}

func (s *Server) handleUpdatePartner(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "partner id is required")
		return
	}

	var p model.Partner
	if err := s.db.First(&p, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "partner not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var input updatePartnerInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if trimmed := strings.TrimSpace(input.Name); trimmed != "" {
		p.Name = trimmed
	}
	if input.Phone != nil {
		trimmed := strings.TrimSpace(*input.Phone)
		p.Phone = &trimmed
	}
	if input.Address != nil {
		trimmed := strings.TrimSpace(*input.Address)
		p.Address = &trimmed
	}
	if input.PartnerType != "" {
		p.PartnerType = input.PartnerType
	}
	if trimmed := strings.TrimSpace(input.PriceTier); trimmed != "" {
		p.PriceTier = trimmed
	}
	if input.CreditLimit != nil {
		p.CreditLimit = *input.CreditLimit
	}
	if input.IsActive != nil {
		p.IsActive = *input.IsActive
	}

	if err := s.db.Save(&p).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleDeletePartner(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "partner id is required")
		return
	}

	var p model.Partner
	if err := s.db.First(&p, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "partner not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// ponytail: manual referential check on code; upgrade to schema FK constraints when DB migration strategy stabilizes.
	var batchCount int64
	if err := s.db.Model(&model.InventoryBatch{}).Where("supplier_id = ?", id).Count(&batchCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var orderCount int64
	if err := s.db.Model(&model.SalesOrder{}).Where("customer_id = ?", id).Count(&orderCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var debtCount int64
	if err := s.db.Model(&model.DebtLedger{}).Where("partner_id = ?", id).Count(&debtCount).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if batchCount > 0 || orderCount > 0 || debtCount > 0 {
		writeError(w, http.StatusConflict, "Đối tác đã phát sinh giao dịch, không thể xóa.")
		return
	}

	if err := s.db.Delete(&p).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}


// ----------------------------------------------------------------------------
// Warehouse & Stock Transfer Handlers
// ----------------------------------------------------------------------------

type WarehouseDTO struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	IsActive  *bool  `json:"is_active"`
	IsDefault *bool  `json:"is_default"`
}

func (s *Server) handleGetWarehouses(w http.ResponseWriter, r *http.Request) {
	var count int64
	s.db.Model(&model.Warehouse{}).Count(&count)
	if count == 0 {
		defWH := model.Warehouse{
			ID:        uuid.New().String(),
			Code:      "KHO_TONG",
			Name:      "Kho Tổng (Mặc định)",
			Address:   "Trụ sở chính",
			IsActive:  true,
			IsDefault: true,
		}
		_ = s.db.Create(&defWH).Error
	}

	query := s.db.Model(&model.Warehouse{})
	if r.URL.Query().Get("active_only") == "true" {
		query = query.Where("is_active = ?", true)
	}

	var warehouses []model.Warehouse
	if err := query.Order("is_default desc, code asc").Find(&warehouses).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, warehouses)
}

func (s *Server) handleCreateWarehouse(w http.ResponseWriter, r *http.Request) {
	var input WarehouseDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "warehouse name is required")
		return
	}

	code := strings.ToUpper(strings.TrimSpace(input.Code))
	if code == "" {
		code = slugifyVietnamese(name)
		if code == "" {
			code = "WH_" + uuid.New().String()[:8]
		}
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	isDefault := false
	if input.IsDefault != nil {
		isDefault = *input.IsDefault
	}

	if isDefault {
		_ = s.db.Model(&model.Warehouse{}).Where("is_default = ?", true).Update("is_default", false).Error
	}

	wh := model.Warehouse{
		ID:        uuid.New().String(),
		Code:      code,
		Name:      name,
		Address:   strings.TrimSpace(input.Address),
		IsActive:  isActive,
		IsDefault: isDefault,
	}

	if err := s.db.Create(&wh).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, wh)
}

func (s *Server) handleUpdateWarehouse(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "warehouse id is required")
		return
	}

	var wh model.Warehouse
	if err := s.db.First(&wh, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusNotFound, "warehouse not found")
		return
	}

	var input WarehouseDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if trimmed := strings.TrimSpace(input.Name); trimmed != "" {
		wh.Name = trimmed
	}
	if trimmed := strings.ToUpper(strings.TrimSpace(input.Code)); trimmed != "" {
		wh.Code = trimmed
	}
	if input.Address != "" {
		wh.Address = strings.TrimSpace(input.Address)
	}
	if input.IsActive != nil {
		wh.IsActive = *input.IsActive
	}
	if input.IsDefault != nil && *input.IsDefault {
		wh.IsDefault = true
		_ = s.db.Model(&model.Warehouse{}).Where("id != ?", id).Update("is_default", false).Error
	}

	if err := s.db.Save(&wh).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wh)
}

func (s *Server) handleDeleteWarehouse(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var count int64
	s.db.Model(&model.WarehouseStock{}).Where("warehouse_id = ? AND current_stock > 0", id).Count(&count)
	if count > 0 {
		writeError(w, http.StatusConflict, "Kho đang có hàng tồn, không thể xóa.")
		return
	}

	if err := s.db.Delete(&model.Warehouse{}, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

type VariantWarehouseStockDTO struct {
	WarehouseID   string           `json:"warehouse_id"`
	WarehouseName string           `json:"warehouse_name"`
	Stock         decimal.Decimal  `json:"stock"`
	OnHand        decimal.Decimal  `json:"on_hand"`
	Reserved      decimal.Decimal  `json:"reserved"`
	Locked        decimal.Decimal  `json:"locked"`
	InTransit     decimal.Decimal  `json:"in_transit"`
	Available     decimal.Decimal  `json:"available"`
	SecondaryQty  *decimal.Decimal `json:"secondary_qty,omitempty"`
}

type VariantStockReportDTO struct {
	VariantID      string                     `json:"variant_id"`
	ProductID      string                     `json:"product_id"`
	ProductName    string                     `json:"product_name"`
	VariantName    string                     `json:"variant_name"`
	SKU            string                     `json:"sku"`
	BaseUom        string                     `json:"base_uom"`
	TotalStock     decimal.Decimal            `json:"total_stock"`
	TotalOnHand    decimal.Decimal            `json:"total_on_hand"`
	TotalReserved  decimal.Decimal            `json:"total_reserved"`
	TotalAvailable decimal.Decimal            `json:"total_available"`
	ByWarehouse    []VariantWarehouseStockDTO `json:"by_warehouse"`
}

func (s *Server) handleGetWarehouseStock(w http.ResponseWriter, r *http.Request) {
	var warehouses []model.Warehouse
	if err := s.db.Where("is_active = ?", true).Order("is_default desc, code asc").Find(&warehouses).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var variants []model.ProductVariant
	if err := s.db.Preload("Product").Find(&variants).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var allStocks []model.WarehouseStock
	_ = s.db.Find(&allStocks).Error
	stockMap := make(map[string]map[string]decimal.Decimal)
	for _, st := range allStocks {
		if stockMap[st.VariantID] == nil {
			stockMap[st.VariantID] = make(map[string]decimal.Decimal)
		}
		stockMap[st.VariantID][st.WarehouseID] = st.CurrentStock
	}

	var allBalances []model.WarehouseStockBalance
	_ = s.db.Find(&allBalances).Error
	balMap := make(map[string]map[string]model.WarehouseStockBalance)
	for _, bal := range allBalances {
		if balMap[bal.VariantID] == nil {
			balMap[bal.VariantID] = make(map[string]model.WarehouseStockBalance)
		}
		balMap[bal.VariantID][bal.WarehouseID] = bal
	}

	report := make([]VariantStockReportDTO, 0, len(variants))
	for _, v := range variants {
		pName := ""
		baseUom := ""
		if v.Product != nil {
			pName = v.Product.Name
			baseUom = v.Product.BaseUom
		}

		totalOnHand := decimal.Zero
		totalReserved := decimal.Zero
		totalAvailable := decimal.Zero

		byWh := make([]VariantWarehouseStockDTO, 0, len(warehouses))
		for _, wh := range warehouses {
			st := decimal.Zero
			if m, ok := stockMap[v.ID]; ok {
				st = m[wh.ID]
			}

			onHand := st
			reserved := decimal.Zero
			locked := decimal.Zero
			inTransit := decimal.Zero
			available := st
			var secQty *decimal.Decimal

			if bm, ok := balMap[v.ID]; ok {
				if b, hasBal := bm[wh.ID]; hasBal {
					onHand = b.OnHandBaseQty
					reserved = b.ReservedBaseQty
					locked = b.LockedBaseQty
					inTransit = b.InTransitBaseQty
					available = b.AvailableBaseQty()
					secQty = b.OnHandSecondaryQty
					st = onHand
				}
			}

			totalOnHand = totalOnHand.Add(onHand)
			totalReserved = totalReserved.Add(reserved)
			totalAvailable = totalAvailable.Add(available)

			byWh = append(byWh, VariantWarehouseStockDTO{
				WarehouseID:   wh.ID,
				WarehouseName: wh.Name,
				Stock:         st,
				OnHand:        onHand,
				Reserved:      reserved,
				Locked:        locked,
				InTransit:     inTransit,
				Available:     available,
				SecondaryQty:  secQty,
			})
		}

		report = append(report, VariantStockReportDTO{
			VariantID:      v.ID,
			ProductID:      v.ProductID,
			ProductName:    pName,
			VariantName:    v.VariantName,
			SKU:            v.Sku,
			BaseUom:        baseUom,
			TotalStock:     v.CurrentStock,
			TotalOnHand:    totalOnHand,
			TotalReserved:  totalReserved,
			TotalAvailable: totalAvailable,
			ByWarehouse:    byWh,
		})
	}

	writeJSON(w, http.StatusOK, report)
}

type TransferItemDTO struct {
	VariantID string          `json:"variant_id"`
	BatchID   *string         `json:"batch_id"`
	Qty       decimal.Decimal `json:"qty"`
	Uom       string          `json:"uom"`
}

type CreateTransferDTO struct {
	FromWarehouseID string            `json:"from_warehouse_id"`
	ToWarehouseID   string            `json:"to_warehouse_id"`
	Notes           string            `json:"notes"`
	Items           []TransferItemDTO `json:"items"`
}

func (s *Server) handleGetTransfers(w http.ResponseWriter, r *http.Request) {
	var transfers []model.StockTransfer
	if err := s.db.Preload("FromWarehouse").
		Preload("ToWarehouse").
		Preload("Items.Variant.Product").
		Preload("Items.Batch").
		Order("created_at desc").
		Find(&transfers).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if transfers == nil {
		transfers = []model.StockTransfer{}
	}
	writeJSON(w, http.StatusOK, transfers)
}

func (s *Server) handleCreateTransfer(w http.ResponseWriter, r *http.Request) {
	var input CreateTransferDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if input.FromWarehouseID == "" || input.ToWarehouseID == "" {
		writeError(w, http.StatusBadRequest, "from_warehouse_id and to_warehouse_id are required")
		return
	}
	if input.FromWarehouseID == input.ToWarehouseID {
		writeError(w, http.StatusBadRequest, "không thể chuyển kho đến cùng một kho")
		return
	}
	if len(input.Items) == 0 {
		writeError(w, http.StatusBadRequest, "items cannot be empty")
		return
	}

	transferID := uuid.New().String()
	transferNumber := fmt.Sprintf("TRF-%s-%04d", time.Now().Format("060102"), time.Now().Unix()%10000)

	err := s.db.Transaction(func(tx *gorm.DB) error {
		transfer := model.StockTransfer{
			ID:              transferID,
			TransferNumber:  transferNumber,
			FromWarehouseID: input.FromWarehouseID,
			ToWarehouseID:   input.ToWarehouseID,
			Status:          model.StockTransferStatusCompleted,
			Notes:           input.Notes,
		}

		for _, item := range input.Items {
			if item.Qty.LessThanOrEqual(decimal.Zero) {
				return errors.New("transfer quantity must be positive")
			}

			var variant model.ProductVariant
			if err := tx.Preload("Product").First(&variant, "id = ?", item.VariantID).Error; err != nil {
				return err
			}

			uom := item.Uom
			if uom == "" && variant.Product != nil {
				uom = variant.Product.BaseUom
			}

			transfer.Items = append(transfer.Items, model.StockTransferItem{
				ID:         uuid.New().String(),
				TransferID: transferID,
				VariantID:  item.VariantID,
				BatchID:    item.BatchID,
				Qty:        item.Qty,
				Uom:        uom,
			})

			outNote := fmt.Sprintf("Chuyển kho đi (%s)", transferNumber)
			if _, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
				VariantID:      item.VariantID,
				WarehouseID:    &input.FromWarehouseID,
				BatchID:        item.BatchID,
				MovementType:   model.MovementTypeTransferOut,
				QtyInBaseUom:   item.Qty.Neg(),
				InputUOM:       uom,
				InputQty:       item.Qty.Neg(),
				UnitCostAtTime: variant.CostPrice,
				ReferenceID:    &transferNumber,
				ReasonNote:     &outNote,
			}); err != nil {
				return err
			}

			inNote := fmt.Sprintf("Nhận chuyển kho (%s)", transferNumber)
			if _, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
				VariantID:      item.VariantID,
				WarehouseID:    &input.ToWarehouseID,
				BatchID:        item.BatchID,
				MovementType:   model.MovementTypeTransferIn,
				QtyInBaseUom:   item.Qty,
				InputUOM:       uom,
				InputQty:       item.Qty,
				UnitCostAtTime: variant.CostPrice,
				ReferenceID:    &transferNumber,
				ReasonNote:     &inNote,
			}); err != nil {
				return err
			}
		}

		return tx.Create(&transfer).Error
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var created model.StockTransfer
	_ = s.db.Preload("FromWarehouse").Preload("ToWarehouse").Preload("Items.Variant.Product").First(&created, "id = ?", transferID)
	writeJSON(w, http.StatusCreated, created)
}

type CompleteTransferRequest struct {
	ReceivedQtys map[string]decimal.Decimal `json:"received_qtys,omitempty"`
}

func (s *Server) handleDispatchTransfer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.ledgerService.DispatchStockTransfer(r.Context(), nil, id); err != nil {
		if errors.Is(err, service.ErrTransferNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		if errors.Is(err, service.ErrInsufficientStock) {
			writeError(w, http.StatusBadRequest, "không đủ tồn kho để xuất chuyển")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var transfer model.StockTransfer
	_ = s.db.Preload("FromWarehouse").Preload("ToWarehouse").Preload("Items.Variant.Product").First(&transfer, "id = ?", id)
	writeJSON(w, http.StatusOK, transfer)
}

func (s *Server) handleCompleteTransfer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req CompleteTransferRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	var transfer model.StockTransfer
	if err := s.db.First(&transfer, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusNotFound, "transfer not found")
		return
	}

	if transfer.Status == model.StockTransferStatusInTransit {
		if err := s.ledgerService.ReceiveStockTransfer(r.Context(), nil, id, req.ReceivedQtys); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else if transfer.Status == model.StockTransferStatusDraft {
		if err := s.ledgerService.DispatchStockTransfer(r.Context(), nil, id); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if err := s.ledgerService.ReceiveStockTransfer(r.Context(), nil, id, req.ReceivedQtys); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		transfer.Status = model.StockTransferStatusCompleted
		_ = s.db.Save(&transfer)
	}

	_ = s.db.Preload("FromWarehouse").Preload("ToWarehouse").Preload("Items.Variant.Product").First(&transfer, "id = ?", id)
	writeJSON(w, http.StatusOK, transfer)
}

// ----------------------------------------------------------------------------
// Inventory & Receipt Handlers
// ----------------------------------------------------------------------------

type ReceiptLineItem struct {
	ID             string          `json:"id"`
	VariantID      string          `json:"variant_id"`
	ProductName    string          `json:"product_name"`
	VariantName    string          `json:"variant_name"`
	SKU            string          `json:"sku"`
	BaseUom        string          `json:"base_uom"`
	InputUom       string          `json:"input_uom"`
	InputQty       decimal.Decimal `json:"input_qty"`
	QtyInBaseUom   decimal.Decimal `json:"qty_in_base_uom"`
	UnitCostAtTime decimal.Decimal `json:"unit_cost_at_time"`
	LineTotal      decimal.Decimal `json:"line_total"`
	BatchCode      *string         `json:"batch_code,omitempty"`
	ExpiryDate     *time.Time      `json:"expiry_date,omitempty"`
}

type ReceiptSummary struct {
	ReferenceID  string             `json:"reference_id"`
	MovementType model.MovementType `json:"movement_type"`
	CreatedAt    time.Time          `json:"created_at"`
	ItemCount    int                `json:"item_count"`
	TotalQty     decimal.Decimal    `json:"total_qty"`
	TotalAmount  decimal.Decimal    `json:"total_amount"`
	PartnerID    *string            `json:"partner_id,omitempty"`
	PartnerName  *string            `json:"partner_name,omitempty"`
	Notes        *string            `json:"notes,omitempty"`
	Items        []ReceiptLineItem  `json:"items,omitempty"`
}

func (s *Server) handleGetReceipts(w http.ResponseWriter, r *http.Request) {
	receiptType := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("type")))
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	query := s.db.Model(&model.InventoryMovement{}).
		Preload("Variant.Product").
		Preload("Batch.Supplier").
		Where("reference_id IS NOT NULL AND reference_id != ''")

	if receiptType == "PURCHASE" {
		query = query.Where("movement_type = ?", model.MovementTypePurchaseIn)
	} else if receiptType == "WASTAGE" {
		query = query.Where("movement_type = ?", model.MovementTypeWastageSpoilage)
	} else if receiptType != "" {
		query = query.Where("movement_type = ?", receiptType)
	}

	var movements []model.InventoryMovement
	if err := query.Order("created_at desc").Find(&movements).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	groups := make(map[string]*ReceiptSummary)
	orderList := make([]string, 0)

	for _, m := range movements {
		ref := ""
		if m.ReferenceID != nil {
			ref = *m.ReferenceID
		}
		if ref == "" {
			continue
		}

		itemQty := m.InputQty.Abs()
		lineTotal := itemQty.Mul(m.UnitCostAtTime)

		pName := ""
		vName := ""
		sku := ""
		baseUom := ""
		if m.Variant != nil {
			vName = m.Variant.VariantName
			sku = m.Variant.Sku
			if m.Variant.Product != nil {
				pName = m.Variant.Product.Name
				baseUom = m.Variant.Product.BaseUom
			}
		}

		var bCode *string
		var expDate *time.Time
		var supplierID *string
		var supplierName *string
		if m.Batch != nil {
			bCode = &m.Batch.BatchCode
			expDate = m.Batch.ExpiryDate
			if m.Batch.Supplier != nil {
				supplierID = &m.Batch.Supplier.ID
				supplierName = &m.Batch.Supplier.Name
			}
		}

		lineItem := ReceiptLineItem{
			ID:             m.ID,
			VariantID:      m.VariantID,
			ProductName:    pName,
			VariantName:    vName,
			SKU:            sku,
			BaseUom:        baseUom,
			InputUom:       m.InputUom,
			InputQty:       itemQty,
			QtyInBaseUom:   m.QtyInBaseUom.Abs(),
			UnitCostAtTime: m.UnitCostAtTime,
			LineTotal:      lineTotal,
			BatchCode:      bCode,
			ExpiryDate:     expDate,
		}

		if existing, exists := groups[ref]; exists {
			existing.ItemCount++
			existing.TotalQty = existing.TotalQty.Add(itemQty)
			existing.TotalAmount = existing.TotalAmount.Add(lineTotal)
			if existing.PartnerName == nil && supplierName != nil {
				existing.PartnerID = supplierID
				existing.PartnerName = supplierName
			}
			existing.Items = append(existing.Items, lineItem)
		} else {
			notes := m.ReasonNote
			summary := &ReceiptSummary{
				ReferenceID:  ref,
				MovementType: m.MovementType,
				CreatedAt:    m.CreatedAt,
				ItemCount:    1,
				TotalQty:     itemQty,
				TotalAmount:  lineTotal,
				PartnerID:    supplierID,
				PartnerName:  supplierName,
				Notes:        notes,
				Items:        []ReceiptLineItem{lineItem},
			}
			groups[ref] = summary
			orderList = append(orderList, ref)
		}
	}

	result := make([]ReceiptSummary, 0, len(orderList))
	for _, ref := range orderList {
		g := groups[ref]
		if q != "" {
			refMatch := strings.Contains(strings.ToLower(g.ReferenceID), q)
			notesMatch := g.Notes != nil && strings.Contains(strings.ToLower(*g.Notes), q)
			partnerMatch := g.PartnerName != nil && strings.Contains(strings.ToLower(*g.PartnerName), q)
			if !refMatch && !notesMatch && !partnerMatch {
				continue
			}
		}
		result = append(result, *g)
	}

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleGetReceiptDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "receipt id is required")
		return
	}

	var movements []model.InventoryMovement
	if err := s.db.Preload("Variant.Product").Preload("Batch.Supplier").
		Where("reference_id = ?", id).
		Order("created_at asc").Find(&movements).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(movements) == 0 {
		writeError(w, http.StatusNotFound, "receipt not found")
		return
	}

	first := movements[0]
	totalQty := decimal.Zero
	totalAmount := decimal.Zero
	var supplierID *string
	var supplierName *string

	items := make([]ReceiptLineItem, 0, len(movements))
	for _, m := range movements {
		itemQty := m.InputQty.Abs()
		lineTotal := itemQty.Mul(m.UnitCostAtTime)
		totalQty = totalQty.Add(itemQty)
		totalAmount = totalAmount.Add(lineTotal)

		pName := ""
		vName := ""
		sku := ""
		baseUom := ""
		if m.Variant != nil {
			vName = m.Variant.VariantName
			sku = m.Variant.Sku
			if m.Variant.Product != nil {
				pName = m.Variant.Product.Name
				baseUom = m.Variant.Product.BaseUom
			}
		}

		var bCode *string
		var expDate *time.Time
		if m.Batch != nil {
			bCode = &m.Batch.BatchCode
			expDate = m.Batch.ExpiryDate
			if supplierName == nil && m.Batch.Supplier != nil {
				supplierID = &m.Batch.Supplier.ID
				supplierName = &m.Batch.Supplier.Name
			}
		}

		items = append(items, ReceiptLineItem{
			ID:             m.ID,
			VariantID:      m.VariantID,
			ProductName:    pName,
			VariantName:    vName,
			SKU:            sku,
			BaseUom:        baseUom,
			InputUom:       m.InputUom,
			InputQty:       itemQty,
			QtyInBaseUom:   m.QtyInBaseUom.Abs(),
			UnitCostAtTime: m.UnitCostAtTime,
			LineTotal:      lineTotal,
			BatchCode:      bCode,
			ExpiryDate:     expDate,
		})
	}

	detail := ReceiptSummary{
		ReferenceID:  id,
		MovementType: first.MovementType,
		CreatedAt:    first.CreatedAt,
		ItemCount:    len(items),
		TotalQty:     totalQty,
		TotalAmount:  totalAmount,
		PartnerID:    supplierID,
		PartnerName:  supplierName,
		Notes:        first.ReasonNote,
		Items:        items,
	}

	writeJSON(w, http.StatusOK, detail)
}

type PurchaseItemDTO struct {
	VariantID  string          `json:"variant_id"`
	Qty        decimal.Decimal `json:"qty"`
	UnitCost   decimal.Decimal `json:"unit_cost"`
	UOM        string          `json:"uom"`
	BatchCode  *string         `json:"batch_code"`
	ExpiryDate *time.Time      `json:"expiry_date"`
}

type PurchaseDTO struct {
	SupplierID    *string           `json:"supplier_id"`
	WarehouseID   *string           `json:"warehouse_id,omitempty"`
	ReferenceID   *string           `json:"reference_id"`
	Notes         *string           `json:"notes"`
	PaymentMethod *string           `json:"payment_method,omitempty"`
	AmountPaid    *decimal.Decimal  `json:"amount_paid,omitempty"`
	Items         []PurchaseItemDTO `json:"items"`
}

func (s *Server) handlePurchaseReceiving(w http.ResponseWriter, r *http.Request) {
	var input PurchaseDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(input.Items) == 0 {
		writeError(w, http.StatusBadRequest, "items cannot be empty")
		return
	}

	refCode := input.ReferenceID
	if refCode == nil || strings.TrimSpace(*refCode) == "" {
		generated := fmt.Sprintf("PO-%s-%04d", time.Now().Format("060102"), time.Now().Unix()%10000)
		refCode = &generated
	}

	totalPurchaseAmount := decimal.Zero

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range input.Items {
			var variant model.ProductVariant
			if err := tx.Preload("Product").First(&variant, "id = ?", item.VariantID).Error; err != nil {
				return err
			}

			qtyInBase := item.Qty
			unitCostInBase := item.UnitCost

			if item.UOM != "" && variant.Product != nil && item.UOM != variant.Product.BaseUom {
				conv, err := s.uomService.ToBaseQty(r.Context(), tx, service.ToBaseQtyParams{
					VariantID: item.VariantID,
					InputUOM:  item.UOM,
					InputQty:  item.Qty,
				})
				if err == nil && conv.GreaterThan(decimal.Zero) {
					qtyInBase = conv
					if !qtyInBase.IsZero() {
						unitCostInBase = item.Qty.Mul(item.UnitCost).Div(qtyInBase)
					}
				}
			}

			// Calculate new WAC first before stock increment
			if _, err := s.ledgerService.CalculateNewWAC(r.Context(), tx, item.VariantID, qtyInBase, unitCostInBase); err != nil {
				return err
			}
			_ = s.bomService.SyncBOMCostsForComponent(r.Context(), tx, item.VariantID)

			var batchID *string
			if item.BatchCode != nil && *item.BatchCode != "" {
				var existingBatch model.InventoryBatch
				if err := tx.Where("variant_id = ? AND batch_code = ?", item.VariantID, *item.BatchCode).First(&existingBatch).Error; err == nil {
					batchID = &existingBatch.ID
					updates := map[string]interface{}{
						"unit_cost": unitCostInBase,
					}
					if item.ExpiryDate != nil {
						updates["expiry_date"] = item.ExpiryDate
					}
					if err := tx.Model(&existingBatch).Updates(updates).Error; err != nil {
						return err
					}
				} else {
					batch := model.InventoryBatch{
						ID:           uuid.New().String(),
						VariantID:    item.VariantID,
						WarehouseID:  input.WarehouseID,
						BatchCode:    *item.BatchCode,
						SupplierID:   input.SupplierID,
						ReceivedDate: time.Now(),
						ExpiryDate:   item.ExpiryDate,
						InitialQty:   qtyInBase,
						RemainingQty: decimal.Zero,
						UnitCost:     unitCostInBase,
					}
					if err := tx.Create(&batch).Error; err != nil {
						return err
					}
					batchID = &batch.ID
				}
			}

			lineTotal := item.Qty.Mul(item.UnitCost)
			totalPurchaseAmount = totalPurchaseAmount.Add(lineTotal)

			if _, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
				VariantID:      item.VariantID,
				WarehouseID:    input.WarehouseID,
				BatchID:        batchID,
				MovementType:   model.MovementTypePurchaseIn,
				QtyInBaseUom:   qtyInBase,
				InputUOM:       item.UOM,
				InputQty:       item.Qty,
				UnitCostAtTime: unitCostInBase,
				ReferenceID:    refCode,
				ReasonNote:     input.Notes,
			}); err != nil {
				return err
			}
		}

		// Supplier Debt and Cashbook
		if input.SupplierID != nil && *input.SupplierID != "" {
			var supplier model.Partner
			if err := tx.First(&supplier, "id = ?", *input.SupplierID).Error; err == nil {
				paid := totalPurchaseAmount
				if input.AmountPaid != nil {
					paid = *input.AmountPaid
				} else if input.PaymentMethod != nil && *input.PaymentMethod == "CREDIT" {
					paid = decimal.Zero
				}

				debt := totalPurchaseAmount.Sub(paid)
				if debt.GreaterThan(decimal.Zero) {
					newDebt := supplier.CurrentDebtBalance.Add(debt)
					debtNote := fmt.Sprintf("Nợ nhập hàng phiếu %s", *refCode)
					debtLedger := model.DebtLedger{
						PartnerID:       supplier.ID,
						TransactionType: model.DebtTransactionTypeSupplierInvoice,
						Amount:          debt,
						BalanceAfter:    newDebt,
						ReferenceID:     refCode,
						Note:            &debtNote,
					}
					if err := tx.Create(&debtLedger).Error; err != nil {
						return err
					}
					if err := tx.Model(&supplier).Update("current_debt_balance", newDebt).Error; err != nil {
						return err
					}
				}

				if paid.GreaterThan(decimal.Zero) {
					cbMethod := model.CashbookPaymentMethodCash
					if input.PaymentMethod != nil && *input.PaymentMethod == "BANK_TRANSFER" {
						cbMethod = model.CashbookPaymentMethodBankTransfer
					}
					cashTx := model.CashbookTransaction{
						TransactionType: model.CashbookTypeOutflow,
						Category:        model.CashbookCategorySupplierPayment,
						Amount:          paid,
						PaymentMethod:   cbMethod,
						PartnerID:       input.SupplierID,
						Description:     fmt.Sprintf("Chi tiền nhập hàng phiếu %s", *refCode),
					}
					if err := tx.Create(&cashTx).Error; err != nil {
						return err
					}
				}
			}
		}

		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"message":      "purchase received successfully",
		"reference_id": *refCode,
	})
}

type WastageDTO struct {
	VariantID        string          `json:"variant_id"`
	WarehouseID      *string         `json:"warehouse_id,omitempty"`
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
		WarehouseID:      input.WarehouseID,
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
	for i := range recipes {
		if recipes[i].RecipeType == model.RecipeTypeAssembly {
			cost, err := s.bomService.CalculateRecipeCost(r.Context(), s.db, recipes[i].ID)
			if err == nil {
				recipes[i].EstimatedUnitCost = cost
			}
		}
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

	// Auto-calculate BOM unit cost and update target variant's cost_price
	if recipe.RecipeType == model.RecipeTypeAssembly {
		_, _ = s.bomService.SyncVariantCostFromBOM(r.Context(), s.db, recipe.TargetVariantID)

		// Set product production mode to POS_BACKFLUSH if currently NONE or empty
		var targetVar model.ProductVariant
		if err := s.db.First(&targetVar, "id = ?", recipe.TargetVariantID).Error; err == nil {
			s.db.Model(&model.Product{}).
				Where("id = ? AND (production_mode = ? OR production_mode = '')", targetVar.ProductID, model.ProductionModeNone).
				Update("production_mode", model.ProductionModePosBackflush)
		}
	}

	var created model.BomRecipe
	if err := s.db.Preload("Items.ComponentVariant").Preload("TargetVariant").First(&created, "id = ?", recipe.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if created.RecipeType == model.RecipeTypeAssembly {
		cost, err := s.bomService.CalculateRecipeCost(r.Context(), s.db, created.ID)
		if err == nil {
			created.EstimatedUnitCost = cost
		}
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleSyncBomRecipeCost(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	var recipe model.BomRecipe
	if err := s.db.First(&recipe, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusNotFound, "recipe not found")
		return
	}

	unitCost, err := s.bomService.SyncVariantCostFromBOM(r.Context(), s.db, recipe.TargetVariantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"recipe_id":           recipe.ID,
		"target_variant_id":   recipe.TargetVariantID,
		"estimated_unit_cost": unitCost,
	})
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

// ----------------------------------------------------------------------------
// POS Checkout Handlers
// ----------------------------------------------------------------------------

type PosCheckoutModifierRequest struct {
	Name            string          `json:"name"`
	Price           decimal.Decimal `json:"price"`
	LinkedVariantID string          `json:"linked_variant_id"`
	DeductQty       decimal.Decimal `json:"deduct_qty"`
}

type PosCheckoutItemRequest struct {
	VariantID             string                       `json:"variant_id"`
	SoldUom               string                       `json:"sold_uom"`
	SoldQty               decimal.Decimal              `json:"sold_qty"`
	ActualBaseQtyDeducted decimal.Decimal              `json:"actual_base_qty_deducted"`
	OriginalUnitPrice     decimal.Decimal              `json:"original_unit_price"`
	ActualUnitPrice       decimal.Decimal              `json:"actual_unit_price"`
	LineTotal             decimal.Decimal              `json:"line_total"`
	IsReturn              bool                         `json:"is_return"`
	Modifiers             []PosCheckoutModifierRequest `json:"modifiers"`
	ModifiersJSON         *string                      `json:"modifiers_json"`
	BatchID               *string                      `json:"batch_id"`
}

type PosCheckoutRequest struct {
	PosSessionID    *string                  `json:"pos_session_id"`
	CustomerID      *string                  `json:"customer_id"`
	WarehouseID     *string                  `json:"warehouse_id,omitempty"`
	Items           []PosCheckoutItemRequest `json:"items"`
	Subtotal        decimal.Decimal          `json:"subtotal"`
	DiscountAmount  decimal.Decimal          `json:"discount_amount"`
	SurchargeAmount decimal.Decimal          `json:"surcharge_amount"`
	TotalAmount     decimal.Decimal          `json:"total_amount"`
	PaidAmount      decimal.Decimal          `json:"paid_amount"`
	DebtAmount      decimal.Decimal          `json:"debt_amount"`
	PaymentMethod   model.PaymentMethod      `json:"payment_method"`
	Notes           *string                  `json:"notes"`
}

// handlePosCheckout processes a complete POS sale or exchange in one atomic transaction.
// ponytail: in-memory sequence generation for order numbers; upgrade to database sequence/redis when multi-instance concurrency needed.
func (s *Server) handlePosCheckout(w http.ResponseWriter, r *http.Request) {
	var req PosCheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "items cannot be empty")
		return
	}

	if req.PosSessionID != nil && *req.PosSessionID == "" {
		req.PosSessionID = nil
	}
	if req.CustomerID != nil && *req.CustomerID == "" {
		req.CustomerID = nil
	}

	tx := s.db.WithContext(r.Context()).Begin()
	defer func() {
		if rec := recover(); rec != nil {
			tx.Rollback()
			panic(rec)
		}
	}()

	var count int64
	todayPrefix := fmt.Sprintf("HD-%s-%%", time.Now().Format("20060102"))
	tx.Model(&model.SalesOrder{}).Where("order_number LIKE ?", todayPrefix).Count(&count)
	orderNumber := fmt.Sprintf("HD-%s-%04d", time.Now().Format("20060102"), count+1)
	orderID := uuid.New().String()

	var orderItems []model.SalesOrderItem
	totalCogs := decimal.Zero
	calcSubtotal := decimal.Zero

	for _, itemReq := range req.Items {
		if itemReq.VariantID == "" {
			tx.Rollback()
			writeError(w, http.StatusBadRequest, "variant_id is required")
			return
		}

		var variant model.ProductVariant
		if err := tx.Preload("Product").First(&variant, "id = ?", itemReq.VariantID).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("variant not found: %s", itemReq.VariantID))
			} else {
				writeError(w, http.StatusInternalServerError, err.Error())
			}
			return
		}

		soldQty := itemReq.SoldQty
		if soldQty.IsZero() {
			soldQty = decimal.NewFromInt(1)
		}

		actualBaseQty := itemReq.ActualBaseQtyDeducted
		if actualBaseQty.IsZero() {
			actualBaseQty = soldQty
		}

		actualUnitPrice := itemReq.ActualUnitPrice
		if actualUnitPrice.IsZero() {
			actualUnitPrice = variant.BaseSellingPrice
		}

		origUnitPrice := itemReq.OriginalUnitPrice
		if origUnitPrice.IsZero() {
			if variant.BaseSellingPrice.IsPositive() {
				origUnitPrice = variant.BaseSellingPrice
			} else {
				origUnitPrice = actualUnitPrice
			}
		}

		if !itemReq.IsReturn && variant.MinSellingPrice.IsPositive() && actualUnitPrice.LessThan(variant.MinSellingPrice) {
			tx.Rollback()
			writeError(w, http.StatusBadRequest, fmt.Sprintf("đơn giá %s thấp hơn giá sàn %s của sản phẩm %s", actualUnitPrice, variant.MinSellingPrice, variant.VariantName))
			return
		}

		soldUom := itemReq.SoldUom
		if soldUom == "" && variant.Product != nil {
			soldUom = variant.Product.BaseUom
		}

		var lineCogs decimal.Decimal
		var modJSONStr *string

		if len(itemReq.Modifiers) > 0 {
			modBytes, err := json.Marshal(itemReq.Modifiers)
			if err == nil {
				str := string(modBytes)
				modJSONStr = &str
			}
		} else if itemReq.ModifiersJSON != nil {
			modJSONStr = itemReq.ModifiersJSON
		}

		var bomCost decimal.Decimal
		var hasBomRecipe bool
		calcCost, recipe, _ := s.bomService.CalculateVariantBOMCost(r.Context(), tx, variant.ID)
		if recipe != nil {
			hasBomRecipe = true
			bomCost = calcCost
		}

		effectiveCost := variant.CostPrice
		if effectiveCost.IsZero() && bomCost.IsPositive() {
			effectiveCost = bomCost
			_ = tx.Model(&model.ProductVariant{}).Where("id = ?", variant.ID).Update("cost_price", bomCost).Error
		}

		isBackflush := hasBomRecipe || (variant.Product != nil && variant.Product.ProductionMode == model.ProductionModePosBackflush)

		if itemReq.IsReturn {
			reason := fmt.Sprintf("POS return: %s", orderNumber)
			if variant.Product == nil || variant.Product.TrackInventory {
				_, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
					VariantID:      variant.ID,
					WarehouseID:    req.WarehouseID,
					BatchID:        itemReq.BatchID,
					MovementType:   model.MovementTypeReturnIn,
					QtyInBaseUom:   actualBaseQty,
					InputUOM:       soldUom,
					InputQty:       soldQty,
					UnitCostAtTime: effectiveCost,
					ReferenceID:    &orderID,
					ReasonNote:     &reason,
				})
				if err != nil {
					tx.Rollback()
					writeError(w, http.StatusInternalServerError, err.Error())
					return
				}
			}
			lineCogs = actualBaseQty.Mul(effectiveCost).Neg()
		} else {
			reason := fmt.Sprintf("POS sale: %s", orderNumber)
			batchIDToUse := itemReq.BatchID
			if (batchIDToUse == nil || *batchIDToUse == "") && variant.Product != nil && variant.Product.TrackBatches {
				var oldestBatch model.InventoryBatch
				if err := tx.Where("variant_id = ? AND remaining_qty > 0 AND (expiry_date IS NULL OR expiry_date > ?)", variant.ID, time.Now()).
					Order("expiry_date ASC, received_date ASC").First(&oldestBatch).Error; err == nil {
					batchIDToUse = &oldestBatch.ID
				}
			}
			if variant.Product == nil || variant.Product.TrackInventory {
				_, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
					VariantID:      variant.ID,
					WarehouseID:    req.WarehouseID,
					BatchID:        batchIDToUse,
					MovementType:   model.MovementTypeSaleOut,
					QtyInBaseUom:   actualBaseQty.Neg(),
					InputUOM:       soldUom,
					InputQty:       soldQty,
					UnitCostAtTime: effectiveCost,
					ReferenceID:    &orderID,
					ReasonNote:     &reason,
				})
				if err != nil {
					tx.Rollback()
					writeError(w, http.StatusInternalServerError, err.Error())
					return
				}
			}
			lineCogs = actualBaseQty.Mul(effectiveCost)

			if isBackflush {
				_, err := s.bomService.ExecuteBackflushDeduction(r.Context(), tx, service.BackflushParams{
					WarehouseID: req.WarehouseID,
					Items: []service.BackflushItem{
						{
							VariantID:     variant.ID,
							WarehouseID:   req.WarehouseID,
							Qty:           soldQty,
							ModifiersJSON: "",
							ReferenceID:   &orderID,
						},
					},
				})
				if err != nil {
					tx.Rollback()
					writeError(w, http.StatusInternalServerError, err.Error())
					return
				}
			}

			for _, mod := range itemReq.Modifiers {
				if mod.LinkedVariantID != "" && mod.DeductQty.GreaterThan(decimal.Zero) {
					var modVariant model.ProductVariant
					if err := tx.Preload("Product").First(&modVariant, "id = ?", mod.LinkedVariantID).Error; err != nil {
						tx.Rollback()
						writeError(w, http.StatusBadRequest, fmt.Sprintf("modifier linked variant not found: %s", mod.LinkedVariantID))
						return
					}
					modDeductTotal := mod.DeductQty.Mul(soldQty)
					modUom := ""
					if modVariant.Product != nil {
						modUom = modVariant.Product.BaseUom
					}
					modNote := fmt.Sprintf("Modifier topping: %s (Đơn %s)", mod.Name, orderNumber)
					_, err := s.ledgerService.RecordMovement(r.Context(), tx, service.RecordMovementParams{
						VariantID:      modVariant.ID,
						MovementType:   model.MovementTypeSaleOut,
						QtyInBaseUom:   modDeductTotal.Neg(),
						InputUOM:       modUom,
						InputQty:       modDeductTotal.Neg(),
						UnitCostAtTime: modVariant.CostPrice,
						ReferenceID:    &orderID,
						ReasonNote:     &modNote,
					})
					if err != nil {
						tx.Rollback()
						writeError(w, http.StatusInternalServerError, err.Error())
						return
					}
					lineCogs = lineCogs.Add(modDeductTotal.Mul(modVariant.CostPrice))
				}
			}
		}

		lineTotal := itemReq.LineTotal
		if lineTotal.IsZero() {
			baseAmount := actualUnitPrice.Mul(soldQty)
			if actualBaseQty.GreaterThan(decimal.Zero) && !actualBaseQty.Equal(soldQty) {
				baseAmount = actualUnitPrice.Mul(actualBaseQty)
			}
			for _, mod := range itemReq.Modifiers {
				baseAmount = baseAmount.Add(mod.Price.Mul(soldQty))
			}
			if itemReq.IsReturn {
				lineTotal = baseAmount.Neg()
			} else {
				lineTotal = baseAmount
			}
		}

		calcSubtotal = calcSubtotal.Add(lineTotal)
		totalCogs = totalCogs.Add(lineCogs)

		orderItems = append(orderItems, model.SalesOrderItem{
			OrderID:               orderID,
			VariantID:             variant.ID,
			BatchID:               itemReq.BatchID,
			SoldUom:               soldUom,
			SoldQty:               soldQty,
			ActualBaseQtyDeducted: actualBaseQty,
			OriginalUnitPrice:     origUnitPrice,
			ActualUnitPrice:       actualUnitPrice,
			LineTotal:             lineTotal,
			ModifiersJSON:         modJSONStr,
			LineCogs:              lineCogs,
			IsReturn:              itemReq.IsReturn,
		})
	}

	subtotal := req.Subtotal
	if subtotal.IsZero() && !calcSubtotal.IsZero() {
		subtotal = calcSubtotal
	}
	totalAmount := req.TotalAmount
	if totalAmount.IsZero() {
		totalAmount = subtotal.Sub(req.DiscountAmount).Add(req.SurchargeAmount)
	}
	paidAmount := req.PaidAmount
	debtAmount := req.DebtAmount
	if paidAmount.IsZero() && debtAmount.IsZero() {
		paidAmount = totalAmount
	}

	paymentMethod := req.PaymentMethod
	if paymentMethod == "" {
		paymentMethod = model.PaymentMethodCash
	}

	salesOrder := model.SalesOrder{
		ID:              orderID,
		OrderNumber:     orderNumber,
		CustomerID:      req.CustomerID,
		WarehouseID:     req.WarehouseID,
		PosSessionID:    req.PosSessionID,
		Status:          model.OrderStatusCompleted,
		Subtotal:        subtotal,
		DiscountAmount:  req.DiscountAmount,
		SurchargeAmount: req.SurchargeAmount,
		TotalAmount:     totalAmount,
		PaidAmount:      paidAmount,
		DebtAmount:      debtAmount,
		TotalCogs:       totalCogs,
		PaymentMethod:   paymentMethod,
		Items:           orderItems,
	}

	if err := tx.Create(&salesOrder).Error; err != nil {
		tx.Rollback()
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if debtAmount.GreaterThan(decimal.Zero) {
		if req.CustomerID == nil || *req.CustomerID == "" {
			tx.Rollback()
			writeError(w, http.StatusBadRequest, "customer_id is required when debt_amount > 0")
			return
		}
		var customer model.Partner
		if err := tx.First(&customer, "id = ?", *req.CustomerID).Error; err != nil {
			tx.Rollback()
			writeError(w, http.StatusBadRequest, fmt.Sprintf("customer not found: %s", *req.CustomerID))
			return
		}

		newDebtBalance := customer.CurrentDebtBalance.Add(debtAmount)
		debtNote := fmt.Sprintf("Ghi nợ đơn bán hàng POS %s", orderNumber)
		debtLedger := model.DebtLedger{
			PartnerID:       customer.ID,
			TransactionType: model.DebtTransactionTypeSaleDebt,
			ReferenceID:     &orderID,
			Amount:          debtAmount,
			BalanceAfter:    newDebtBalance,
			Note:            &debtNote,
		}
		if err := tx.Create(&debtLedger).Error; err != nil {
			tx.Rollback()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Model(&model.Partner{}).Where("id = ?", customer.ID).Update("current_debt_balance", newDebtBalance).Error; err != nil {
			tx.Rollback()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if paidAmount.GreaterThan(decimal.Zero) {
		cbMethod := model.CashbookPaymentMethodCash
		if paymentMethod == model.PaymentMethodBankQR {
			cbMethod = model.CashbookPaymentMethodBankTransfer
		}

		cashTx := model.CashbookTransaction{
			TransactionType: model.CashbookTypeInflow,
			Category:        model.CashbookCategorySalesRevenue,
			Amount:          paidAmount,
			PaymentMethod:   cbMethod,
			SalesOrderID:    &orderID,
			PosSessionID:    req.PosSessionID,
			PartnerID:       req.CustomerID,
			Description:     fmt.Sprintf("Thu tiền bán hàng POS %s", orderNumber),
		}
		if err := tx.Create(&cashTx).Error; err != nil {
			tx.Rollback()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else if paidAmount.LessThan(decimal.Zero) {
		refundAmount := paidAmount.Abs()
		cashTx := model.CashbookTransaction{
			TransactionType: model.CashbookTypeOutflow,
			Category:        model.CashbookCategorySalesRevenue,
			Amount:          refundAmount,
			PaymentMethod:   model.CashbookPaymentMethodCash,
			SalesOrderID:    &orderID,
			PosSessionID:    req.PosSessionID,
			PartnerID:       req.CustomerID,
			Description:     fmt.Sprintf("Hoàn tiền trả hàng POS %s", orderNumber),
		}
		if err := tx.Create(&cashTx).Error; err != nil {
			tx.Rollback()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if req.PosSessionID != nil && *req.PosSessionID != "" {
		var posSession model.PosSession
		if err := tx.First(&posSession, "id = ?", *req.PosSessionID).Error; err == nil {
			cashAdd := decimal.Zero
			bankAdd := decimal.Zero
			if paymentMethod == model.PaymentMethodBankQR {
				bankAdd = paidAmount
			} else {
				cashAdd = paidAmount
			}
			_ = tx.Model(&posSession).Updates(map[string]interface{}{
				"total_sales_amount":   gorm.Expr("total_sales_amount + ?", totalAmount),
				"total_cash_collected": gorm.Expr("total_cash_collected + ?", cashAdd),
				"total_bank_collected": gorm.Expr("total_bank_collected + ?", bankAdd),
			}).Error
		}
	}

	if err := tx.Commit().Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var resultOrder model.SalesOrder
	if err := s.db.Preload("Items.Variant.Product").Preload("Customer").First(&resultOrder, "id = ?", orderID).Error; err != nil {
		writeJSON(w, http.StatusCreated, salesOrder)
		return
	}

	writeJSON(w, http.StatusCreated, resultOrder)
}

// ----------------------------------------------------------------------------
// Batch Handlers & Traceability
// ----------------------------------------------------------------------------

func (s *Server) handleGetBatches(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status")))

	query := s.db.Model(&model.InventoryBatch{}).
		Preload("Variant.Product").
		Preload("Supplier")

	if q != "" {
		like := "%" + q + "%"
		query = query.Where(
			"inventory_batches.batch_code LIKE ? OR inventory_batches.notes LIKE ? OR inventory_batches.variant_id IN (SELECT pv.id FROM product_variants pv LEFT JOIN products p ON p.id = pv.product_id WHERE pv.sku LIKE ? OR pv.variant_name LIKE ? OR p.name LIKE ? OR p.code LIKE ?)",
			like, like, like, like, like, like,
		)
	}

	now := time.Now()
	expiringThreshold := now.AddDate(0, 0, 30)

	switch status {
	case "ACTIVE":
		query = query.Where("remaining_qty > 0 AND (expiry_date IS NULL OR expiry_date > ?)", now)
	case "EXPIRING_SOON":
		query = query.Where("remaining_qty > 0 AND expiry_date IS NOT NULL AND expiry_date > ? AND expiry_date <= ?", now, expiringThreshold)
	case "EXPIRED":
		query = query.Where("expiry_date IS NOT NULL AND expiry_date <= ?", now)
	case "OUT_OF_STOCK":
		query = query.Where("remaining_qty <= 0")
	}

	var batches []model.InventoryBatch
	if err := query.Order("created_at DESC").Find(&batches).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if batches == nil {
		batches = []model.InventoryBatch{}
	}
	writeJSON(w, http.StatusOK, batches)
}

func (s *Server) handleGetBatchTrace(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "batch id is required")
		return
	}

	var batch model.InventoryBatch
	if err := s.db.First(&batch, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "batch not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var movements []model.InventoryMovement
	if err := s.db.Where("batch_id = ?", id).Order("created_at DESC").Find(&movements).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if movements == nil {
		movements = []model.InventoryMovement{}
	}
	writeJSON(w, http.StatusOK, movements)
}

func (s *Server) handleUpdateBatch(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "batch id is required")
		return
	}

	var batch model.InventoryBatch
	if err := s.db.First(&batch, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "batch not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if rawNotes, ok := raw["notes"]; ok {
		var notes string
		if err := json.Unmarshal(rawNotes, &notes); err != nil {
			writeError(w, http.StatusBadRequest, "invalid notes")
			return
		}
		updates["notes"] = notes
	}

	if rawExpiry, ok := raw["expiry_date"]; ok {
		if string(rawExpiry) == "null" {
			updates["expiry_date"] = nil
		} else {
			var expiry time.Time
			if err := json.Unmarshal(rawExpiry, &expiry); err != nil {
				writeError(w, http.StatusBadRequest, "invalid expiry_date")
				return
			}
			updates["expiry_date"] = &expiry
		}
	}

	if len(updates) > 0 {
		if err := s.db.Model(&batch).Select("Notes", "ExpiryDate").Updates(updates).Error; err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if err := s.db.Preload("Variant.Product").Preload("Supplier").First(&batch, "id = ?", batch.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, batch)
}

// ----------------------------------------------------------------------------
// Storage & Presigned Upload Handlers
// ----------------------------------------------------------------------------

type PresignedUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
}

func (s *Server) handleGetPresignedUploadURL(w http.ResponseWriter, r *http.Request) {
	if s.storageService == nil {
		writeError(w, http.StatusServiceUnavailable, "dịch vụ lưu trữ chưa được khởi tạo")
		return
	}

	var req PresignedUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "JSON không hợp lệ")
		return
	}

	res, err := s.storageService.GetPresignedUploadURL(r.Context(), req.Filename, req.ContentType)
	if err != nil {
		if errors.Is(err, service.ErrInvalidContentType) || errors.Is(err, service.ErrMissingFilename) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, res)
}


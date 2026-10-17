package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

func (s *Server) handleGetProductDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "product id is required")
		return
	}

	var product model.Product
	err := s.db.
		Preload("Category").
		Preload("Variants.UomConversions").
		Preload("Variants.Batches").
		Preload("ModifierGroups.ModifierGroup.Items").
		First(&product, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "không tìm thấy sản phẩm")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, product)
}

type UpdateProductDTO struct {
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
	UomConversions    []CreateUomConversionDTO `json:"uom_conversions"`
	Variants          []model.ProductVariant   `json:"variants"`
	ModifierGroupIDs  []string                 `json:"modifier_group_ids"`
}

func (s *Server) handleUpdateProduct(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "product id is required")
		return
	}

	var input UpdateProductDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var product model.Product
	if err := s.db.First(&product, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "không tìm thấy sản phẩm")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if input.BaseUom != "" {
		ensureUnitExists(s.db, input.BaseUom)
	}
	for _, u := range input.UomConversions {
		ensureUnitExists(s.db, u.UomName)
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{}
		if input.Name != "" {
			updates["name"] = strings.TrimSpace(input.Name)
		}
		if input.Code != "" {
			updates["code"] = strings.ToUpper(strings.TrimSpace(input.Code))
		}
		if input.CategoryID != "" {
			updates["category_id"] = input.CategoryID
		}
		if input.ProductType != "" {
			updates["product_type"] = input.ProductType
		}
		if input.Archetype != "" {
			updates["archetype"] = input.Archetype
		}
		if input.BaseUom != "" {
			updates["base_uom"] = strings.TrimSpace(input.BaseUom)
		}
		updates["is_weighable"] = input.IsWeighable
		if input.TrackInventory != nil {
			updates["track_inventory"] = *input.TrackInventory
		}
		updates["track_batches"] = input.TrackBatches
		updates["shelf_life_days"] = input.ShelfLifeDays
		updates["expiry_warning_days"] = input.ExpiryWarningDays
		if input.ProductionMode != "" {
			updates["production_mode"] = input.ProductionMode
		}
		if input.ImageURL != "" {
			updates["image_url"] = input.ImageURL
		}

		if err := tx.Model(&product).Updates(updates).Error; err != nil {
			return err
		}

		// Update or sync single-variant pricing if standard archetype
		if len(input.Variants) == 0 && (input.BaseSellingPrice.GreaterThan(decimal.Zero) || input.CostPrice.GreaterThan(decimal.Zero)) {
			var firstVar model.ProductVariant
			if err := tx.Where("product_id = ?", id).First(&firstVar).Error; err == nil {
				vUpdates := map[string]interface{}{
					"base_selling_price": input.BaseSellingPrice,
					"cost_price":         input.CostPrice,
					"min_selling_price":  input.MinSellingPrice,
				}
				if input.ImageURL != "" {
					vUpdates["image_url"] = input.ImageURL
				}
				_ = tx.Model(&firstVar).Updates(vUpdates).Error

				// Update conversions
				if len(input.UomConversions) > 0 {
					_ = tx.Where("variant_id = ?", firstVar.ID).Delete(&model.UomConversion{}).Error
					for _, u := range input.UomConversions {
						conv := model.UomConversion{
							ID:                 uuid.New().String(),
							VariantID:          firstVar.ID,
							UomName:            u.UomName,
							ConversionFactor:   u.ConversionFactor,
							IsVariableRatio:    u.IsVariableRatio,
							DefaultPriceForUom: u.DefaultPriceForUom,
							Barcode:            u.Barcode,
							SellingPrice:       u.SellingPrice,
						}
						_ = tx.Create(&conv).Error
					}
				}
			}
		} else if len(input.Variants) > 0 {
			// Update explicit variants
			for _, iv := range input.Variants {
				if iv.ID != "" {
					var existingVar model.ProductVariant
					if err := tx.Where("id = ? AND product_id = ?", iv.ID, id).First(&existingVar).Error; err == nil {
						vUpdates := map[string]interface{}{
							"sku":                 iv.Sku,
							"variant_name":        iv.VariantName,
							"base_selling_price":  iv.BaseSellingPrice,
							"cost_price":          iv.CostPrice,
							"min_selling_price":   iv.MinSellingPrice,
							"image_url":           iv.ImageURL,
							"shelf_life_days":     iv.ShelfLifeDays,
							"expiry_warning_days": iv.ExpiryWarningDays,
						}
						if iv.Barcode != nil {
							vUpdates["barcode"] = iv.Barcode
						}
						_ = tx.Model(&existingVar).Updates(vUpdates).Error
					}
				} else {
					iv.ID = uuid.New().String()
					iv.ProductID = id
					_ = tx.Create(&iv).Error
				}
			}
		}

		// Link Modifier Groups if provided
		if len(input.ModifierGroupIDs) > 0 {
			_ = tx.Where("product_id = ?", id).Delete(&model.ProductModifierGroup{}).Error
			for orderIdx, mgID := range input.ModifierGroupIDs {
				pmg := model.ProductModifierGroup{
					ID:              uuid.New().String(),
					ProductID:       id,
					ModifierGroupID: mgID,
					DisplayOrder:    orderIdx,
				}
				_ = tx.Create(&pmg).Error
			}
		}

		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var updated model.Product
	_ = s.db.Preload("Category").Preload("Variants.UomConversions").First(&updated, "id = ?", id)
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "product id is required")
		return
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// Delete conversions
		var variantIDs []string
		tx.Model(&model.ProductVariant{}).Where("product_id = ?", id).Pluck("id", &variantIDs)
		if len(variantIDs) > 0 {
			tx.Where("variant_id IN ?", variantIDs).Delete(&model.UomConversion{})
			tx.Where("product_id = ?", id).Delete(&model.ProductVariant{})
		}
		return tx.Where("id = ?", id).Delete(&model.Product{}).Error
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "xóa sản phẩm thành công",
	})
}

// ----------------------------------------------------------------------------
// Modifier Groups Handlers (F&B Toppings & Options)
// ----------------------------------------------------------------------------

type CreateModifierGroupDTO struct {
	Name         string              `json:"name"`
	MinSelection int                 `json:"min_selection"`
	MaxSelection *int                `json:"max_selection"`
	IsRequired   bool                `json:"is_required"`
	Items        []model.ModifierItem `json:"items"`
}

func (s *Server) handleGetModifierGroups(w http.ResponseWriter, r *http.Request) {
	var groups []model.ModifierGroup
	if err := s.db.Preload("Items.LinkedVariant").Order("created_at desc").Find(&groups).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, groups)
}

func (s *Server) handleCreateModifierGroup(w http.ResponseWriter, r *http.Request) {
	var input CreateModifierGroupDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if strings.TrimSpace(input.Name) == "" {
		writeError(w, http.StatusBadRequest, "tên nhóm topping/món kèm không được để trống")
		return
	}

	grpID := uuid.New().String()
	group := model.ModifierGroup{
		ID:           grpID,
		Name:         strings.TrimSpace(input.Name),
		MinSelection: input.MinSelection,
		MaxSelection: input.MaxSelection,
		IsRequired:   input.IsRequired,
	}

	for _, it := range input.Items {
		group.Items = append(group.Items, model.ModifierItem{
			ID:              uuid.New().String(),
			ModifierGroupID: grpID,
			Name:            strings.TrimSpace(it.Name),
			Price:           it.Price,
			LinkedVariantID: it.LinkedVariantID,
			DeductQty:       it.DeductQty,
		})
	}

	if err := s.db.Create(&group).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, group)
}

func (s *Server) handleUpdateModifierGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	var input CreateModifierGroupDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var group model.ModifierGroup
	if err := s.db.First(&group, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusNotFound, "không tìm thấy nhóm đồ kèm")
		return
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"name":          strings.TrimSpace(input.Name),
			"min_selection": input.MinSelection,
			"max_selection": input.MaxSelection,
			"is_required":   input.IsRequired,
		}
		if err := tx.Model(&group).Updates(updates).Error; err != nil {
			return err
		}

		if len(input.Items) > 0 {
			_ = tx.Where("modifier_group_id = ?", id).Delete(&model.ModifierItem{}).Error
			for _, it := range input.Items {
				item := model.ModifierItem{
					ID:              uuid.New().String(),
					ModifierGroupID: id,
					Name:            strings.TrimSpace(it.Name),
					Price:           it.Price,
					LinkedVariantID: it.LinkedVariantID,
					DeductQty:       it.DeductQty,
				}
				if err := tx.Create(&item).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var res model.ModifierGroup
	_ = s.db.Preload("Items.LinkedVariant").First(&res, "id = ?", id)
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleDeleteModifierGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := s.db.Where("id = ?", id).Delete(&model.ModifierGroup{}).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "xóa nhóm đồ kèm thành công",
	})
}

func (s *Server) handleGetProductModifiers(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "product id is required")
		return
	}

	var pmg []model.ProductModifierGroup
	if err := s.db.Preload("ModifierGroup.Items.LinkedVariant").Where("product_id = ?", id).Order("display_order asc").Find(&pmg).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	groups := make([]model.ModifierGroup, 0, len(pmg))
	for _, p := range pmg {
		if p.ModifierGroup != nil {
			groups = append(groups, *p.ModifierGroup)
		}
	}

	writeJSON(w, http.StatusOK, groups)
}

func (s *Server) handleSetProductModifiers(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "product id is required")
		return
	}

	var input struct {
		ModifierGroupIDs []string `json:"modifier_group_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("product_id = ?", id).Delete(&model.ProductModifierGroup{}).Error; err != nil {
			return err
		}
		for idx, mgID := range input.ModifierGroupIDs {
			pmg := model.ProductModifierGroup{
				ID:              uuid.New().String(),
				ProductID:       id,
				ModifierGroupID: mgID,
				DisplayOrder:    idx,
			}
			if err := tx.Create(&pmg).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "cập nhật nhóm đồ kèm cho sản phẩm thành công",
	})
}

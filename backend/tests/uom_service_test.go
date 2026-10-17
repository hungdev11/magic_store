package tests

import (
	"context"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
	"magic_store/backend/internal/service"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	err = db.AutoMigrate(
		&model.Category{},
		&model.Product{},
		&model.ProductVariant{},
		&model.UomConversion{},
		&model.Unit{},
		&model.Partner{},
		&model.InventoryBatch{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	cat := &model.Category{ID: "cat_main", Name: "Main Category", Code: "CAT_MAIN"}
	db.Create(cat)

	pBeer := &model.Product{
		ID:          "p_beer",
		Name:        "Bia Saigon Chill",
		Code:        "P_BEER",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "Lon",
		IsWeighable: false,
	}
	pFish := &model.Product{
		ID:          "p_fish",
		Name:        "Cá Điêu Hồng",
		Code:        "P_FISH",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	pBeef := &model.Product{
		ID:          "p_beef",
		Name:        "Thịt Bò Mỹ",
		Code:        "P_BEEF",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeRawMaterial,
		BaseUom:     "kg",
		IsWeighable: true,
	}
	pPen := &model.Product{
		ID:          "p_pen",
		Name:        "Bút Bi Thiên Long",
		Code:        "P_PEN",
		CategoryID:  cat.ID,
		ProductType: model.ProductTypeFinishedGood,
		BaseUom:     "Cái",
		IsWeighable: false,
	}
	db.Create(pBeer)
	db.Create(pFish)
	db.Create(pBeef)
	db.Create(pPen)

	vBeer := &model.ProductVariant{
		ID:               "v_beer",
		ProductID:        pBeer.ID,
		Sku:              "SKU-BEER",
		VariantName:      "Bia Saigon 330ml",
		BaseSellingPrice: decimal.NewFromInt(12000),
		MinSellingPrice:  decimal.NewFromInt(10000),
		CostPrice:        decimal.NewFromInt(9000),
		CurrentStock:     decimal.NewFromInt(240),
	}
	vFish := &model.ProductVariant{
		ID:               "v_fish",
		ProductID:        pFish.ID,
		Sku:              "SKU-FISH",
		VariantName:      "Cá Điêu Hồng Sống",
		BaseSellingPrice: decimal.NewFromInt(70000),
		MinSellingPrice:  decimal.NewFromInt(60000),
		CostPrice:        decimal.NewFromInt(50000),
		CurrentStock:     decimal.NewFromInt(50),
	}
	vBeef := &model.ProductVariant{
		ID:               "v_beef",
		ProductID:        pBeef.ID,
		Sku:              "SKU-BEEF",
		VariantName:      "Ba Chỉ Bò Mỹ",
		BaseSellingPrice: decimal.NewFromInt(220000),
		MinSellingPrice:  decimal.NewFromInt(190000),
		CostPrice:        decimal.NewFromInt(160000),
		CurrentStock:     decimal.NewFromInt(30),
	}
	vPen := &model.ProductVariant{
		ID:               "v_pen",
		ProductID:        pPen.ID,
		Sku:              "SKU-PEN",
		VariantName:      "Bút Bi Xanh",
		BaseSellingPrice: decimal.NewFromInt(5000),
		MinSellingPrice:  decimal.NewFromInt(4000),
		CostPrice:        decimal.NewFromInt(3000),
		CurrentStock:     decimal.NewFromInt(100),
	}
	db.Create(vBeer)
	db.Create(vFish)
	db.Create(vBeef)
	db.Create(vPen)

	beerCartonPrice := decimal.NewFromInt(280000)
	cBeerCarton := &model.UomConversion{
		ID:                 "c_beer_carton",
		VariantID:          vBeer.ID,
		UomName:            "Thùng",
		ConversionFactor:   decimal.NewFromInt(24),
		IsVariableRatio:    false,
		DefaultPriceForUom: &beerCartonPrice,
	}
	cFishPiece := &model.UomConversion{
		ID:               "c_fish_piece",
		VariantID:        vFish.ID,
		UomName:          "Con",
		ConversionFactor: decimal.NewFromFloat(1.2),
		IsVariableRatio:  true,
	}
	db.Create(cBeerCarton)
	db.Create(cFishPiece)

	beefTrayPrice := decimal.NewFromInt(110000)
	cBeefTray := &model.UomConversion{
		ID:                 "c_beef_tray",
		VariantID:          vBeef.ID,
		UomName:            "Khay",
		ConversionFactor:   decimal.NewFromFloat(0.5),
		IsVariableRatio:    false,
		DefaultPriceForUom: &beefTrayPrice,
	}
	db.Create(cBeefTray)

	return db
}

func TestUOMService_FixedConversion(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	// 1. ToBaseQty: 2 Thùng -> 48 Lon
	baseQty, err := svc.ToBaseQty(ctx, nil, service.ToBaseQtyParams{
		VariantID: "v_beer",
		InputUOM:  "Thùng",
		InputQty:  decimal.NewFromInt(2),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !baseQty.Equal(decimal.NewFromInt(48)) {
		t.Fatalf("expected 48, got %s", baseQty.String())
	}

	// 2. ToBaseQty: same base UOM -> identity
	baseQty, err = svc.ToBaseQty(ctx, nil, service.ToBaseQtyParams{
		VariantID: "v_beer",
		InputUOM:  "Lon",
		InputQty:  decimal.NewFromInt(12),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !baseQty.Equal(decimal.NewFromInt(12)) {
		t.Fatalf("expected 12, got %s", baseQty.String())
	}

	// 3. FromBaseQty: 48 Lon -> 2 Thùng
	targetQty, err := svc.FromBaseQty(ctx, nil, service.FromBaseQtyParams{
		VariantID: "v_beer",
		TargetUOM: "Thùng",
		BaseQty:   decimal.NewFromInt(48),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !targetQty.Equal(decimal.NewFromInt(2)) {
		t.Fatalf("expected 2, got %s", targetQty.String())
	}

	// 4. FromBaseQty: same base UOM -> identity
	targetQty, err = svc.FromBaseQty(ctx, nil, service.FromBaseQtyParams{
		VariantID: "v_beer",
		TargetUOM: "Lon",
		BaseQty:   decimal.NewFromInt(24),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !targetQty.Equal(decimal.NewFromInt(24)) {
		t.Fatalf("expected 24, got %s", targetQty.String())
	}
}

func TestUOMService_VariableRatioValidation(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	// Missing actual weight on ToBaseQty -> ErrVariableRatioWeightRequired
	_, err := svc.ToBaseQty(ctx, nil, service.ToBaseQtyParams{
		VariantID: "v_fish",
		InputUOM:  "Con",
		InputQty:  decimal.NewFromInt(1),
	})
	if !errors.Is(err, service.ErrVariableRatioWeightRequired) {
		t.Fatalf("expected ErrVariableRatioWeightRequired, got %v", err)
	}

	// Missing actual weight on CalculateLinePrice -> ErrVariableRatioWeightRequired
	_, err = svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID: "v_fish",
		SoldUOM:   "Con",
		SoldQty:   decimal.NewFromInt(1),
	})
	if !errors.Is(err, service.ErrVariableRatioWeightRequired) {
		t.Fatalf("expected ErrVariableRatioWeightRequired, got %v", err)
	}
}

func TestUOMService_VariableRatioWithWeight(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	weight := decimal.NewFromFloat(1.35)
	baseQty, err := svc.ToBaseQty(ctx, nil, service.ToBaseQtyParams{
		VariantID:    "v_fish",
		InputUOM:     "Con",
		InputQty:     decimal.NewFromInt(1),
		ActualWeight: &weight,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !baseQty.Equal(weight) {
		t.Fatalf("expected %s, got %s", weight.String(), baseQty.String())
	}
}

func TestUOMService_MinPriceViolation(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	// Base UOM below min price (9000 < 10000)
	overridePrice := decimal.NewFromInt(9000)
	_, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID:         "v_beer",
		SoldUOM:           "Lon",
		SoldQty:           decimal.NewFromInt(5),
		OverrideUnitPrice: &overridePrice,
	})
	if !errors.Is(err, service.ErrMinPriceViolation) {
		t.Fatalf("expected ErrMinPriceViolation, got %v", err)
	}

	// Converted UOM below scaled min price (230000 < 24 * 10000 = 240000)
	cartonOverride := decimal.NewFromInt(230000)
	_, err = svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID:         "v_beer",
		SoldUOM:           "Thùng",
		SoldQty:           decimal.NewFromInt(1),
		OverrideUnitPrice: &cartonOverride,
	})
	if !errors.Is(err, service.ErrMinPriceViolation) {
		t.Fatalf("expected ErrMinPriceViolation, got %v", err)
	}

	// Below min price allowed when AllowBelowMinPrice = true
	res, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID:          "v_beer",
		SoldUOM:            "Lon",
		SoldQty:            decimal.NewFromInt(5),
		OverrideUnitPrice:  &overridePrice,
		AllowBelowMinPrice: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.UnitPrice.Equal(overridePrice) {
		t.Fatalf("expected unit price %s, got %s", overridePrice.String(), res.UnitPrice.String())
	}
	if !res.LineTotal.Equal(decimal.NewFromInt(45000)) {
		t.Fatalf("expected line total 45000, got %s", res.LineTotal.String())
	}
	if !res.IsPriceOverridden {
		t.Fatalf("expected IsPriceOverridden true")
	}
}

func TestUOMService_CalculateLinePrice(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	// 1. Fixed conversion UOM: 2 Thùng -> unit_price 280000, line_total 560000, actual_deducted_qty 48
	resBeer, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID: "v_beer",
		SoldUOM:   "Thùng",
		SoldQty:   decimal.NewFromInt(2),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resBeer.UnitPrice.Equal(decimal.NewFromInt(280000)) {
		t.Fatalf("expected unit price 280000, got %s", resBeer.UnitPrice.String())
	}
	if !resBeer.LineTotal.Equal(decimal.NewFromInt(560000)) {
		t.Fatalf("expected line total 560000, got %s", resBeer.LineTotal.String())
	}
	if !resBeer.ActualDeductedQty.Equal(decimal.NewFromInt(48)) {
		t.Fatalf("expected deducted qty 48, got %s", resBeer.ActualDeductedQty.String())
	}
	if resBeer.IsPriceOverridden {
		t.Fatalf("expected IsPriceOverridden false")
	}

	// 2. Base UOM discrete item: 10 Cái -> unit_price 5000, line_total 50000, actual_deducted_qty 10
	resPen, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID: "v_pen",
		SoldUOM:   "Cái",
		SoldQty:   decimal.NewFromInt(10),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resPen.UnitPrice.Equal(decimal.NewFromInt(5000)) {
		t.Fatalf("expected unit price 5000, got %s", resPen.UnitPrice.String())
	}
	if !resPen.LineTotal.Equal(decimal.NewFromInt(50000)) {
		t.Fatalf("expected line total 50000, got %s", resPen.LineTotal.String())
	}
	if !resPen.ActualDeductedQty.Equal(decimal.NewFromInt(10)) {
		t.Fatalf("expected deducted qty 10, got %s", resPen.ActualDeductedQty.String())
	}

	// 3. Catch-weight variable-ratio: 1 Con, weight 1.45 kg -> unit_price 70000, line_total 101500, deducted 1.45
	fishWeight := decimal.NewFromFloat(1.45)
	resFish, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID:     "v_fish",
		SoldUOM:       "Con",
		SoldQty:       decimal.NewFromInt(1),
		ActualBaseQty: &fishWeight,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resFish.UnitPrice.Equal(decimal.NewFromInt(70000)) {
		t.Fatalf("expected unit price 70000, got %s", resFish.UnitPrice.String())
	}
	if !resFish.ActualDeductedQty.Equal(fishWeight) {
		t.Fatalf("expected deducted qty %s, got %s", fishWeight.String(), resFish.ActualDeductedQty.String())
	}
	if !resFish.LineTotal.Equal(decimal.NewFromInt(101500)) {
		t.Fatalf("expected line total 101500, got %s", resFish.LineTotal.String())
	}

	// 4. Weighable base UOM: 2.5 kg -> unit_price 220000, line_total 550000, deducted 2.5
	resBeef, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID: "v_beef",
		SoldUOM:   "kg",
		SoldQty:   decimal.NewFromFloat(2.5),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resBeef.UnitPrice.Equal(decimal.NewFromInt(220000)) {
		t.Fatalf("expected unit price 220000, got %s", resBeef.UnitPrice.String())
	}
	if !resBeef.ActualDeductedQty.Equal(decimal.NewFromFloat(2.5)) {
		t.Fatalf("expected deducted qty 2.5, got %s", resBeef.ActualDeductedQty.String())
	}
	if !resBeef.LineTotal.Equal(decimal.NewFromInt(550000)) {
		t.Fatalf("expected line total 550000, got %s", resBeef.LineTotal.String())
	}

	// 5. Variant not found
	_, err = svc.ToBaseQty(ctx, nil, service.ToBaseQtyParams{
		VariantID: "v_non_existent",
		InputUOM:  "Lon",
		InputQty:  decimal.NewFromInt(1),
	})
	if !errors.Is(err, service.ErrVariantNotFound) {
		t.Fatalf("expected ErrVariantNotFound, got %v", err)
	}

	// 6. Conversion not found
	_, err = svc.ToBaseQty(ctx, nil, service.ToBaseQtyParams{
		VariantID: "v_beer",
		InputUOM:  "Ket",
		InputQty:  decimal.NewFromInt(1),
	})
	if !errors.Is(err, service.ErrConversionNotFound) {
		t.Fatalf("expected ErrConversionNotFound, got %v", err)
	}
}

func TestUOMService_WeighableProductFixedSecondaryUOM(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	// Pre-packaged 0.5kg beef tray sold at 110,000 VND/tray, 2 trays -> line total = 220,000 VND, actual deducted = 1.0 kg
	res, err := svc.CalculateLinePrice(ctx, nil, service.CalculateLinePriceParams{
		VariantID: "v_beef",
		SoldUOM:   "Khay",
		SoldQty:   decimal.NewFromInt(2),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.UnitPrice.Equal(decimal.NewFromInt(110000)) {
		t.Fatalf("expected unit price 110000, got %s", res.UnitPrice.String())
	}
	if !res.LineTotal.Equal(decimal.NewFromInt(220000)) {
		t.Fatalf("expected line total 220000, got %s", res.LineTotal.String())
	}
	if !res.ActualDeductedQty.Equal(decimal.NewFromFloat(1.0)) {
		t.Fatalf("expected deducted qty 1.0, got %s", res.ActualDeductedQty.String())
	}
	if res.IsPriceOverridden {
		t.Fatalf("expected IsPriceOverridden false")
	}
}

func TestUOMService_ZeroConversionFactor(t *testing.T) {
	db := setupTestDB(t)
	svc := service.NewUOMService(db)
	ctx := context.Background()

	cZero := &model.UomConversion{
		ID:               "c_beer_zero",
		VariantID:        "v_beer",
		UomName:          "ZeroBox",
		ConversionFactor: decimal.Zero,
		IsVariableRatio:  false,
	}
	if err := db.Create(cZero).Error; err != nil {
		t.Fatalf("failed to insert zero conversion: %v", err)
	}

	_, err := svc.FromBaseQty(ctx, nil, service.FromBaseQtyParams{
		VariantID: "v_beer",
		TargetUOM: "ZeroBox",
		BaseQty:   decimal.NewFromInt(10),
	})
	if !errors.Is(err, service.ErrInvalidConversionFactor) {
		t.Fatalf("expected ErrInvalidConversionFactor, got %v", err)
	}
}

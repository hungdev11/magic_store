package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

func d(val float64) decimal.Decimal {
	return decimal.NewFromFloat(val)
}

func ptrString(s string) *string {
	return &s
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func ptrDecimal(val float64) *decimal.Decimal {
	dec := decimal.NewFromFloat(val)
	return &dec
}

func ptrInt(i int) *int {
	return &i
}

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

	fmt.Println("Migrating database schema...")
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
		log.Fatalf("failed to auto-migrate: %v", err)
	}

	fmt.Println("Cleaning existing records for fresh seed...")
	db.Exec("DELETE FROM cashbook_transactions")
	db.Exec("DELETE FROM debt_ledgers")
	db.Exec("DELETE FROM sales_order_items")
	db.Exec("DELETE FROM sales_orders")
	db.Exec("DELETE FROM pos_sessions")
	db.Exec("DELETE FROM stock_transfer_items")
	db.Exec("DELETE FROM stock_transfers")
	db.Exec("DELETE FROM inventory_movements")
	db.Exec("DELETE FROM inventory_batches")
	db.Exec("DELETE FROM warehouse_stock_balances")
	db.Exec("DELETE FROM warehouse_stocks")
	db.Exec("DELETE FROM production_orders")
	db.Exec("DELETE FROM bom_items")
	db.Exec("DELETE FROM bom_recipes")
	db.Exec("DELETE FROM product_modifier_groups")
	db.Exec("DELETE FROM modifier_items")
	db.Exec("DELETE FROM modifier_groups")
	db.Exec("DELETE FROM uom_conversions")
	db.Exec("DELETE FROM product_variants")
	db.Exec("DELETE FROM products")
	db.Exec("DELETE FROM categories")
	db.Exec("DELETE FROM units")
	db.Exec("DELETE FROM partners")
	db.Exec("DELETE FROM warehouses")
	db.Exec("DELETE FROM store_settings")

	now := time.Now()

	// 1. Store Setting
	fmt.Println("Seeding Store Setting...")
	setting := model.StoreSetting{
		ID:             uuid.New().String(),
		Name:           "Magic Store - Siêu Thị & Bán Lẻ Đa Ngành",
		Currency:       "VND",
		CostingMethod:  "WAC",
		EnabledModules: "{}",
	}
	db.Create(&setting)

	// 2. Warehouses (3 chi nhánh)
	fmt.Println("Seeding Warehouses...")
	whMain := model.Warehouse{
		ID:        uuid.New().String(),
		Code:      "KHO_TONG",
		Name:      "Kho Tổng (Mặc định)",
		Type:      model.WarehouseTypeStorage,
		Address:   "128 Lê Duẩn, Quận 1, TP.HCM",
		IsActive:  true,
		IsDefault: true,
	}
	whBranch1 := model.Warehouse{
		ID:        uuid.New().String(),
		Code:      "CN_QUAN3",
		Name:      "Điểm Bán Chi Nhánh Quận 3",
		Type:      model.WarehouseTypeRetailPos,
		Address:   "45 Nguyễn Đình Chiểu, Quận 3, TP.HCM",
		IsActive:  true,
		IsDefault: false,
	}
	whBranch2 := model.Warehouse{
		ID:        uuid.New().String(),
		Code:      "CN_BINHTHANH",
		Name:      "Kho Phân Phối Bình Thạnh",
		Type:      model.WarehouseTypeStorage,
		Address:   "78 Điện Biên Phủ, Bình Thạnh, TP.HCM",
		IsActive:  true,
		IsDefault: false,
	}
	db.Create(&whMain)
	db.Create(&whBranch1)
	db.Create(&whBranch2)

	// 3. Units (Đơn vị tính)
	fmt.Println("Seeding Units...")
	unitsList := []struct {
		code, name string
	}{
		{"LON", "lon"},
		{"THUNG", "thùng"},
		{"LOC", "lốc"},
		{"CHAI", "chai"},
		{"CAI", "cái"},
		{"KG", "kg"},
		{"G", "g"},
		{"HOP", "hộp"},
		{"GOI", "gói"},
		{"LY", "ly"},
		{"CON", "con"},
		{"DON", "đòn"},
		{"PHAN", "phần"},
		{"LIT", "lít"},
		{"ML", "ml"},
	}
	for _, u := range unitsList {
		db.Create(&model.Unit{
			ID:       uuid.New().String(),
			Code:     u.code,
			Name:     u.name,
			IsActive: true,
		})
	}

	// 4. Categories (Có phân cấp Cha - Con)
	fmt.Println("Seeding Categories (Hierarchical Parent-Child)...")
	catDrink := model.Category{ID: uuid.New().String(), Code: "DO_UONG", Name: "Đồ Uống & Nước Giải Khát"}
	catFresh := model.Category{ID: uuid.New().String(), Code: "TUOI_SONG", Name: "Thực Phẩm Tươi Sống"}
	catFashion := model.Category{ID: uuid.New().String(), Code: "THOI_TRANG", Name: "Thời Trang & May Mặc"}
	catFnb := model.Category{ID: uuid.New().String(), Code: "FNB_CHE_BIEN", Name: "F&B & Món Chế Biến"}
	catRaw := model.Category{ID: uuid.New().String(), Code: "NGUYEN_LIEU", Name: "Nguyên Vật Liệu & Topping"}
	db.Create(&catDrink)
	db.Create(&catFresh)
	db.Create(&catFashion)
	db.Create(&catFnb)
	db.Create(&catRaw)

	catBeer := model.Category{ID: uuid.New().String(), Code: "BIA_CON", Name: "Bia & Đồ Uống Có Cồn", ParentID: &catDrink.ID}
	catSoda := model.Category{ID: uuid.New().String(), Code: "NUOC_NGOT", Name: "Nước Ngọt & Đóng Chai", ParentID: &catDrink.ID}
	catFish := model.Category{ID: uuid.New().String(), Code: "HAI_SAN", Name: "Cá & Thủy Hải Sản", ParentID: &catFresh.ID}
	catPolo := model.Category{ID: uuid.New().String(), Code: "AO_NAM_NU", Name: "Áo Polo & Áo Thun", ParentID: &catFashion.ID}
	catMilktea := model.Category{ID: uuid.New().String(), Code: "TRA_SUA", Name: "Trà Sữa & Cà Phê", ParentID: &catFnb.ID}
	catFastfood := model.Category{ID: uuid.New().String(), Code: "BANH_MI", Name: "Bánh Mì & Điểm Tâm", ParentID: &catFnb.ID}
	catCombo := model.Category{ID: uuid.New().String(), Code: "COMBO_SET", Name: "Combo & Suất Ăn Tiết Kiệm", ParentID: &catFnb.ID}
	catTopping := model.Category{ID: uuid.New().String(), Code: "TOPPING_FNB", Name: "Topping Pha Chế", ParentID: &catRaw.ID}
	db.Create(&catBeer)
	db.Create(&catSoda)
	db.Create(&catFish)
	db.Create(&catPolo)
	db.Create(&catMilktea)
	db.Create(&catFastfood)
	db.Create(&catCombo)
	db.Create(&catTopping)

	// 5. Partners (Customers & Suppliers)
	fmt.Println("Seeding Partners (CRM & Sổ Nợ)...")
	custLe := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeCustomer,
		Name:               "Khách Lẻ (Vãng Lai)",
		PriceTier:          "RETAIL",
		CurrentDebtBalance: d(0),
		CreditLimit:        d(0),
		IsActive:           true,
	}
	custTuan := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeCustomer,
		Name:               "Anh Tuấn (Khách VIP)",
		Phone:              ptrString("0908123456"),
		Address:            ptrString("12 Cao Thắng, Quận 3"),
		PriceTier:          "RETAIL",
		CurrentDebtBalance: d(0),
		CreditLimit:        d(10000000),
		IsActive:           true,
	}
	custMai := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeCustomer,
		Name:               "Chị Mai (Khách quen mua nợ)",
		Phone:              ptrString("0912345678"),
		Address:            ptrString("88 Hai Bà Trưng, Quận 1"),
		PriceTier:          "RETAIL",
		CurrentDebtBalance: d(1250000),
		CreditLimit:        d(5000000),
		IsActive:           true,
	}
	custHoangYen := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeCustomer,
		Name:               "Nhà Hàng Hoàng Yến (Khách buôn)",
		Phone:              ptrString("02838999888"),
		Address:            ptrString("148 Nguyễn Du, Quận 1"),
		PriceTier:          "WHOLESALE",
		CurrentDebtBalance: d(4800000),
		CreditLimit:        d(20000000),
		IsActive:           true,
	}

	suppHeineken := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeSupplier,
		Name:               "Tổng Đại Lý Bia & Nước Giải Khát Miền Nam",
		Phone:              ptrString("02838112233"),
		Address:            ptrString("KCN Tân Bình, Tân Phú, TP.HCM"),
		CurrentDebtBalance: d(12500000),
		IsActive:           true,
	}
	suppSeafood := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeSupplier,
		Name:               "Hợp Tác Xã Đánh Bắt Thủy Sản Cần Giờ",
		Phone:              ptrString("0933112244"),
		Address:            ptrString("Cảng Cá Cần Giờ, TP.HCM"),
		CurrentDebtBalance: d(8200000),
		IsActive:           true,
	}
	suppFashion := model.Partner{
		ID:                 uuid.New().String(),
		PartnerType:        model.PartnerTypeSupplier,
		Name:               "Xưởng May Dệt May Phú Thọ",
		Phone:              ptrString("0977889900"),
		Address:            ptrString("Tân Bình, TP.HCM"),
		CurrentDebtBalance: d(0),
		IsActive:           true,
	}

	db.Create(&custLe)
	db.Create(&custTuan)
	db.Create(&custMai)
	db.Create(&custHoangYen)
	db.Create(&suppHeineken)
	db.Create(&suppSeafood)
	db.Create(&suppFashion)

	// 6. Products with 4 Archetypes & Raw Materials
	fmt.Println("Seeding Products (4 Archetypes + Topping + Raw Materials)...")

	// 6.1. RAW MATERIALS (Nguyên vật liệu làm topping & BOM)
	prodTranChauSong := model.Product{
		ID:             uuid.New().String(),
		Name:           "Trân Châu Đen Sống (Túi 1kg)",
		Code:           "RAW_TRAN_CHAU",
		CategoryID:     catTopping.ID,
		ProductType:    model.ProductTypeRawMaterial,
		Archetype:      model.ProductArchetypeStandard,
		BaseUom:        "kg",
		TrackInventory: true,
		ImageURL:       "https://images.unsplash.com/photo-1558857563-b37fcbf158b4?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodTranChauSong)
	varTranChau := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodTranChauSong.ID,
		Sku:              "RAW_TRAN_CHAU_1KG",
		VariantName:      "Trân Châu Đen Sống (Túi 1kg)",
		CostPrice:        d(45000),
		BaseSellingPrice: d(65000),
		CurrentStock:     d(50),
	}
	db.Create(&varTranChau)

	prodThachPhoMai := model.Product{
		ID:             uuid.New().String(),
		Name:           "Thạch Phô Mai Tươi (Hộp 500g)",
		Code:           "RAW_PHO_MAI",
		CategoryID:     catTopping.ID,
		ProductType:    model.ProductTypeRawMaterial,
		Archetype:      model.ProductArchetypeStandard,
		BaseUom:        "hộp",
		TrackInventory: true,
	}
	db.Create(&prodThachPhoMai)
	varThachPhoMai := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodThachPhoMai.ID,
		Sku:              "RAW_PHO_MAI_500G",
		VariantName:      "Thạch Phô Mai Tươi (Hộp 500g)",
		CostPrice:        d(35000),
		BaseSellingPrice: d(55000),
		CurrentStock:     d(30),
	}
	db.Create(&varThachPhoMai)

	prodPudding := model.Product{
		ID:             uuid.New().String(),
		Name:           "Bột Pudding Trứng Vàng (Gói 1kg)",
		Code:           "RAW_PUDDING",
		CategoryID:     catTopping.ID,
		ProductType:    model.ProductTypeRawMaterial,
		Archetype:      model.ProductArchetypeStandard,
		BaseUom:        "gói",
		TrackInventory: true,
	}
	db.Create(&prodPudding)
	varPudding := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodPudding.ID,
		Sku:              "RAW_PUDDING_1KG",
		VariantName:      "Bột Pudding Trứng Vàng (Gói 1kg)",
		CostPrice:        d(60000),
		BaseSellingPrice: d(85000),
		CurrentStock:     d(20),
	}
	db.Create(&varPudding)

	// 6.2. STANDARD ARCHETYPE (Đa đơn vị tính & Barcode riêng)
	prodHeineken := model.Product{
		ID:             uuid.New().String(),
		Name:           "Bia Heineken Silver 330ml",
		Code:           "BIA_HEINEKEN",
		CategoryID:     catBeer.ID,
		ProductType:    model.ProductTypeFinishedGood,
		Archetype:      model.ProductArchetypeStandard,
		BaseUom:        "lon",
		TrackInventory: true,
		ImageURL:       "https://images.unsplash.com/photo-1608270191599-80826955df27?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodHeineken)
	varHeineken := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodHeineken.ID,
		Sku:              "BIA_HEINEKEN_LON",
		Barcode:          ptrString("893500123001"),
		VariantName:      "Bia Heineken Silver 330ml (Lon)",
		CostPrice:        d(15000),
		BaseSellingPrice: d(20000),
		MinSellingPrice:  d(18000),
		CurrentStock:     d(480), // 480 lon = 20 thùng
	}
	db.Create(&varHeineken)
	db.Create(&model.UomConversion{
		ID:               uuid.New().String(),
		VariantID:        varHeineken.ID,
		UomName:          "lốc",
		ConversionFactor: d(6),
		Barcode:          ptrString("893500123006"),
		SellingPrice:     ptrDecimal(115000),
	})
	db.Create(&model.UomConversion{
		ID:               uuid.New().String(),
		VariantID:        varHeineken.ID,
		UomName:          "thùng",
		ConversionFactor: d(24),
		Barcode:          ptrString("893500123024"),
		SellingPrice:     ptrDecimal(440000),
	})

	prodCoca := model.Product{
		ID:             uuid.New().String(),
		Name:           "Nước Ngọt Coca-Cola Vị Nguyên Bản 320ml",
		Code:           "COCA_COLA",
		CategoryID:     catSoda.ID,
		ProductType:    model.ProductTypeFinishedGood,
		Archetype:      model.ProductArchetypeStandard,
		BaseUom:        "lon",
		TrackInventory: true,
		ImageURL:       "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodCoca)
	varCoca := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodCoca.ID,
		Sku:              "COCA_COLA_LON",
		Barcode:          ptrString("893511223301"),
		VariantName:      "Coca-Cola 320ml (Lon)",
		CostPrice:        d(7500),
		BaseSellingPrice: d(10000),
		CurrentStock:     d(600),
	}
	db.Create(&varCoca)
	db.Create(&model.UomConversion{
		ID:               uuid.New().String(),
		VariantID:        varCoca.ID,
		UomName:          "thùng",
		ConversionFactor: d(24),
		Barcode:          ptrString("893511223324"),
		SellingPrice:     ptrDecimal(225000),
	})

	// 6.3. MATRIX ARCHETYPE (Thời trang Màu sắc × Kích cỡ)
	prodPolo := model.Product{
		ID:             uuid.New().String(),
		Name:           "Áo Thun Polo Nam Cotton Pique Cao Cấp",
		Code:           "AT_POLO",
		CategoryID:     catPolo.ID,
		ProductType:    model.ProductTypeFinishedGood,
		Archetype:      model.ProductArchetypeMatrix,
		BaseUom:        "cái",
		TrackInventory: true,
		ImageURL:       "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodPolo)

	poloColors := []string{"Đỏ", "Đen"}
	poloSizes := []string{"M", "L", "XL"}
	var poloVariants []model.ProductVariant

	for _, c := range poloColors {
		for _, s := range poloSizes {
			attr, _ := json.Marshal(map[string]string{"Màu": c, "Size": s})
			skuCode := fmt.Sprintf("AT_POLO_%s_%s", strings.ToUpper(c), s)
			varP := model.ProductVariant{
				ID:               uuid.New().String(),
				ProductID:        prodPolo.ID,
				Sku:              skuCode,
				Barcode:          ptrString("893600" + skuCode),
				VariantName:      fmt.Sprintf("Áo Polo Cotton (%s - Size %s)", c, s),
				Attributes:       string(attr),
				CostPrice:        d(160000),
				BaseSellingPrice: d(280000),
				MinSellingPrice:  d(240000),
				CurrentStock:     d(25),
			}
			db.Create(&varP)
			poloVariants = append(poloVariants, varP)
		}
	}

	// 6.4. CATCH_WEIGHT ARCHETYPE (Hàng tươi sống, Cân ký & Lô HSD)
	prodCaHoi := model.Product{
		ID:                uuid.New().String(),
		Name:              "Cá Hồi Nauy Tươi Nguyên Con (Catch-weight)",
		Code:              "CA_HOI_NAUY",
		CategoryID:        catFish.ID,
		ProductType:       model.ProductTypeFinishedGood,
		Archetype:         model.ProductArchetypeCatchWeight,
		BaseUom:           "kg",
		IsWeighable:       true,
		TrackInventory:    true,
		TrackBatches:      true,
		ShelfLifeDays:     ptrInt(5),
		ExpiryWarningDays: ptrInt(2),
		ImageURL:          "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodCaHoi)
	varCaHoi := model.ProductVariant{
		ID:                uuid.New().String(),
		ProductID:         prodCaHoi.ID,
		Sku:               "CA_HOI_NAUY_KG",
		Barcode:           ptrString("893700112233"),
		VariantName:       "Cá Hồi Nauy Nguyên Con (kg)",
		CostPrice:         d(280000),
		BaseSellingPrice:  d(390000),
		CurrentStock:      d(45.5),
		ShelfLifeDays:     ptrInt(5),
		ExpiryWarningDays: ptrInt(2),
	}
	db.Create(&varCaHoi)

	// Lô cá hồi: 1 lô bình thường, 1 lô cận date
	batchCaHoi1 := model.InventoryBatch{
		ID:           uuid.New().String(),
		VariantID:    varCaHoi.ID,
		WarehouseID:  &whMain.ID,
		BatchCode:    "LOT-20261016-CAHOI-01",
		SupplierID:   &suppSeafood.ID,
		ReceivedDate: now,
		ExpiryDate:   ptrTime(now.AddDate(0, 0, 5)),
		InitialQty:   d(30.0),
		RemainingQty: d(30.0),
		UnitCost:     d(280000),
	}
	batchCaHoiExpiring := model.InventoryBatch{
		ID:           uuid.New().String(),
		VariantID:    varCaHoi.ID,
		WarehouseID:  &whMain.ID,
		BatchCode:    "LOT-20261014-CAHOI-02",
		SupplierID:   &suppSeafood.ID,
		ReceivedDate: now.AddDate(0, 0, -2),
		ExpiryDate:   ptrTime(now.AddDate(0, 0, 1)), // Cận date còn 1 ngày!
		InitialQty:   d(20.0),
		RemainingQty: d(15.5),
		UnitCost:     d(280000),
	}
	db.Create(&batchCaHoi1)
	db.Create(&batchCaHoiExpiring)

	prodCaDieuHong := model.Product{
		ID:                uuid.New().String(),
		Name:              "Cá Diêu Hồng Sống Loại 1 (0.8 - 1.2kg)",
		Code:              "CA_DIEU_HONG",
		CategoryID:        catFish.ID,
		ProductType:       model.ProductTypeFinishedGood,
		Archetype:         model.ProductArchetypeCatchWeight,
		BaseUom:           "kg",
		IsWeighable:       true,
		TrackInventory:    true,
		TrackBatches:      true,
		ShelfLifeDays:     ptrInt(3),
		ExpiryWarningDays: ptrInt(1),
		ImageURL:          "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodCaDieuHong)
	varCaDieuHong := model.ProductVariant{
		ID:                uuid.New().String(),
		ProductID:         prodCaDieuHong.ID,
		Sku:               "CA_DIEU_HONG_KG",
		Barcode:           ptrString("893700445566"),
		VariantName:       "Cá Diêu Hồng Sống Loại 1",
		CostPrice:         d(55000),
		BaseSellingPrice:  d(75000),
		CurrentStock:      d(65.0),
		ShelfLifeDays:     ptrInt(3),
		ExpiryWarningDays: ptrInt(1),
	}
	db.Create(&varCaDieuHong)

	batchCaDieuHong := model.InventoryBatch{
		ID:           uuid.New().String(),
		VariantID:    varCaDieuHong.ID,
		WarehouseID:  &whMain.ID,
		BatchCode:    "LOT-20261016-CADIEU-01",
		SupplierID:   &suppSeafood.ID,
		ReceivedDate: now,
		ExpiryDate:   ptrTime(now.AddDate(0, 0, 3)),
		InitialQty:   d(65.0),
		RemainingQty: d(65.0),
		UnitCost:     d(55000),
	}
	db.Create(&batchCaDieuHong)

	// 6.5. MANUFACTURED / F&B ARCHETYPE (Sizes, Topping đồ kèm & BOM)
	prodTraSua := model.Product{
		ID:             uuid.New().String(),
		Name:           "Trà Sữa Trân Châu Đường Đen",
		Code:           "TRA_SUA_TC",
		CategoryID:     catMilktea.ID,
		ProductType:    model.ProductTypeFinishedGood,
		Archetype:      model.ProductArchetypeManufactured,
		BaseUom:        "ly",
		ProductionMode: model.ProductionModePosBackflush,
		TrackInventory: true,
		ImageURL:       "https://images.unsplash.com/photo-1558857563-b37fcbf158b4?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodTraSua)

	varTraSuaM := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodTraSua.ID,
		Sku:              "TRA_SUA_TC_M",
		Barcode:          ptrString("893800111001"),
		VariantName:      "Trà Sữa Trân Châu (Size M)",
		CostPrice:        d(12000),
		BaseSellingPrice: d(30000),
		CurrentStock:     d(100),
	}
	varTraSuaL := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodTraSua.ID,
		Sku:              "TRA_SUA_TC_L",
		Barcode:          ptrString("893800111002"),
		VariantName:      "Trà Sữa Trân Châu (Size L)",
		CostPrice:        d(16000),
		BaseSellingPrice: d(38000),
		CurrentStock:     d(100),
	}
	db.Create(&varTraSuaM)
	db.Create(&varTraSuaL)

	// F&B Modifier Group (Toppings)
	modGroupTopping := model.ModifierGroup{
		ID:           uuid.New().String(),
		Name:         "Topping / Đồ Kèm Trà Sữa",
		MinSelection: 0,
		IsRequired:   false,
	}
	db.Create(&modGroupTopping)

	db.Create(&model.ModifierItem{
		ID:              uuid.New().String(),
		ModifierGroupID: modGroupTopping.ID,
		Name:            "Trân Châu Đen Hoàng Kim",
		Price:           d(6000),
		LinkedVariantID: &varTranChau.ID,
		DeductQty:       ptrDecimal(0.05), // trừ 0.05kg trân châu sống
	})
	db.Create(&model.ModifierItem{
		ID:              uuid.New().String(),
		ModifierGroupID: modGroupTopping.ID,
		Name:            "Thạch Phô Mai Tươi",
		Price:           d(10000),
		LinkedVariantID: &varThachPhoMai.ID,
		DeductQty:       ptrDecimal(0.04), // trừ 0.04 hộp
	})
	db.Create(&model.ModifierItem{
		ID:              uuid.New().String(),
		ModifierGroupID: modGroupTopping.ID,
		Name:            "Pudding Trứng Vàng",
		Price:           d(8000),
		LinkedVariantID: &varPudding.ID,
		DeductQty:       ptrDecimal(0.05),
	})

	db.Create(&model.ProductModifierGroup{
		ID:              uuid.New().String(),
		ProductID:       prodTraSua.ID,
		ModifierGroupID: modGroupTopping.ID,
		DisplayOrder:    0,
	})

	// 6.6. BÁNH MÌ & COMBO ARCHETYPE (Backflush & Multi-item Bundling)
	prodBanhMi := model.Product{
		ID:             uuid.New().String(),
		Name:           "Bánh Mì Thịt Nguội Patê Đặc Biệt",
		Code:           "BANH_MI_THIT",
		CategoryID:     catFastfood.ID,
		ProductType:    model.ProductTypeFinishedGood,
		Archetype:      model.ProductArchetypeStandard,
		BaseUom:        "ổ",
		TrackInventory: true,
		ImageURL:       "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodBanhMi)
	varBanhMi := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodBanhMi.ID,
		Sku:              "BANH_MI_THIT_O",
		Barcode:          ptrString("893900123456"),
		VariantName:      "Bánh Mì Thịt Nguội Đặc Biệt (Ổ)",
		CostPrice:        d(12000),
		BaseSellingPrice: d(25000),
		MinSellingPrice:  d(20000),
		CurrentStock:     d(80),
	}
	db.Create(&varBanhMi)

	// Combo Bữa Sáng (Bundle: 1 Bánh Mì + 1 Coca)
	prodComboSang := model.Product{
		ID:             uuid.New().String(),
		Name:           "Combo Bữa Sáng (1 Bánh Mì Thịt + 1 Lon Coca)",
		Code:           "COMBO_SANG",
		CategoryID:     catCombo.ID,
		ProductType:    model.ProductTypeCombo,
		Archetype:      model.ProductArchetypeCombo,
		BaseUom:        "phần",
		ProductionMode: model.ProductionModePosBackflush,
		TrackInventory: false,
		ImageURL:       "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80",
	}
	db.Create(&prodComboSang)
	varComboSang := model.ProductVariant{
		ID:               uuid.New().String(),
		ProductID:        prodComboSang.ID,
		Sku:              "COMBO_SANG_PHAN",
		Barcode:          ptrString("893900999001"),
		VariantName:      "Combo Bữa Sáng Tiết Kiệm",
		CostPrice:        d(19500), // 12.000 + 7.500
		BaseSellingPrice: d(30000), // 30.000đ
		MinSellingPrice:  d(25000),
		CurrentStock:     d(0),
	}
	db.Create(&varComboSang)

	// BOM Recipe for Combo: bán 1 combo tự động trừ kho 1 bánh mì và 1 coca
	recipeCombo := model.BomRecipe{
		ID:              uuid.New().String(),
		TargetVariantID: varComboSang.ID,
		RecipeType:      model.RecipeTypeAssembly,
		OutputQty:       d(1),
		Items: []model.BomItem{
			{
				ID:                 uuid.New().String(),
				ComponentVariantID: varBanhMi.ID,
				QtyRequired:        d(1),
			},
			{
				ID:                 uuid.New().String(),
				ComponentVariantID: varCoca.ID,
				QtyRequired:        d(1),
			},
		},
	}
	db.Create(&recipeCombo)

	// 7. Warehouse Stock balances across all 3 warehouses
	fmt.Println("Seeding Warehouse Stocks...")
	allVariantsToDistribute := []struct {
		vID          string
		stockMain    float64
		stockBranch1 float64
		stockBranch2 float64
	}{
		{varHeineken.ID, 300, 100, 80},
		{varCoca.ID, 400, 120, 80},
		{varBanhMi.ID, 40, 30, 10},
		{varComboSang.ID, 0, 0, 0},
		{varCaHoi.ID, 30.5, 10.0, 5.0},
		{varCaDieuHong.ID, 45.0, 15.0, 5.0},
		{varTraSuaM.ID, 60, 40, 0},
		{varTraSuaL.ID, 60, 40, 0},
		{varTranChau.ID, 35, 15, 0},
		{varThachPhoMai.ID, 20, 10, 0},
		{varPudding.ID, 15, 5, 0},
	}

	for _, item := range allVariantsToDistribute {
		db.Create(&model.WarehouseStock{
			ID:           uuid.New().String(),
			WarehouseID:  whMain.ID,
			VariantID:    item.vID,
			CurrentStock: d(item.stockMain),
		})
		db.Create(&model.WarehouseStockBalance{
			ID:            uuid.New().String(),
			WarehouseID:   whMain.ID,
			VariantID:     item.vID,
			OnHandBaseQty: d(item.stockMain),
			Version:       1,
		})
		db.Create(&model.WarehouseStock{
			ID:           uuid.New().String(),
			WarehouseID:  whBranch1.ID,
			VariantID:    item.vID,
			CurrentStock: d(item.stockBranch1),
		})
		db.Create(&model.WarehouseStockBalance{
			ID:            uuid.New().String(),
			WarehouseID:   whBranch1.ID,
			VariantID:     item.vID,
			OnHandBaseQty: d(item.stockBranch1),
			Version:       1,
		})
		db.Create(&model.WarehouseStock{
			ID:           uuid.New().String(),
			WarehouseID:  whBranch2.ID,
			VariantID:    item.vID,
			CurrentStock: d(item.stockBranch2),
		})
		db.Create(&model.WarehouseStockBalance{
			ID:            uuid.New().String(),
			WarehouseID:   whBranch2.ID,
			VariantID:     item.vID,
			OnHandBaseQty: d(item.stockBranch2),
			Version:       1,
		})
	}

	// 8. Stock Transfers (Điều chuyển kho)
	fmt.Println("Seeding Stock Transfers...")
	transferCompleted := model.StockTransfer{
		ID:              uuid.New().String(),
		TransferNumber:  "TRF-20261015-001",
		FromWarehouseID: whMain.ID,
		ToWarehouseID:   whBranch1.ID,
		Status:          model.StockTransferStatusCompleted,
		Notes:           "Điều chuyển bia và nước ngọt phục vụ cuối tuần tại Quận 3",
		CreatedAt:       now.AddDate(0, 0, -1),
	}
	db.Create(&transferCompleted)
	db.Create(&model.StockTransferItem{
		ID:         uuid.New().String(),
		TransferID: transferCompleted.ID,
		VariantID:  varHeineken.ID,
		Qty:        d(48), // 2 thùng
		Uom:        "lon",
	})
	db.Create(&model.StockTransferItem{
		ID:         uuid.New().String(),
		TransferID: transferCompleted.ID,
		VariantID:  varCoca.ID,
		Qty:        d(48),
		Uom:        "lon",
	})

	transferInTransit := model.StockTransfer{
		ID:              uuid.New().String(),
		TransferNumber:  "TRF-20261016-002",
		FromWarehouseID: whMain.ID,
		ToWarehouseID:   whBranch2.ID,
		Status:          model.StockTransferStatusInTransit,
		Notes:           "Xe giao hàng số 51C-12345 đang trên đường sang Bình Thạnh",
		CreatedAt:       now,
	}
	db.Create(&transferInTransit)
	db.Create(&model.StockTransferItem{
		ID:         uuid.New().String(),
		TransferID: transferInTransit.ID,
		VariantID:  varHeineken.ID,
		Qty:        d(24),
		Uom:        "lon",
	})

	// 9. Purchase Invoices & Receipts (Lịch sử Nhập kho)
	fmt.Println("Seeding Purchase Invoices...")
	po1Ref := "PO-20261015-001"
	db.Create(&model.InventoryMovement{
		ID:             uuid.New().String(),
		VariantID:      varHeineken.ID,
		WarehouseID:    &whMain.ID,
		MovementType:   model.MovementTypePurchaseIn,
		QtyInBaseUom:   d(240),
		InputUom:       "thùng",
		InputQty:       d(10),
		UnitCostAtTime: d(15000),
		ReferenceID:    &po1Ref,
		ReasonNote:     ptrString("Nhập 10 thùng Heineken từ Tổng Đại Lý"),
		CreatedAt:      now.AddDate(0, 0, -1),
	})

	po2Ref := "PO-20261016-002"
	db.Create(&model.InventoryMovement{
		ID:             uuid.New().String(),
		VariantID:      varCaHoi.ID,
		WarehouseID:    &whMain.ID,
		BatchID:        &batchCaHoi1.ID,
		MovementType:   model.MovementTypePurchaseIn,
		QtyInBaseUom:   d(30),
		InputUom:       "kg",
		InputQty:       d(30),
		UnitCostAtTime: d(280000),
		ReferenceID:    &po2Ref,
		ReasonNote:     ptrString("Nhập cá hồi Nauy đánh bắt mới từ Cần Giờ"),
		CreatedAt:      now,
	})

	// 10. Wastage Movements (Xuất hủy)
	fmt.Println("Seeding Wastage Spoilage...")
	wstRef := "WST-20261015-001"
	db.Create(&model.InventoryMovement{
		ID:             uuid.New().String(),
		VariantID:      varCaDieuHong.ID,
		WarehouseID:    &whMain.ID,
		MovementType:   model.MovementTypeWastageSpoilage,
		QtyInBaseUom:   d(-3.5),
		InputUom:       "kg",
		InputQty:       d(-3.5),
		UnitCostAtTime: d(55000),
		ReferenceID:    &wstRef,
		ReasonNote:     ptrString("[Cá ngộp chết] Hỏng oxy sáng 15/10, xuất hủy"),
		CreatedAt:      now.AddDate(0, 0, -1),
	})
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeOutflow,
		Category:        model.CashbookCategoryOtherExpense,
		Amount:          d(3.5 * 55000),
		PaymentMethod:   model.CashbookPaymentMethodCash,
		Description:     "Tổn thất xuất hủy cá diêu hồng ngộp 3.5kg",
		CreatedAt:       now.AddDate(0, 0, -1),
	})

	// 11. POS Orders & Sales (Bán hàng thực tế)
	fmt.Println("Seeding Sales Orders & POS...")
	// Order 1: Khách vãng lai mua Heineken tiền mặt
	ord1 := model.SalesOrder{
		ID:            uuid.New().String(),
		OrderNumber:   "POS-261015-0001",
		CustomerID:    &custLe.ID,
		WarehouseID:   &whMain.ID,
		Status:        model.OrderStatusCompleted,
		Subtotal:      d(440000),
		TotalAmount:   d(440000),
		PaidAmount:    d(440000),
		DebtAmount:    d(0),
		TotalCogs:     d(360000), // 24 lon * 15k
		PaymentMethod: model.PaymentMethodCash,
		CreatedAt:     now.AddDate(0, 0, -1),
	}
	db.Create(&ord1)
	db.Create(&model.SalesOrderItem{
		ID:           uuid.New().String(),
		OrderID:      ord1.ID,
		VariantID:    varHeineken.ID,
		SoldUom:      "thùng",
		SoldQty:      d(1),
		ActualBaseQtyDeducted: d(24),
		ActualUnitPrice: d(440000),
		LineTotal:    d(440000),
		LineCogs:     d(360000),
	})
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeInflow,
		Category:        model.CashbookCategorySalesRevenue,
		Amount:          d(440000),
		PaymentMethod:   model.CashbookPaymentMethodCash,
		SalesOrderID:    &ord1.ID,
		Description:     "Thu tiền bán hàng POS POS-261015-0001 (1 thùng Heineken)",
		CreatedAt:       now.AddDate(0, 0, -1),
	})

	// Order 2: Chị Mai mua nợ trà sữa + bia
	ord2 := model.SalesOrder{
		ID:            uuid.New().String(),
		OrderNumber:   "POS-261016-0002",
		CustomerID:    &custMai.ID,
		WarehouseID:   &whMain.ID,
		Status:        model.OrderStatusCompleted,
		Subtotal:      d(1250000),
		TotalAmount:   d(1250000),
		PaidAmount:    d(0),
		DebtAmount:    d(1250000),
		TotalCogs:     d(850000),
		PaymentMethod: model.PaymentMethodCredit,
		CreatedAt:     now,
	}
	db.Create(&ord2)
	db.Create(&model.DebtLedger{
		ID:              uuid.New().String(),
		PartnerID:       custMai.ID,
		TransactionType: model.DebtTransactionTypeSaleDebt,
		ReferenceID:     &ord2.OrderNumber,
		Amount:          d(1250000),
		BalanceAfter:    d(1250000),
		Note:            ptrString("Ghi nợ đơn bán hàng POS-261016-0002"),
		CreatedAt:       now,
	})

	// Order 3: Anh Tuấn thanh toán QR
	ord3 := model.SalesOrder{
		ID:            uuid.New().String(),
		OrderNumber:   "POS-261016-0003",
		CustomerID:    &custTuan.ID,
		WarehouseID:   &whMain.ID,
		Status:        model.OrderStatusCompleted,
		Subtotal:      d(560000),
		TotalAmount:   d(560000),
		PaidAmount:    d(560000),
		DebtAmount:    d(0),
		TotalCogs:     d(320000),
		PaymentMethod: model.PaymentMethodBankQR,
		CreatedAt:     now,
	}
	db.Create(&ord3)
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeInflow,
		Category:        model.CashbookCategorySalesRevenue,
		Amount:          d(560000),
		PaymentMethod:   model.CashbookPaymentMethodBankTransfer,
		SalesOrderID:    &ord3.ID,
		Description:     "Thu tiền bán hàng POS-261016-0003 (Chuyển khoản QR)",
		CreatedAt:       now,
	})

	// 12. Operating Expenses & Cashbook Inflow/Outflow (P&L Data)
	fmt.Println("Seeding Cashbook Expenses (OPEX)...")
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeOutflow,
		Category:        model.CashbookCategoryRent,
		Amount:          d(12000000),
		PaymentMethod:   model.CashbookPaymentMethodBankTransfer,
		Description:     "Chi tiền thuê mặt bằng kinh doanh tháng 10/2026",
		CreatedAt:       now.AddDate(0, 0, -10),
	})
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeOutflow,
		Category:        model.CashbookCategoryElectricity,
		Amount:          d(2450000),
		PaymentMethod:   model.CashbookPaymentMethodBankTransfer,
		Description:     "Chi tiền điện kinh doanh & chạy sục khí hồ cá",
		CreatedAt:       now.AddDate(0, 0, -5),
	})
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeOutflow,
		Category:        model.CashbookCategoryStaffWage,
		Amount:          d(15000000),
		PaymentMethod:   model.CashbookPaymentMethodBankTransfer,
		Description:     "Chi lương tạm ứng nhân viên thu ngân và kho ca 1 & ca 2",
		CreatedAt:       now.AddDate(0, 0, -3),
	})

	// Initial Capital Inflow
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeInflow,
		Category:        model.CashbookCategoryOtherExpense, // or capital
		Amount:          d(50000000),
		PaymentMethod:   model.CashbookPaymentMethodCash,
		Description:     "Nạp quỹ tiền mặt ban đầu tại két cửa hàng",
		CreatedAt:       now.AddDate(0, 0, -15),
	})
	db.Create(&model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: model.CashbookTypeInflow,
		Category:        model.CashbookCategoryOtherExpense,
		Amount:          d(100000000),
		PaymentMethod:   model.CashbookPaymentMethodBankTransfer,
		Description:     "Số dư tài khoản ngân hàng kinh doanh ban đầu",
		CreatedAt:       now.AddDate(0, 0, -15),
	})

	fmt.Println("✅ Database seeded successfully with FULL realistic multi-domain enterprise data!")
}

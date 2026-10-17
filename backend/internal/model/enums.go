package model

// CostingMethod defines the inventory valuation method.
type CostingMethod string

const (
	CostingMethodWAC  CostingMethod = "WAC"
	CostingMethodFIFO CostingMethod = "FIFO"
)

// ProductType categorizes products for catalog and inventory handling.
type ProductType string

const (
	ProductTypeRawMaterial    ProductType = "RAW_MATERIAL"
	ProductTypeWipSemiFinished ProductType = "WIP_SEMI_FINISHED"
	ProductTypeFinishedGood   ProductType = "FINISHED_GOOD"
	ProductTypeService        ProductType = "SERVICE"
	ProductTypeCombo          ProductType = "COMBO"
)

// ProductionMode determines how a product is manufactured or disassembled.
type ProductionMode string

const (
	ProductionModeNone             ProductionMode = "NONE"
	ProductionModeBatchManufacture ProductionMode = "BATCH_MANUFACTURE"
	ProductionModePosBackflush     ProductionMode = "POS_BACKFLUSH"
	ProductionModeDisassembly      ProductionMode = "DISASSEMBLY"
)

// ProductArchetype defines the business domain behavior of a product.
type ProductArchetype string

const (
	ProductArchetypeStandard     ProductArchetype = "STANDARD"     // Đóng gói / Đa đơn vị tính (thùng, lon, hộp)
	ProductArchetypeMatrix       ProductArchetype = "MATRIX"       // Thời trang / Biến thể (màu x size)
	ProductArchetypeCatchWeight  ProductArchetype = "CATCH_WEIGHT"  // Tươi sống / Cân ký thực tế & HSD
	ProductArchetypeManufactured ProductArchetype = "MANUFACTURED"  // Chế biến / Định mức BOM & Pha lóc
	ProductArchetypeCombo        ProductArchetype = "COMBO"         // Combo / Gói nhiều mặt hàng
)

// WarehouseType classifies physical and logical storage locations.
type WarehouseType string

const (
	WarehouseTypeStorage        WarehouseType = "STORAGE"
	WarehouseTypeRetailPos      WarehouseType = "RETAIL_POS"
	WarehouseTypeKitchenWip     WarehouseType = "KITCHEN_WIP"
	WarehouseTypeVirtualTransit WarehouseType = "VIRTUAL_TRANSIT"
)

// MovementType classifies inventory ledger entries.
type MovementType string

const (
	MovementTypePurchaseIn        MovementType = "PURCHASE_IN"
	MovementTypeSaleOut           MovementType = "SALE_OUT"
	MovementTypeReturnIn          MovementType = "RETURN_IN"
	MovementTypeProductionConsume MovementType = "PRODUCTION_CONSUME"
	MovementTypeProductionYield   MovementType = "PRODUCTION_YIELD"
	MovementTypeStateTransform    MovementType = "STATE_TRANSFORM"
	MovementTypeWastageSpoilage   MovementType = "WASTAGE_SPOILAGE"
	MovementTypeStocktakeAdjust   MovementType = "STOCKTAKE_ADJUST"
	MovementTypeTransferOut       MovementType = "TRANSFER_OUT"
	MovementTypeTransferIn        MovementType = "TRANSFER_IN"
	MovementTypeNaturalShrinkage  MovementType = "NATURAL_SHRINKAGE"
	MovementTypeTransitWastage    MovementType = "TRANSIT_WASTAGE"
)

// FulfillmentStatus tracks 2-phase multi-channel order reservation lifecycle.
type FulfillmentStatus string

const (
	FulfillmentStatusImmediateFulfilled FulfillmentStatus = "IMMEDIATE_FULFILLED"
	FulfillmentStatusPendingReserved    FulfillmentStatus = "PENDING_RESERVED"
	FulfillmentStatusPickedWeighed      FulfillmentStatus = "PICKED_WEIGHED"
	FulfillmentStatusShipped            FulfillmentStatus = "SHIPPED"
	FulfillmentStatusCancelled          FulfillmentStatus = "CANCELLED"
)

// StockTransferStatus tracks the lifecycle of an internal warehouse transfer.
type StockTransferStatus string

const (
	StockTransferStatusDraft       StockTransferStatus = "DRAFT"
	StockTransferStatusInTransit   StockTransferStatus = "IN_TRANSIT"
	StockTransferStatusCompleted   StockTransferStatus = "COMPLETED"
	StockTransferStatusCancelled   StockTransferStatus = "CANCELLED"
)

// RecipeType defines whether a BOM recipe is assembly or disassembly.
type RecipeType string

const (
	RecipeTypeAssembly    RecipeType = "ASSEMBLY"
	RecipeTypeDisassembly RecipeType = "DISASSEMBLY"
)

// ProductionStatus tracks the lifecycle of a production order.
type ProductionStatus string

const (
	ProductionStatusDraft      ProductionStatus = "DRAFT"
	ProductionStatusInProgress ProductionStatus = "IN_PROGRESS"
	ProductionStatusCompleted  ProductionStatus = "COMPLETED"
	ProductionStatusCancelled  ProductionStatus = "CANCELLED"
)

// PosSessionStatus tracks whether a cashier session is open or closed.
type PosSessionStatus string

const (
	PosSessionStatusOpen   PosSessionStatus = "OPEN"
	PosSessionStatusClosed PosSessionStatus = "CLOSED"
)

// OrderStatus defines the payment and fulfillment state of a sales order.
type OrderStatus string

const (
	OrderStatusCompleted   OrderStatus = "COMPLETED"
	OrderStatusPartialPaid OrderStatus = "PARTIAL_PAID"
	OrderStatusDebt        OrderStatus = "DEBT"
	OrderStatusReturned    OrderStatus = "RETURNED"
	OrderStatusCancelled   OrderStatus = "CANCELLED"
)

// PaymentMethod specifies the tender method used for sales orders.
type PaymentMethod string

const (
	PaymentMethodCash   PaymentMethod = "CASH"
	PaymentMethodBankQR PaymentMethod = "BANK_QR"
	PaymentMethodMixed  PaymentMethod = "MIXED"
	PaymentMethodCredit PaymentMethod = "CREDIT"
)

// PartnerType identifies whether a partner is a customer, supplier, or both.
type PartnerType string

const (
	PartnerTypeCustomer PartnerType = "CUSTOMER"
	PartnerTypeSupplier PartnerType = "SUPPLIER"
	PartnerTypeBoth     PartnerType = "BOTH"
)

// DebtTransactionType classifies debt ledger adjustments.
type DebtTransactionType string

const (
	DebtTransactionTypeSaleDebt        DebtTransactionType = "SALE_DEBT"
	DebtTransactionTypeDebtRepayment   DebtTransactionType = "DEBT_REPAYMENT"
	DebtTransactionTypeSupplierInvoice DebtTransactionType = "SUPPLIER_INVOICE"
	DebtTransactionTypeSupplierPayment DebtTransactionType = "SUPPLIER_PAYMENT"
)

// CashbookType represents cash flow direction.
type CashbookType string

const (
	CashbookTypeInflow  CashbookType = "INFLOW"
	CashbookTypeOutflow CashbookType = "OUTFLOW"
)

// CashbookCategory classifies cash transaction categories.
type CashbookCategory string

const (
	CashbookCategorySalesRevenue    CashbookCategory = "SALES_REVENUE"
	CashbookCategoryDebtCollection  CashbookCategory = "DEBT_COLLECTION"
	CashbookCategorySupplierPayment CashbookCategory = "SUPPLIER_PAYMENT"
	CashbookCategoryRent            CashbookCategory = "RENT"
	CashbookCategoryElectricity     CashbookCategory = "ELECTRICITY"
	CashbookCategoryIcePackaging    CashbookCategory = "ICE_PACKAGING"
	CashbookCategoryStaffWage       CashbookCategory = "STAFF_WAGE"
	CashbookCategoryShipping        CashbookCategory = "SHIPPING"
	CashbookCategoryOtherExpense    CashbookCategory = "OTHER_EXPENSE"
)

// CashbookPaymentMethod specifies the financial instrument for cashbook entries.
type CashbookPaymentMethod string

const (
	CashbookPaymentMethodCash         CashbookPaymentMethod = "CASH"
	CashbookPaymentMethodBankTransfer CashbookPaymentMethod = "BANK_TRANSFER"
)

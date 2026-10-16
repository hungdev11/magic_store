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

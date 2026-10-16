import {
  PrismaClient,
  CostingMethod,
  ProductType,
  ProductionMode,
  MovementType,
  RecipeType,
  ProductionStatus,
  PosSessionStatus,
  OrderStatus,
  PaymentMethod,
  PartnerType,
  DebtTransactionType,
  CashbookType,
  CashbookCategory,
  CashbookPaymentMethod,
} from '@prisma/client';

const prisma = new PrismaClient();

// ponytail: Sequential deleteMany in reverse-FK order covers clean reset; add TRUNCATE CASCADE if seed speed becomes bottleneck.
export async function cleanDatabase(client: PrismaClient): Promise<void> {
  console.log('[Clean] Purging existing database records...');
  await client.cashbookTransaction.deleteMany();
  await client.debtLedger.deleteMany();
  await client.salesOrderItem.deleteMany();
  await client.salesOrder.deleteMany();
  await client.posSession.deleteMany();
  await client.productionOrder.deleteMany();
  await client.bomItem.deleteMany();
  await client.bomRecipe.deleteMany();
  await client.inventoryMovement.deleteMany();
  await client.inventoryBatch.deleteMany();
  await client.productModifierGroup.deleteMany();
  await client.modifierItem.deleteMany();
  await client.modifierGroup.deleteMany();
  await client.uomConversion.deleteMany();
  await client.productVariant.deleteMany();
  await client.product.deleteMany();
  await client.category.deleteMany();
  await client.partner.deleteMany();
  await client.storeSetting.deleteMany();
  console.log('[Clean] Database cleaned successfully.');
}

// ---------------------------------------------------------------------------
// Kịch bản 1: Sạp cá tươi sống "Hải Sản Biển Đông"
// ---------------------------------------------------------------------------
export async function seedSeafoodStore(client: PrismaClient): Promise<void> {
  console.log('[Seed] Seeding Kịch bản 1: Sạp cá tươi sống "Hải Sản Biển Đông"...');

  // 1. Cấu hình cửa hàng
  await client.storeSetting.create({
    data: {
      name: 'Hải Sản Biển Đông',
      currency: 'VND',
      costing_method: CostingMethod.WAC,
      enabled_modules: {
        catch_weight: true,
        batch_expiry: true,
        bom_production: true,
        dynamic_pos_pricing: true,
      },
    },
  });

  // 2. Danh mục & Đối tác
  const categorySeafood = await client.category.create({
    data: {
      name: 'Hải Sản Tươi Sống',
      code: 'HAI_SAN_TUOI_SONG',
    },
  });

  const supplier = await client.partner.create({
    data: {
      name: 'Hợp Tác Xã Đánh Bắt Biển Đông',
      phone: '02543888999',
      address: 'Cảng Cá Vũng Tàu, BR-VT',
      partner_type: PartnerType.SUPPLIER,
    },
  });

  const customer = await client.partner.create({
    data: {
      name: 'Nhà Hàng Biển Xanh',
      phone: '0918112233',
      address: '45 Trần Phú, Vũng Tàu',
      partner_type: PartnerType.CUSTOMER,
      price_tier: 'WHOLESALE',
    },
  });

  // 3. Sản phẩm & Biến thể
  // Cá Chẽm Sống
  const prodCaChemSong = await client.product.create({
    data: {
      name: 'Cá Chẽm Sống',
      code: 'CA_CHEM_SONG',
      category_id: categorySeafood.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'kg',
      is_weighable: true,
      track_inventory: true,
      track_batches: true,
      production_mode: ProductionMode.NONE,
    },
  });

  const varCaChemSong = await client.productVariant.create({
    data: {
      product_id: prodCaChemSong.id,
      sku: 'CCS-KG',
      variant_name: 'Cá Chẽm Sống (kg)',
      cost_price: 110000,
      base_selling_price: 160000,
      min_selling_price: 140000,
      current_stock: 93.65,
      min_stock_alert: 10,
    },
  });

  // UOM Con biến thiên 1.2kg
  await client.uomConversion.create({
    data: {
      variant_id: varCaChemSong.id,
      uom_name: 'Con',
      conversion_factor: 1.2,
      is_variable_ratio: true,
      default_price_for_uom: 192000,
    },
  });

  // Cá Chẽm Ngộp
  const prodCaChemNgop = await client.product.create({
    data: {
      name: 'Cá Chẽm Ngộp',
      code: 'CA_CHEM_NGOP',
      category_id: categorySeafood.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'kg',
      is_weighable: true,
      track_inventory: true,
      track_batches: true,
      production_mode: ProductionMode.NONE,
    },
  });

  const varCaChemNgop = await client.productVariant.create({
    data: {
      product_id: prodCaChemNgop.id,
      sku: 'CCN-KG',
      variant_name: 'Cá Chẽm Ngộp (kg)',
      cost_price: 110000,
      base_selling_price: 120000,
      min_selling_price: 100000,
      current_stock: 5.0,
    },
  });

  // Cá Hồi Nguyên Con
  const prodCaHoi = await client.product.create({
    data: {
      name: 'Cá Hồi Nguyên Con',
      code: 'CA_HOI_NGUYEN_CON',
      category_id: categorySeafood.id,
      product_type: ProductType.RAW_MATERIAL,
      base_uom: 'kg',
      is_weighable: true,
      track_inventory: true,
      track_batches: true,
      production_mode: ProductionMode.DISASSEMBLY,
    },
  });

  const varCaHoi = await client.productVariant.create({
    data: {
      product_id: prodCaHoi.id,
      sku: 'CHNC-KG',
      variant_name: 'Cá Hồi Nguyên Con (kg)',
      cost_price: 250000,
      base_selling_price: 320000,
      min_selling_price: 300000,
      current_stock: 15.0,
    },
  });

  // Phi Lê Cá Hồi
  const prodPhiLe = await client.product.create({
    data: {
      name: 'Phi Lê Cá Hồi',
      code: 'PHI_LE_CA_HOI',
      category_id: categorySeafood.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'kg',
      is_weighable: true,
      track_inventory: true,
      track_batches: true,
      production_mode: ProductionMode.NONE,
    },
  });

  const varPhiLe = await client.productVariant.create({
    data: {
      product_id: prodPhiLe.id,
      sku: 'PLCH-KG',
      variant_name: 'Phi Lê Cá Hồi (kg)',
      cost_price: 273437.5,
      base_selling_price: 450000,
      min_selling_price: 420000,
      current_stock: 3.2,
    },
  });

  // Đầu Xương Cá Hồi
  const prodDauXuong = await client.product.create({
    data: {
      name: 'Đầu Xương Cá Hồi',
      code: 'DAU_XUONG_CA_HOI',
      category_id: categorySeafood.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'kg',
      is_weighable: true,
      track_inventory: true,
      track_batches: true,
      production_mode: ProductionMode.NONE,
    },
  });

  const varDauXuong = await client.productVariant.create({
    data: {
      product_id: prodDauXuong.id,
      sku: 'DXCH-KG',
      variant_name: 'Đầu Xương Cá Hồi (kg)',
      cost_price: 240384.62,
      base_selling_price: 80000,
      min_selling_price: 70000,
      current_stock: 1.3,
    },
  });

  // 4. Nhập lô cá sống 100kg kèm InventoryBatch
  const expiry3Days = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const batchCcs = await client.inventoryBatch.create({
    data: {
      variant_id: varCaChemSong.id,
      batch_code: 'LOT-CCS-20261016',
      supplier_id: supplier.id,
      initial_qty: 100,
      remaining_qty: 93.65,
      unit_cost: 110000,
      expiry_date: expiry3Days,
    },
  });

  await client.inventoryMovement.create({
    data: {
      variant_id: varCaChemSong.id,
      batch_id: batchCcs.id,
      movement_type: MovementType.PURCHASE_IN,
      qty_in_base_uom: 100,
      input_uom: 'kg',
      input_qty: 100,
      unit_cost_at_time: 110000,
      reason_note: 'Nhập lô cá chẽm tươi sống 100kg từ HTX Biển Đông',
    },
  });

  // Nhập lô cá hồi 20kg
  const batchCaHoi = await client.inventoryBatch.create({
    data: {
      variant_id: varCaHoi.id,
      batch_code: 'LOT-CHNC-20261016',
      supplier_id: supplier.id,
      initial_qty: 20,
      remaining_qty: 15,
      unit_cost: 250000,
      expiry_date: expiry3Days,
    },
  });

  await client.inventoryMovement.create({
    data: {
      variant_id: varCaHoi.id,
      batch_id: batchCaHoi.id,
      movement_type: MovementType.PURCHASE_IN,
      qty_in_base_uom: 20,
      input_uom: 'kg',
      input_qty: 20,
      unit_cost_at_time: 250000,
      reason_note: 'Nhập lô 20kg cá hồi tươi nguyên con',
    },
  });

  // 5. Chuyển đổi trạng thái STATE_TRANSFORM: 5kg cá sống chết chuyển thành cá ngộp
  await client.inventoryMovement.create({
    data: {
      variant_id: varCaChemSong.id,
      batch_id: batchCcs.id,
      movement_type: MovementType.STATE_TRANSFORM,
      qty_in_base_uom: -5,
      input_uom: 'kg',
      input_qty: -5,
      unit_cost_at_time: 110000,
      reason_note: 'Cá chẽm ngạt oxy trong hồ nuôi, chuyển đổi thành cá ngộp',
    },
  });

  const batchCcn = await client.inventoryBatch.create({
    data: {
      variant_id: varCaChemNgop.id,
      batch_code: 'LOT-CCN-20261016',
      supplier_id: supplier.id,
      initial_qty: 5,
      remaining_qty: 5,
      unit_cost: 110000,
      expiry_date: new Date(Date.now() + 1 * 24 * 3600 * 1000),
    },
  });

  await client.inventoryMovement.create({
    data: {
      variant_id: varCaChemNgop.id,
      batch_id: batchCcn.id,
      movement_type: MovementType.STATE_TRANSFORM,
      qty_in_base_uom: 5,
      input_uom: 'kg',
      input_qty: 5,
      unit_cost_at_time: 110000,
      reason_note: 'Nhận 5kg từ chuyển trạng thái cá chẽm sống ngạt oxy',
    },
  });

  // 6. Phân rã pha lóc DISASSEMBLY: 1 con cá hồi 5kg mổ thành 3.2kg phi lê (70%) + 1.3kg đầu xương (25%) + 0.5kg hao hụt
  const bomDisassembly = await client.bomRecipe.create({
    data: {
      target_variant_id: varCaHoi.id,
      recipe_type: RecipeType.DISASSEMBLY,
      output_qty: 5,
      expected_wastage_percent: 10,
      items: {
        create: [
          {
            component_variant_id: varPhiLe.id,
            qty_required: 3.2,
            cost_allocation_percent: 70,
          },
          {
            component_variant_id: varDauXuong.id,
            qty_required: 1.3,
            cost_allocation_percent: 25,
          },
        ],
      },
    },
  });

  const poDisasm = await client.productionOrder.create({
    data: {
      recipe_id: bomDisassembly.id,
      batch_code: 'PO-DISASM-001',
      status: ProductionStatus.COMPLETED,
      input_qty: 5,
      actual_yield_qty: 4.5,
      total_material_cost: 1250000,
      notes: 'Mổ 1 con cá hồi 5kg thành 3.2kg phi lê (70% giá vốn) + 1.3kg đầu xương (25% giá vốn) + 0.5kg hao hụt',
    },
  });

  await client.inventoryMovement.createMany({
    data: [
      {
        variant_id: varCaHoi.id,
        batch_id: batchCaHoi.id,
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -5,
        input_uom: 'kg',
        input_qty: -5,
        unit_cost_at_time: 250000,
        reference_id: poDisasm.id,
        reason_note: 'Xuất 5kg cá hồi nguyên con để mổ pha lóc',
      },
      {
        variant_id: varPhiLe.id,
        movement_type: MovementType.PRODUCTION_YIELD,
        qty_in_base_uom: 3.2,
        input_uom: 'kg',
        input_qty: 3.2,
        unit_cost_at_time: 273437.5,
        reference_id: poDisasm.id,
        reason_note: 'Thu hồi 3.2kg phi lê cá hồi từ mổ xẻ pha lóc',
      },
      {
        variant_id: varDauXuong.id,
        movement_type: MovementType.PRODUCTION_YIELD,
        qty_in_base_uom: 1.3,
        input_uom: 'kg',
        input_qty: 1.3,
        unit_cost_at_time: 240384.62,
        reference_id: poDisasm.id,
        reason_note: 'Thu hồi 1.3kg đầu xương cá hồi từ mổ xẻ pha lóc',
      },
    ],
  });

  // 7. Ca bán POS & Đơn bán cá cân ký: 1 con cá chẽm cân 1.35kg, sửa giá sàn 150.000đ/kg
  const posSession = await client.posSession.create({
    data: {
      cashier_name: 'Thu Ngân Hải Sản',
      opening_cash: 2000000,
      total_sales_amount: 202500,
      total_cash_collected: 202500,
      status: PosSessionStatus.OPEN,
    },
  });

  const salesOrder = await client.salesOrder.create({
    data: {
      order_number: 'HD-SEAFOOD-001',
      customer_id: customer.id,
      pos_session_id: posSession.id,
      status: OrderStatus.COMPLETED,
      subtotal: 202500,
      total_amount: 202500,
      paid_amount: 202500,
      debt_amount: 0,
      total_cogs: 148500,
      payment_method: PaymentMethod.CASH,
      items: {
        create: [
          {
            variant_id: varCaChemSong.id,
            batch_id: batchCcs.id,
            sold_uom: 'Con',
            sold_qty: 1,
            actual_base_qty_deducted: 1.35,
            original_unit_price: 160000,
            actual_unit_price: 150000,
            line_cogs: 148500,
            is_return: false,
          },
        ],
      },
    },
  });

  await client.inventoryMovement.create({
    data: {
      variant_id: varCaChemSong.id,
      batch_id: batchCcs.id,
      movement_type: MovementType.SALE_OUT,
      qty_in_base_uom: -1.35,
      input_uom: 'kg',
      input_qty: -1.35,
      unit_cost_at_time: 110000,
      reference_id: salesOrder.id,
      reason_note: 'Bán 1 con cá chẽm sống cân nặng 1.35kg cho Nhà Hàng Biển Xanh',
    },
  });

  await client.cashbookTransaction.create({
    data: {
      transaction_type: CashbookType.INFLOW,
      category: CashbookCategory.SALES_REVENUE,
      amount: 202500,
      payment_method: CashbookPaymentMethod.CASH,
      pos_session_id: posSession.id,
      sales_order_id: salesOrder.id,
      partner_id: customer.id,
      description: 'Thu tiền bán 1 con cá chẽm cân 1.35kg đơn HD-SEAFOOD-001',
    },
  });

  console.log('[Seed] Kịch bản 1: Sạp cá tươi sống "Hải Sản Biển Đông" hoàn tất.');
}

// ---------------------------------------------------------------------------
// Kịch bản 2: Shop thời trang "Modern Chic Apparel"
// ---------------------------------------------------------------------------
export async function seedApparelStore(client: PrismaClient): Promise<void> {
  console.log('[Seed] Seeding Kịch bản 2: Shop thời trang "Modern Chic Apparel"...');

  // 1. Cấu hình cửa hàng
  await client.storeSetting.create({
    data: {
      name: 'Modern Chic Apparel',
      currency: 'VND',
      costing_method: CostingMethod.FIFO,
      enabled_modules: {
        matrix_variants: true,
        credit_ledger: true,
      },
    },
  });

  // 2. Danh mục & Khách hàng
  const categoryApparel = await client.category.create({
    data: {
      name: 'Thời Trang Nam',
      code: 'THOI_TRANG_NAM',
    },
  });

  const customer = await client.partner.create({
    data: {
      name: 'Nguyễn Văn An',
      phone: '0901234567',
      address: '123 Lê Lợi, Quận 1, TP.HCM',
      partner_type: PartnerType.CUSTOMER,
      price_tier: 'VIP',
      credit_limit: 5000000,
      current_debt_balance: 0,
    },
  });

  // 3. Sản phẩm Ma trận: Áo Sơ Mi Oxford x 6 biến thể (Trắng/Đen x S/M/L)
  const prodOxford = await client.product.create({
    data: {
      name: 'Áo Sơ Mi Oxford',
      code: 'AO_SOMI_OXFORD',
      category_id: categoryApparel.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'Cái',
      is_weighable: false,
      track_inventory: true,
      track_batches: false,
      production_mode: ProductionMode.NONE,
    },
  });

  const matrixConfigs = [
    { color: 'Trắng', size: 'S', sku: 'OXFORD-WHT-S', cost: 180000, price: 350000, minPrice: 300000, stock: 50 },
    { color: 'Trắng', size: 'M', sku: 'OXFORD-WHT-M', cost: 180000, price: 350000, minPrice: 300000, stock: 51 }, // 50 + 1 đổi trả
    { color: 'Trắng', size: 'L', sku: 'OXFORD-WHT-L', cost: 180000, price: 350000, minPrice: 300000, stock: 50 },
    { color: 'Đen', size: 'S', sku: 'OXFORD-BLK-S', cost: 190000, price: 380000, minPrice: 320000, stock: 40 },
    { color: 'Đen', size: 'M', sku: 'OXFORD-BLK-M', cost: 190000, price: 380000, minPrice: 320000, stock: 40 },
    { color: 'Đen', size: 'L', sku: 'OXFORD-BLK-L', cost: 190000, price: 380000, minPrice: 320000, stock: 39 }, // 40 - 1 đổi
  ];

  const variantsMap: Record<string, string> = {};

  for (const cfg of matrixConfigs) {
    const v = await client.productVariant.create({
      data: {
        product_id: prodOxford.id,
        sku: cfg.sku,
        variant_name: `Áo Sơ Mi Oxford - ${cfg.color} / ${cfg.size}`,
        attributes: { color: cfg.color, size: cfg.size },
        cost_price: cfg.cost,
        base_selling_price: cfg.price,
        min_selling_price: cfg.minPrice,
        current_stock: cfg.stock,
      },
    });
    variantsMap[cfg.sku] = v.id;

    // Nhập tồn kho đầu kỳ
    const initQty = cfg.color === 'Trắng' ? 50 : 40;
    await client.inventoryMovement.create({
      data: {
        variant_id: v.id,
        movement_type: MovementType.PURCHASE_IN,
        qty_in_base_uom: initQty,
        input_uom: 'Cái',
        input_qty: initQty,
        unit_cost_at_time: cfg.cost,
        reason_note: `Nhập tồn kho ban đầu cho ${cfg.sku}`,
      },
    });
  }

  // 4. POS Ca bán & Đơn đổi trả 1 chạm: Trả Áo Trắng M (+1 kho), lấy Áo Đen L (-1 kho), nợ 30.000đ
  const posSession = await client.posSession.create({
    data: {
      cashier_name: 'Thu Ngân Thời Trang',
      opening_cash: 1000000,
      status: PosSessionStatus.OPEN,
    },
  });

  const exchangeOrder = await client.salesOrder.create({
    data: {
      order_number: 'HD-APPAREL-EXCHANGE-001',
      customer_id: customer.id,
      pos_session_id: posSession.id,
      status: OrderStatus.DEBT,
      subtotal: 30000,
      total_amount: 30000,
      paid_amount: 0,
      debt_amount: 30000,
      total_cogs: 10000, // 190k - 180k
      payment_method: PaymentMethod.CREDIT,
      items: {
        create: [
          {
            variant_id: variantsMap['OXFORD-WHT-M'],
            sold_uom: 'Cái',
            sold_qty: 1,
            actual_base_qty_deducted: -1,
            original_unit_price: 350000,
            actual_unit_price: 350000,
            line_cogs: -180000,
            is_return: true,
          },
          {
            variant_id: variantsMap['OXFORD-BLK-L'],
            sold_uom: 'Cái',
            sold_qty: 1,
            actual_base_qty_deducted: 1,
            original_unit_price: 380000,
            actual_unit_price: 380000,
            line_cogs: 190000,
            is_return: false,
          },
        ],
      },
    },
  });

  // Ghi nhận biến động kho đổi trả
  await client.inventoryMovement.createMany({
    data: [
      {
        variant_id: variantsMap['OXFORD-WHT-M'],
        movement_type: MovementType.RETURN_IN,
        qty_in_base_uom: 1,
        input_uom: 'Cái',
        input_qty: 1,
        unit_cost_at_time: 180000,
        reference_id: exchangeOrder.id,
        reason_note: 'Khách đổi trả 1 Áo Sơ Mi Oxford - Trắng / M (+1 cái)',
      },
      {
        variant_id: variantsMap['OXFORD-BLK-L'],
        movement_type: MovementType.SALE_OUT,
        qty_in_base_uom: -1,
        input_uom: 'Cái',
        input_qty: -1,
        unit_cost_at_time: 190000,
        reference_id: exchangeOrder.id,
        reason_note: 'Khách lấy mới 1 Áo Sơ Mi Oxford - Đen / L (-1 cái)',
      },
    ],
  });

  // Ghi nhận nợ khách hàng vào DebtLedger và cập nhật số dư nợ
  await client.debtLedger.create({
    data: {
      partner_id: customer.id,
      transaction_type: DebtTransactionType.SALE_DEBT,
      reference_id: exchangeOrder.id,
      amount: 30000,
      balance_after: 30000,
      note: 'Ghi nợ chênh lệch đổi hàng đơn HD-APPAREL-EXCHANGE-001',
    },
  });

  await client.partner.update({
    where: { id: customer.id },
    data: { current_debt_balance: 30000 },
  });

  console.log('[Seed] Kịch bản 2: Shop thời trang "Modern Chic Apparel" hoàn tất.');
}

// ---------------------------------------------------------------------------
// Kịch bản 3: Tiệm chế biến đồ ăn & F&B "Bếp Bánh Mì & Giò Chả Sài Gòn"
// ---------------------------------------------------------------------------
export async function seedFoodStore(client: PrismaClient): Promise<void> {
  console.log('[Seed] Seeding Kịch bản 3: Tiệm chế biến F&B "Bếp Bánh Mì & Giò Chả Sài Gòn"...');

  // 1. Cấu hình cửa hàng
  await client.storeSetting.create({
    data: {
      name: 'Bếp Bánh Mì & Giò Chả Sài Gòn',
      currency: 'VND',
      costing_method: CostingMethod.WAC,
      enabled_modules: {
        bom_production: true,
        batch_expiry: true,
        product_modifiers: true,
      },
    },
  });

  // 2. Danh mục & Đối tác
  const categoryFood = await client.category.create({
    data: {
      name: 'Ẩm Thực Bánh Mì & Giò Chả',
      code: 'AM_THUC_BANH_MI',
    },
  });

  const supplier = await client.partner.create({
    data: {
      name: 'Lò Heo Sạch Củ Chi',
      phone: '0908887766',
      address: 'Ấp An Nhơn Tây, Củ Chi, TP.HCM',
      partner_type: PartnerType.SUPPLIER,
    },
  });

  const customer = await client.partner.create({
    data: {
      name: 'Lê Hoàng Khang',
      phone: '0977665544',
      partner_type: PartnerType.CUSTOMER,
    },
  });

  // 3. Nguyên liệu thô (RAW_MATERIAL)
  const rawDefinitions = [
    { name: 'Thịt heo nạc', code: 'THIT_HEO_NAC', uom: 'kg', sku: 'RAW-THIT-NAC', cost: 120000, initQty: 50, finalStock: 30 },
    { name: 'Mỡ heo', code: 'MO_HEO', uom: 'kg', sku: 'RAW-MO-HEO', cost: 60000, initQty: 20, finalStock: 15 },
    { name: 'Lá chuối', code: 'LA_CHUOI', uom: 'kg', sku: 'RAW-LA-CHUOI', cost: 20000, initQty: 10, finalStock: 8 },
    { name: 'Vỏ bánh mì', code: 'VO_BANH_MI', uom: 'Ổ', sku: 'RAW-VO-BANH-MI', cost: 3000, sellPrice: 5000, initQty: 100, finalStock: 94 },
    { name: 'Pate gan', code: 'PATE', uom: 'kg', sku: 'RAW-PATE', cost: 100000, sellPrice: 180000, initQty: 5, finalStock: 4.95 },
    { name: 'Trứng gà', code: 'TRUNG_GA', uom: 'Quả', sku: 'RAW-TRUNG-GA', cost: 3000, sellPrice: 5000, initQty: 50, finalStock: 49 },
  ];

  const rawVariants: Record<string, string> = {};

  for (const raw of rawDefinitions) {
    const prod = await client.product.create({
      data: {
        name: raw.name,
        code: raw.code,
        category_id: categoryFood.id,
        product_type: ProductType.RAW_MATERIAL,
        base_uom: raw.uom,
        track_inventory: true,
        production_mode: ProductionMode.NONE,
      },
    });

    const v = await client.productVariant.create({
      data: {
        product_id: prod.id,
        sku: raw.sku,
        variant_name: `${raw.name} (${raw.uom})`,
        cost_price: raw.cost,
        base_selling_price: raw.sellPrice || 0,
        current_stock: raw.finalStock,
      },
    });
    rawVariants[raw.sku] = v.id;

    await client.inventoryMovement.create({
      data: {
        variant_id: v.id,
        movement_type: MovementType.PURCHASE_IN,
        qty_in_base_uom: raw.initQty,
        input_uom: raw.uom,
        input_qty: raw.initQty,
        unit_cost_at_time: raw.cost,
        reason_note: `Nhập kho ban đầu cho ${raw.name}`,
      },
    });
  }

  // 4. Thành phẩm: Chả lụa đòn 500g (BATCH_MANUFACTURE) & Bánh mì thập cẩm (POS_BACKFLUSH)
  const prodChaLua = await client.product.create({
    data: {
      name: 'Chả lụa đòn 500g',
      code: 'CHA_LUA_500G',
      category_id: categoryFood.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'Đòn',
      track_inventory: true,
      track_batches: true,
      production_mode: ProductionMode.BATCH_MANUFACTURE,
    },
  });

  const varChaLua = await client.productVariant.create({
    data: {
      product_id: prodChaLua.id,
      sku: 'FG-CHA-LUA-500G',
      variant_name: 'Chả lụa truyền thống 500g (Đòn)',
      cost_price: 54800,
      base_selling_price: 100000,
      min_selling_price: 90000,
      current_stock: 49.92,
    },
  });

  const prodBanhMi = await client.product.create({
    data: {
      name: 'Bánh mì thập cẩm',
      code: 'BANH_MI_THAP_CAM',
      category_id: categoryFood.id,
      product_type: ProductType.FINISHED_GOOD,
      base_uom: 'Ổ',
      track_inventory: true,
      production_mode: ProductionMode.POS_BACKFLUSH,
    },
  });

  const varBanhMi = await client.productVariant.create({
    data: {
      product_id: prodBanhMi.id,
      sku: 'FG-BANH-MI-TC',
      variant_name: 'Bánh mì thập cẩm Sài Gòn (Ổ)',
      cost_price: 15384,
      base_selling_price: 30000,
      min_selling_price: 25000,
      current_stock: 0,
    },
  });

  // 5. Cấu hình Topping / Modifier linh hoạt
  const modGroup = await client.modifierGroup.create({
    data: {
      name: 'Đồ ăn kèm Bánh Mì',
      min_selection: 0,
      max_selection: 5,
      is_required: false,
      items: {
        create: [
          {
            name: 'Thêm Trứng Ốp La',
            price: 10000,
            linked_variant_id: rawVariants['RAW-TRUNG-GA'],
            deduct_qty: 1,
          },
          {
            name: 'Thêm Pate',
            price: 5000,
            linked_variant_id: rawVariants['RAW-PATE'],
            deduct_qty: 0.02,
          },
          {
            name: 'Thêm Chả Lụa',
            price: 8000,
            linked_variant_id: varChaLua.id,
            deduct_qty: 0.06,
          },
        ],
      },
    },
  });

  await client.productModifierGroup.create({
    data: {
      product_id: prodBanhMi.id,
      modifier_group_id: modGroup.id,
      display_order: 1,
    },
  });

  // 6. Công thức định mức BOM ASSEMBLY cho Chả Lụa (mẻ 50 đòn)
  const bomChaLua = await client.bomRecipe.create({
    data: {
      target_variant_id: varChaLua.id,
      recipe_type: RecipeType.ASSEMBLY,
      output_qty: 50,
      items: {
        create: [
          { component_variant_id: rawVariants['RAW-THIT-NAC'], qty_required: 20 },
          { component_variant_id: rawVariants['RAW-MO-HEO'], qty_required: 5 },
          { component_variant_id: rawVariants['RAW-LA-CHUOI'], qty_required: 2 },
        ],
      },
    },
  });

  // Lệnh sản xuất mẻ 50 đòn chả lụa
  const batchChaLua = await client.inventoryBatch.create({
    data: {
      variant_id: varChaLua.id,
      batch_code: 'BATCH-CL-20261016',
      supplier_id: supplier.id,
      initial_qty: 50,
      remaining_qty: 49.92,
      unit_cost: 54800,
      expiry_date: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  });

  const poChaLua = await client.productionOrder.create({
    data: {
      recipe_id: bomChaLua.id,
      batch_code: 'BATCH-CL-20261016',
      status: ProductionStatus.COMPLETED,
      input_qty: 50,
      actual_yield_qty: 50,
      total_material_cost: 2740000, // 20*120k + 5*60k + 2*20k = 2.740.000
      notes: 'Chế biến mẻ 50 đòn chả lụa 500g',
    },
  });

  await client.inventoryMovement.createMany({
    data: [
      {
        variant_id: rawVariants['RAW-THIT-NAC'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -20,
        input_uom: 'kg',
        input_qty: -20,
        unit_cost_at_time: 120000,
        reference_id: poChaLua.id,
        reason_note: 'Tiêu hao 20kg thịt nạc sản xuất mẻ chả lụa BATCH-CL-20261016',
      },
      {
        variant_id: rawVariants['RAW-MO-HEO'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -5,
        input_uom: 'kg',
        input_qty: -5,
        unit_cost_at_time: 60000,
        reference_id: poChaLua.id,
        reason_note: 'Tiêu hao 5kg mỡ heo sản xuất mẻ chả lụa BATCH-CL-20261016',
      },
      {
        variant_id: rawVariants['RAW-LA-CHUOI'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -2,
        input_uom: 'kg',
        input_qty: -2,
        unit_cost_at_time: 20000,
        reference_id: poChaLua.id,
        reason_note: 'Tiêu hao 2kg lá chuối sản xuất mẻ chả lụa BATCH-CL-20261016',
      },
      {
        variant_id: varChaLua.id,
        batch_id: batchChaLua.id,
        movement_type: MovementType.PRODUCTION_YIELD,
        qty_in_base_uom: 50,
        input_uom: 'Đòn',
        input_qty: 50,
        unit_cost_at_time: 54800,
        reference_id: poChaLua.id,
        reason_note: 'Nhập kho 50 đòn chả lụa thành phẩm mẻ BATCH-CL-20261016',
      },
    ],
  });

  // Công thức BOM ASSEMBLY cho Bánh Mì Thập Cẩm (1 ổ)
  await client.bomRecipe.create({
    data: {
      target_variant_id: varBanhMi.id,
      recipe_type: RecipeType.ASSEMBLY,
      output_qty: 1,
      items: {
        create: [
          { component_variant_id: rawVariants['RAW-VO-BANH-MI'], qty_required: 1 },
          { component_variant_id: varChaLua.id, qty_required: 0.08 },
          { component_variant_id: rawVariants['RAW-PATE'], qty_required: 0.03 },
        ],
      },
    },
  });

  // 7. Đơn bán POS chế độ Backflush có chọn Topping: 1 Bánh mì + Trứng (+10k) + Pate (+5k) = 45.000đ
  const posSession = await client.posSession.create({
    data: {
      cashier_name: 'Thu Ngân Bếp Bánh Mì',
      opening_cash: 500000,
      total_sales_amount: 45000,
      total_bank_collected: 45000,
      status: PosSessionStatus.OPEN,
    },
  });

  const orderFnb = await client.salesOrder.create({
    data: {
      order_number: 'HD-FNB-001',
      customer_id: customer.id,
      pos_session_id: posSession.id,
      status: OrderStatus.COMPLETED,
      subtotal: 45000,
      total_amount: 45000,
      paid_amount: 45000,
      debt_amount: 0,
      total_cogs: 15384,
      payment_method: PaymentMethod.BANK_QR,
      items: {
        create: [
          {
            variant_id: varBanhMi.id,
            sold_uom: 'Ổ',
            sold_qty: 1,
            actual_base_qty_deducted: 1,
            original_unit_price: 30000,
            actual_unit_price: 45000,
            modifiers_json: [
              { name: 'Thêm Trứng Ốp La', price: 10000, deduct_qty: 1, uom: 'Quả', linked_sku: 'RAW-TRUNG-GA' },
              { name: 'Thêm Pate', price: 5000, deduct_qty: 0.02, uom: 'kg', linked_sku: 'RAW-PATE' },
            ],
            line_cogs: 15384,
            is_return: false,
          },
        ],
      },
    },
  });

  // Khấu trừ kho Backflush (Vỏ + Chả + Pate tiêu chuẩn + Topping Trứng + Topping Pate)
  await client.inventoryMovement.createMany({
    data: [
      {
        variant_id: rawVariants['RAW-VO-BANH-MI'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -1,
        input_uom: 'Ổ',
        input_qty: -1,
        unit_cost_at_time: 3000,
        reference_id: orderFnb.id,
        reason_note: 'Backflush nguyên liệu: 1 Vỏ bánh mì cho đơn HD-FNB-001',
      },
      {
        variant_id: varChaLua.id,
        batch_id: batchChaLua.id,
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -0.08,
        input_uom: 'Đòn',
        input_qty: -0.08,
        unit_cost_at_time: 54800,
        reference_id: orderFnb.id,
        reason_note: 'Backflush nguyên liệu: 0.08 đòn chả lụa cho đơn HD-FNB-001',
      },
      {
        variant_id: rawVariants['RAW-PATE'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -0.03,
        input_uom: 'kg',
        input_qty: -0.03,
        unit_cost_at_time: 100000,
        reference_id: orderFnb.id,
        reason_note: 'Backflush nguyên liệu: 0.03kg pate tiêu chuẩn cho đơn HD-FNB-001',
      },
      {
        variant_id: rawVariants['RAW-TRUNG-GA'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -1,
        input_uom: 'Quả',
        input_qty: -1,
        unit_cost_at_time: 3000,
        reference_id: orderFnb.id,
        reason_note: 'Backflush topping: 1 quả trứng ốp la cho đơn HD-FNB-001',
      },
      {
        variant_id: rawVariants['RAW-PATE'],
        movement_type: MovementType.PRODUCTION_CONSUME,
        qty_in_base_uom: -0.02,
        input_uom: 'kg',
        input_qty: -0.02,
        unit_cost_at_time: 100000,
        reference_id: orderFnb.id,
        reason_note: 'Backflush topping: 0.02kg pate thêm cho đơn HD-FNB-001',
      },
      {
        variant_id: varBanhMi.id,
        movement_type: MovementType.SALE_OUT,
        qty_in_base_uom: -1,
        input_uom: 'Ổ',
        input_qty: -1,
        unit_cost_at_time: 15384,
        reference_id: orderFnb.id,
        reason_note: 'Xuất bán POS 1 Bánh Mì Thập Cẩm kèm Topping đơn HD-FNB-001',
      },
    ],
  });

  await client.cashbookTransaction.create({
    data: {
      transaction_type: CashbookType.INFLOW,
      category: CashbookCategory.SALES_REVENUE,
      amount: 45000,
      payment_method: CashbookPaymentMethod.BANK_TRANSFER,
      sales_order_id: orderFnb.id,
      pos_session_id: posSession.id,
      partner_id: customer.id,
      description: 'Thu tiền bán bánh mì kèm topping qua chuyển khoản QR đơn HD-FNB-001',
    },
  });

  // 8. Ghi nhận hủy hao hụt WASTAGE_SPOILAGE: Hủy 5 ổ bánh mì hỏng kèm chi phí vào sổ quỹ
  await client.inventoryMovement.create({
    data: {
      variant_id: rawVariants['RAW-VO-BANH-MI'],
      movement_type: MovementType.WASTAGE_SPOILAGE,
      qty_in_base_uom: -5,
      input_uom: 'Ổ',
      input_qty: -5,
      unit_cost_at_time: 3000,
      reason_note: 'Hủy 5 vỏ bánh mì bị ẩm mốc quá hạn trong ca',
    },
  });

  await client.cashbookTransaction.create({
    data: {
      transaction_type: CashbookType.OUTFLOW,
      category: CashbookCategory.OTHER_EXPENSE,
      amount: 15000,
      payment_method: CashbookPaymentMethod.CASH,
      pos_session_id: posSession.id,
      description: 'Chi phí tổn thất hủy 5 vỏ bánh mì bị ẩm mốc (5 x 3.000đ)',
    },
  });

  console.log('[Seed] Kịch bản 3: Tiệm chế biến F&B "Bếp Bánh Mì & Giò Chả Sài Gòn" hoàn tất.');
}

function createMockPrisma(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_, prop: string) {
      if (prop === '$disconnect') return async () => {};
      return new Proxy({}, {
        get(_, method: string) {
          return async (args: any) => {
            if (method === 'create') {
              return { id: 'mock-cuid-' + Math.random().toString(36).substring(7), ...(args?.data || {}) };
            }
            if (method === 'createMany') {
              return { count: args?.data?.length || 0 };
            }
            if (method === 'deleteMany') {
              return { count: 1 };
            }
            if (method === 'update') {
              return { ...(args?.data || {}) };
            }
            return null;
          };
        },
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Entrypoint: Dispatcher dựa trên STORE_PROFILE
// ---------------------------------------------------------------------------
export async function main() {
  const profile = (process.env.STORE_PROFILE || 'ALL').toUpperCase();
  console.log(`[Seed] Starting seed with STORE_PROFILE="${profile}"...`);

  if (profile === 'DRY_RUN') {
    const mock = createMockPrisma();
    await cleanDatabase(mock);
    await seedSeafoodStore(mock);
    await seedApparelStore(mock);
    await seedFoodStore(mock);
    console.log('[Seed] Dry-run self-test completed successfully.');
    return;
  }

  await cleanDatabase(prisma);

  if (profile === 'ALL' || profile === 'SEAFOOD') {
    await seedSeafoodStore(prisma);
  }
  if (profile === 'ALL' || profile === 'APPAREL') {
    await seedApparelStore(prisma);
  }
  if (profile === 'ALL' || profile === 'FOOD') {
    await seedFoodStore(prisma);
  }

  if (profile !== 'ALL' && profile !== 'SEAFOOD' && profile !== 'APPAREL' && profile !== 'FOOD') {
    console.warn(`[Seed] Unknown STORE_PROFILE "${profile}". Valid values: SEAFOOD, APPAREL, FOOD, ALL, DRY_RUN.`);
  }

  console.log('[Seed] All seeding operations completed successfully.');
}

if (process.env.NODE_ENV !== 'test') {
  main()
    .catch((e) => {
      console.error('[Seed] Error seeding database:', e);
      process.exit(1);
    })
    .finally(async () => {
      if ((process.env.STORE_PROFILE || 'ALL').toUpperCase() !== 'DRY_RUN') {
        await prisma.$disconnect();
      }
    });
}

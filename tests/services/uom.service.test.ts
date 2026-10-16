import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  UomEngine,
  VariableRatioWeightRequiredError,
  MinPriceViolationError,
  UomConversionNotFoundError,
  ProductVariantNotFoundError,
} from '../../src/services/uom.service';

function createMockPrisma() {
  const products = [
    { id: 'p_beer', name: 'Bia Saigon Chill', base_uom: 'Lon', is_weighable: false },
    { id: 'p_fish', name: 'Cá Điêu Hồng', base_uom: 'kg', is_weighable: true },
    { id: 'p_beef', name: 'Thịt Bò Mỹ', base_uom: 'kg', is_weighable: true },
    { id: 'p_pen', name: 'Bút Bi Thiên Long', base_uom: 'Cái', is_weighable: false },
  ];

  const variants = [
    {
      id: 'v_beer',
      product_id: 'p_beer',
      product: products[0],
      sku: 'SKU-BEER',
      variant_name: 'Bia Saigon 330ml',
      base_selling_price: new Prisma.Decimal('12000'),
      min_selling_price: new Prisma.Decimal('10000'),
      cost_price: new Prisma.Decimal('9000'),
      current_stock: new Prisma.Decimal('240'),
    },
    {
      id: 'v_fish',
      product_id: 'p_fish',
      product: products[1],
      sku: 'SKU-FISH',
      variant_name: 'Cá Điêu Hồng Sống',
      base_selling_price: new Prisma.Decimal('70000'),
      min_selling_price: new Prisma.Decimal('60000'),
      cost_price: new Prisma.Decimal('50000'),
      current_stock: new Prisma.Decimal('50'),
    },
    {
      id: 'v_beef',
      product_id: 'p_beef',
      product: products[2],
      sku: 'SKU-BEEF',
      variant_name: 'Ba Chỉ Bò Mỹ',
      base_selling_price: new Prisma.Decimal('220000'),
      min_selling_price: new Prisma.Decimal('190000'),
      cost_price: new Prisma.Decimal('160000'),
      current_stock: new Prisma.Decimal('30'),
    },
    {
      id: 'v_pen',
      product_id: 'p_pen',
      product: products[3],
      sku: 'SKU-PEN',
      variant_name: 'Bút Bi Xanh',
      base_selling_price: new Prisma.Decimal('5000'),
      min_selling_price: new Prisma.Decimal('4000'),
      cost_price: new Prisma.Decimal('3000'),
      current_stock: new Prisma.Decimal('100'),
    },
  ];

  const conversions = [
    {
      id: 'c_beer_carton',
      variant_id: 'v_beer',
      uom_name: 'Thùng',
      conversion_factor: new Prisma.Decimal('24'),
      is_variable_ratio: false,
      default_price_for_uom: new Prisma.Decimal('280000'),
    },
    {
      id: 'c_fish_piece',
      variant_id: 'v_fish',
      uom_name: 'Con',
      conversion_factor: new Prisma.Decimal('1.2'),
      is_variable_ratio: true,
      default_price_for_uom: null,
    },
  ];

  return {
    productVariant: {
      findUnique: async ({ where, include }: any) => {
        const v = variants.find((item) => item.id === where.id);
        if (!v) return null;
        const res: any = { ...v };
        if (include?.product) {
          res.product = v.product;
        }
        if (include?.uom_conversions) {
          res.uom_conversions = conversions.filter((c) => c.variant_id === v.id);
        }
        return res;
      },
    },
    uomConversion: {
      findUnique: async ({ where }: any) => {
        if (where.variant_id_uom_name) {
          const { variant_id, uom_name } = where.variant_id_uom_name;
          return (
            conversions.find(
              (c) => c.variant_id === variant_id && c.uom_name === uom_name
            ) ?? null
          );
        }
        return null;
      },
    },
  };
}

describe('UomEngine', () => {
  const mockPrisma = createMockPrisma();
  const engine = new UomEngine(mockPrisma as any);

  describe('1. Quy đổi UOM cố định (1 Thùng = 24 Lon)', () => {
    test('toBaseQty: 2 Thùng quy đổi thành 48 Lon', async () => {
      const baseQty = await engine.toBaseQty({
        variant_id: 'v_beer',
        input_uom: 'Thùng',
        input_qty: 2,
      });
      assert.ok(baseQty instanceof Prisma.Decimal);
      assert.equal(baseQty.toString(), '48');
    });

    test('toBaseQty: khi input_uom trùng base_uom thì trả về chính nó', async () => {
      const baseQty = await engine.toBaseQty({
        variant_id: 'v_beer',
        input_uom: 'Lon',
        input_qty: 12,
      });
      assert.equal(baseQty.toString(), '12');
    });

    test('fromBaseQty: 48 Lon quy đổi ngược về 2 Thùng', async () => {
      const targetQty = await engine.fromBaseQty({
        variant_id: 'v_beer',
        target_uom: 'Thùng',
        base_qty: 48,
      });
      assert.ok(targetQty instanceof Prisma.Decimal);
      assert.equal(targetQty.toString(), '2');
    });

    test('fromBaseQty: khi target_uom trùng base_uom thì trả về chính nó', async () => {
      const targetQty = await engine.fromBaseQty({
        variant_id: 'v_beer',
        target_uom: 'Lon',
        base_qty: 24,
      });
      assert.equal(targetQty.toString(), '24');
    });
  });

  describe('2. Bắt lỗi khi UOM biến thiên (is_variable_ratio: true) thiếu actual_weight', () => {
    test('toBaseQty ném VariableRatioWeightRequiredError khi thiếu actual_weight', async () => {
      await assert.rejects(
        async () => {
          await engine.toBaseQty({
            variant_id: 'v_fish',
            input_uom: 'Con',
            input_qty: 1,
          });
        },
        VariableRatioWeightRequiredError
      );
    });

    test('calculateLinePrice ném VariableRatioWeightRequiredError khi bán UOM biến thiên mà thiếu actual_base_qty', async () => {
      await assert.rejects(
        async () => {
          await engine.calculateLinePrice({
            variant_id: 'v_fish',
            sold_uom: 'Con',
            sold_qty: 1,
          });
        },
        VariableRatioWeightRequiredError
      );
    });
  });

  describe('3. Quy đổi UOM biến thiên khi có actual_weight chuẩn xác theo cân số thực', () => {
    test('toBaseQty trả về đúng actual_weight khi cung cấp cân số thực', async () => {
      const baseQty = await engine.toBaseQty({
        variant_id: 'v_fish',
        input_uom: 'Con',
        input_qty: 1,
        actual_weight: '1.3500',
      });
      assert.ok(baseQty instanceof Prisma.Decimal);
      assert.ok(baseQty.equals(new Prisma.Decimal('1.3500')));
      assert.equal(baseQty.toString(), '1.35');
    });
  });

  describe('4. Kiểm tra chặn giá sàn min_selling_price khi người bán tự ý hạ giá', () => {
    test('calculateLinePrice ném MinPriceViolationError khi override_unit_price dưới giá sàn (base UOM)', async () => {
      await assert.rejects(
        async () => {
          await engine.calculateLinePrice({
            variant_id: 'v_beer',
            sold_uom: 'Lon',
            sold_qty: 5,
            override_unit_price: 9000, // min is 10000
          });
        },
        MinPriceViolationError
      );
    });

    test('calculateLinePrice ném MinPriceViolationError khi override_unit_price dưới giá sàn quy đổi (conversion UOM)', async () => {
      // 1 Thùng = 24 Lon * 10000 = 240000
      await assert.rejects(
        async () => {
          await engine.calculateLinePrice({
            variant_id: 'v_beer',
            sold_uom: 'Thùng',
            sold_qty: 1,
            override_unit_price: 230000, // below 240000 min
          });
        },
        MinPriceViolationError
      );
    });

    test('calculateLinePrice cho phép override dưới sàn nếu allow_below_min_price = true', async () => {
      const result = await engine.calculateLinePrice({
        variant_id: 'v_beer',
        sold_uom: 'Lon',
        sold_qty: 5,
        override_unit_price: 9000,
        allow_below_min_price: true,
      });
      assert.equal(result.unit_price.toString(), '9000');
      assert.equal(result.line_total.toString(), '45000');
      assert.equal(result.is_price_overridden, true);
    });
  });

  describe('5. Tính line_total chính xác cho cả hàng cân ký và hàng số lượng nguyên', () => {
    test('Hàng số lượng nguyên cố định: line_total = sold_qty * unit_price', async () => {
      const result = await engine.calculateLinePrice({
        variant_id: 'v_beer',
        sold_uom: 'Thùng',
        sold_qty: 2,
      });
      // default_price_for_uom is 280000
      assert.equal(result.unit_price.toString(), '280000');
      assert.equal(result.line_total.toString(), '560000');
      assert.equal(result.actual_deducted_qty.toString(), '48');
      assert.equal(result.is_price_overridden, false);
    });

    test('Hàng rời đơn vị cơ sở: line_total = sold_qty * unit_price', async () => {
      const result = await engine.calculateLinePrice({
        variant_id: 'v_pen',
        sold_uom: 'Cái',
        sold_qty: 10,
      });
      assert.equal(result.unit_price.toString(), '5000');
      assert.equal(result.line_total.toString(), '50000');
      assert.equal(result.actual_deducted_qty.toString(), '10');
      assert.equal(result.is_price_overridden, false);
    });

    test('Hàng cân ký biến thiên (catch-weight): line_total = actual_deducted_qty * unit_price', async () => {
      const result = await engine.calculateLinePrice({
        variant_id: 'v_fish',
        sold_uom: 'Con',
        sold_qty: 1,
        actual_base_qty: '1.45',
      });
      // Base selling price is 70000 / kg. Weight is 1.45 kg.
      // 1.45 * 70000 = 101500
      assert.equal(result.unit_price.toString(), '70000');
      assert.equal(result.actual_deducted_qty.toString(), '1.45');
      assert.equal(result.line_total.toString(), '101500');
      assert.equal(result.is_price_overridden, false);
    });

    test('Hàng cân ký trực tiếp (is_weighable base UOM): line_total = actual_deducted_qty * unit_price', async () => {
      const result = await engine.calculateLinePrice({
        variant_id: 'v_beef',
        sold_uom: 'kg',
        sold_qty: '2.5',
      });
      // 2.5 * 220000 = 550000
      assert.equal(result.unit_price.toString(), '220000');
      assert.equal(result.actual_deducted_qty.toString(), '2.5');
      assert.equal(result.line_total.toString(), '550000');
    });
  });

  describe('6. Các trường hợp lỗi & tx client', () => {
    test('Ném ProductVariantNotFoundError khi variant không tồn tại', async () => {
      await assert.rejects(
        async () => {
          await engine.toBaseQty({
            variant_id: 'v_non_existent',
            input_uom: 'Lon',
            input_qty: 1,
          });
        },
        ProductVariantNotFoundError
      );
    });

    test('Ném UomConversionNotFoundError khi đơn vị không có cấu hình quy đổi', async () => {
      await assert.rejects(
        async () => {
          await engine.toBaseQty({
            variant_id: 'v_beer',
            input_uom: 'Két',
            input_qty: 1,
          });
        },
        UomConversionNotFoundError
      );
    });

    test('Hỗ trợ truyền tx client riêng biệt', async () => {
      const mockTx = createMockPrisma();
      const defaultEngine = new UomEngine(); // no prisma injected in constructor
      const baseQty = await defaultEngine.toBaseQty(
        {
          variant_id: 'v_beer',
          input_uom: 'Thùng',
          input_qty: 3,
        },
        mockTx as any
      );
      assert.equal(baseQty.toString(), '72');
    });
  });
});

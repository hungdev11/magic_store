import { Prisma, PrismaClient } from '@prisma/client';

export class VariableRatioWeightRequiredError extends Error {
  constructor(message = 'Actual weight is required for variable ratio conversion') {
    super(message);
    this.name = 'VariableRatioWeightRequiredError';
  }
}

export class MinPriceViolationError extends Error {
  constructor(message = 'Selling price cannot be below minimum selling price') {
    super(message);
    this.name = 'MinPriceViolationError';
  }
}

export class UomConversionNotFoundError extends Error {
  constructor(message = 'UOM conversion not found') {
    super(message);
    this.name = 'UomConversionNotFoundError';
  }
}

export class ProductVariantNotFoundError extends Error {
  constructor(message = 'Product variant not found') {
    super(message);
    this.name = 'ProductVariantNotFoundError';
  }
}

export interface ToBaseQtyParams {
  variant_id: string;
  input_uom: string;
  input_qty: Prisma.Decimal | number | string;
  actual_weight?: Prisma.Decimal | number | string;
}

export interface FromBaseQtyParams {
  variant_id: string;
  target_uom: string;
  base_qty: Prisma.Decimal | number | string;
}

export interface CalculateLinePriceParams {
  variant_id: string;
  sold_uom: string;
  sold_qty: Prisma.Decimal | number | string;
  actual_base_qty?: Prisma.Decimal | number | string;
  override_unit_price?: Prisma.Decimal | number | string;
  allow_below_min_price?: boolean;
}

export interface LinePriceResult {
  unit_price: Prisma.Decimal;
  line_total: Prisma.Decimal;
  actual_deducted_qty: Prisma.Decimal;
  is_price_overridden: boolean;
}

type DbClient = Prisma.TransactionClient | PrismaClient;

export class UomEngine {
  constructor(private prisma?: PrismaClient) {}

  // ponytail: Lazy-initialize default PrismaClient when no client/tx provided; inject custom client in tests.
  private getDb(tx?: Prisma.TransactionClient): DbClient {
    const db = tx ?? this.prisma;
    if (!db) {
      this.prisma = new PrismaClient();
      return this.prisma;
    }
    return db;
  }

  async toBaseQty(
    params: ToBaseQtyParams,
    tx?: Prisma.TransactionClient
  ): Promise<Prisma.Decimal> {
    const db = this.getDb(tx);
    const variant = await db.productVariant.findUnique({
      where: { id: params.variant_id },
      include: { product: true },
    });

    if (!variant) {
      throw new ProductVariantNotFoundError(`Variant ${params.variant_id} not found`);
    }

    const inputQty = new Prisma.Decimal(params.input_qty);

    if (params.input_uom === variant.product.base_uom) {
      if (params.actual_weight !== undefined && params.actual_weight !== null) {
        return new Prisma.Decimal(params.actual_weight);
      }
      return inputQty;
    }

    const conversion = await db.uomConversion.findUnique({
      where: {
        variant_id_uom_name: {
          variant_id: params.variant_id,
          uom_name: params.input_uom,
        },
      },
    });

    if (!conversion) {
      throw new UomConversionNotFoundError(
        `Conversion from ${params.input_uom} for variant ${params.variant_id} not found`
      );
    }

    if (conversion.is_variable_ratio) {
      if (params.actual_weight === undefined || params.actual_weight === null) {
        throw new VariableRatioWeightRequiredError(
          `Actual weight is required for variable ratio conversion of UOM ${params.input_uom}`
        );
      }
      return new Prisma.Decimal(params.actual_weight);
    }

    return inputQty.mul(conversion.conversion_factor);
  }

  async fromBaseQty(
    params: FromBaseQtyParams,
    tx?: Prisma.TransactionClient
  ): Promise<Prisma.Decimal> {
    const db = this.getDb(tx);
    const variant = await db.productVariant.findUnique({
      where: { id: params.variant_id },
      include: { product: true },
    });

    if (!variant) {
      throw new ProductVariantNotFoundError(`Variant ${params.variant_id} not found`);
    }

    const baseQty = new Prisma.Decimal(params.base_qty);

    if (params.target_uom === variant.product.base_uom) {
      return baseQty;
    }

    const conversion = await db.uomConversion.findUnique({
      where: {
        variant_id_uom_name: {
          variant_id: params.variant_id,
          uom_name: params.target_uom,
        },
      },
    });

    if (!conversion) {
      throw new UomConversionNotFoundError(
        `Conversion to ${params.target_uom} for variant ${params.variant_id} not found`
      );
    }

    return baseQty.div(conversion.conversion_factor);
  }

  async calculateLinePrice(
    params: CalculateLinePriceParams,
    tx?: Prisma.TransactionClient
  ): Promise<LinePriceResult> {
    const db = this.getDb(tx);
    const variant = await db.productVariant.findUnique({
      where: { id: params.variant_id },
      include: {
        product: true,
        uom_conversions: true,
      },
    });

    if (!variant) {
      throw new ProductVariantNotFoundError(`Variant ${params.variant_id} not found`);
    }

    const isBaseUom = params.sold_uom === variant.product.base_uom;
    const conversion = isBaseUom
      ? null
      : (variant.uom_conversions?.find((c: any) => c.uom_name === params.sold_uom) ??
        (await db.uomConversion.findUnique({
          where: {
            variant_id_uom_name: {
              variant_id: params.variant_id,
              uom_name: params.sold_uom,
            },
          },
        })));

    if (!isBaseUom && !conversion) {
      throw new UomConversionNotFoundError(
        `Conversion for UOM ${params.sold_uom} on variant ${params.variant_id} not found`
      );
    }

    const isVariableRatio = conversion ? Boolean(conversion.is_variable_ratio) : false;
    const isWeighable = Boolean(variant.product.is_weighable) || isVariableRatio;

    let actualDeductedQty: Prisma.Decimal;
    const soldQty = new Prisma.Decimal(params.sold_qty);

    if (isVariableRatio) {
      if (params.actual_base_qty === undefined || params.actual_base_qty === null) {
        throw new VariableRatioWeightRequiredError(
          `Actual base quantity/weight is required for catch-weight item in UOM ${params.sold_uom}`
        );
      }
      actualDeductedQty = new Prisma.Decimal(params.actual_base_qty);
    } else if (isBaseUom) {
      actualDeductedQty =
        params.actual_base_qty !== undefined && params.actual_base_qty !== null
          ? new Prisma.Decimal(params.actual_base_qty)
          : soldQty;
    } else {
      actualDeductedQty =
        params.actual_base_qty !== undefined && params.actual_base_qty !== null
          ? new Prisma.Decimal(params.actual_base_qty)
          : soldQty.mul(conversion!.conversion_factor);
    }

    let unitPrice: Prisma.Decimal;
    let isPriceOverridden = false;

    if (params.override_unit_price !== undefined && params.override_unit_price !== null) {
      isPriceOverridden = true;
      unitPrice = new Prisma.Decimal(params.override_unit_price);

      let minAllowedPrice = new Prisma.Decimal(variant.min_selling_price);
      if (conversion && !conversion.is_variable_ratio) {
        minAllowedPrice = minAllowedPrice.mul(conversion.conversion_factor);
      }

      if (unitPrice.lt(minAllowedPrice) && !params.allow_below_min_price) {
        throw new MinPriceViolationError(
          `Override unit price ${unitPrice.toString()} is below minimum selling price ${minAllowedPrice.toString()}`
        );
      }
    } else {
      if (isBaseUom) {
        unitPrice = new Prisma.Decimal(variant.base_selling_price);
      } else {
        if (conversion!.default_price_for_uom !== null && conversion!.default_price_for_uom !== undefined) {
          unitPrice = new Prisma.Decimal(conversion!.default_price_for_uom);
        } else if (conversion!.is_variable_ratio) {
          unitPrice = new Prisma.Decimal(variant.base_selling_price);
        } else {
          unitPrice = new Prisma.Decimal(variant.base_selling_price).mul(conversion!.conversion_factor);
        }
      }
    }

    const lineTotal = isWeighable ? actualDeductedQty.mul(unitPrice) : soldQty.mul(unitPrice);

    return {
      unit_price: unitPrice,
      line_total: lineTotal,
      actual_deducted_qty: actualDeductedQty,
      is_price_overridden: isPriceOverridden,
    };
  }
}

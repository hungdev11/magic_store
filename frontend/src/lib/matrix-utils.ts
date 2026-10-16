// Matrix variant generation and slug helper functions

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

export function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((d) => curr.map((e) => [...d, e])),
    [[]]
  );
}

export interface AttributeInput {
  name: string;
  valuesStr: string;
}

export interface GeneratedVariant {
  sku: string;
  variant_name: string;
  attributes: Record<string, string>;
  cost_price: number;
  base_selling_price: number;
  min_selling_price: number;
  current_stock: number;
  image_url?: string;
}

export function generateVariantsFromAttributes(
  productCode: string,
  productName: string,
  attributes: AttributeInput[],
  defaultCost: number = 0,
  defaultSelling: number = 0,
  defaultMinSelling: number = 0,
  defaultStock: number = 0
): GeneratedVariant[] {
  const validAttrs = attributes
    .map((a) => ({
      name: a.name.trim(),
      values: a.valuesStr
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    }))
    .filter((a) => a.name.length > 0 && a.values.length > 0);

  if (validAttrs.length === 0) return [];

  const valueArrays = validAttrs.map((a) => a.values);
  const combos = cartesianProduct(valueArrays);
  const prefix = productCode.trim().toUpperCase() || "SKU";

  return combos.map((combo) => {
    const attrRecord: Record<string, string> = {};
    const slugParts: string[] = [];

    combo.forEach((val, idx) => {
      const attrName = validAttrs[idx].name;
      attrRecord[attrName] = val;
      const slugVal = slugify(val);
      slugParts.push(slugVal || `V${idx + 1}`);
    });

    const sku = `${prefix}-${slugParts.join("-")}`;
    const variant_name = `${productName.trim() || "Sản phẩm"} - ${combo.join(" - ")}`;

    return {
      sku,
      variant_name,
      attributes: attrRecord,
      cost_price: defaultCost,
      base_selling_price: defaultSelling,
      min_selling_price: defaultMinSelling,
      current_stock: defaultStock,
    };
  });
}

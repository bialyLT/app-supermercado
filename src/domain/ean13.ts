import Decimal from "decimal.js";

export type WeighedEan13 = Readonly<{
  variantCode: string;
  quantity?: Decimal;
  amount?: Decimal;
}>;

export type Ean13Config = Readonly<{
  prefix: string;
  mode: "WEIGHT" | "PRICE";
  variantDigits: number;
  valueDigits: number;
  valueScale: number;
}>;

export function parseWeighedEan13(raw: string, config: Ean13Config): WeighedEan13 {
  if (!/^\d{13}$/.test(raw)) throw new Error("INVALID_EAN13");
  if (!/^\d+$/.test(config.prefix) || raw.slice(0, config.prefix.length) !== config.prefix) {
    throw new Error("EAN13_PREFIX_MISMATCH");
  }
  const body = raw.slice(0, 12);
  const checksum = body.split("").reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  if ((10 - (checksum % 10)) % 10 !== Number(raw[12])) throw new Error("INVALID_EAN13_CHECKSUM");
  const start = config.prefix.length;
  const variantCode = raw.slice(start, start + config.variantDigits);
  const value = raw.slice(start + config.variantDigits, start + config.variantDigits + config.valueDigits);
  if (variantCode.length !== config.variantDigits || value.length !== config.valueDigits) throw new Error("INVALID_EAN13_LAYOUT");
  const decimal = new Decimal(value).div(new Decimal(10).pow(config.valueScale));
  return config.mode === "WEIGHT" ? { variantCode, quantity: decimal } : { variantCode, amount: decimal };
}

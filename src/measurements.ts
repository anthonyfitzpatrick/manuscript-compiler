const CENTIMETRES_PER_INCH = 2.54;
const TWIPS_PER_INCH = 1440;

export function centimetresToInches(value: number): number { return round(value / CENTIMETRES_PER_INCH); }
export function inchesToCentimetres(value: number): number { return round(value * CENTIMETRES_PER_INCH); }
export function centimetresToTwips(value: number): number { return Math.round(centimetresToInches(value) * TWIPS_PER_INCH); }
export function twipsToCentimetres(value: number): number { return inchesToCentimetres(value / TWIPS_PER_INCH); }

export function clampCentimetres(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return round(Math.min(maximum, Math.max(minimum, value)));
}

function round(value: number): number { return Math.round(value * 10_000) / 10_000; }

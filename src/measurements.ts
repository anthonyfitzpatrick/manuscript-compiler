/**
 * Manuscript Compiler — metric/OOXML measurement conversion.
 *
 * UI and persistence use centimetres; WordprocessingML uses twips. Centralised,
 * rounded conversion prevents formula duplication and migration drift.
 * Settings resolution and DOCX generation call these pure helpers. They own no
 * formatting policy, state, I/O, failure channel, or cancellation. Inputs are
 * constrained upstream; conversions must remain deterministic across JavaScript
 * engines and desktop/mobile builds.
 */
const CENTIMETRES_PER_INCH = 2.54;
const TWIPS_PER_INCH = 1440;

/** Converts canonical UI centimetres to compatibility inches with stable rounding. */
export function centimetresToInches(value: number): number { return round(value / CENTIMETRES_PER_INCH); }
/** Migrates legacy inch values into canonical centimetres without visual drift. */
export function inchesToCentimetres(value: number): number { return round(value * CENTIMETRES_PER_INCH); }
/** Converts UI/persisted indentation to the integer unit required by OOXML. */
export function centimetresToTwips(value: number): number { return Math.round(centimetresToInches(value) * TWIPS_PER_INCH); }
export function twipsToCentimetres(value: number): number { return inchesToCentimetres(value / TWIPS_PER_INCH); }

/** Repairs non-finite/out-of-range measurements before persistence or generation. */
export function clampCentimetres(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return round(Math.min(maximum, Math.max(minimum, value)));
}

function round(value: number): number { return Math.round(value * 10_000) / 10_000; }

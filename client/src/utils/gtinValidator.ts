/**
 * Validates a GTIN-14 check digit using GS1 modulo-10 algorithm.
 */
export function validateGtin14(gtin: string): { valid: boolean; error?: string } {
  if (!gtin) return { valid: false, error: 'GTIN is required' };
  if (gtin.length !== 14) return { valid: false, error: 'Must be 14 digits' };
  if (!/^\d+$/.test(gtin)) return { valid: false, error: 'Digits only' };

  const expected = computeGtinCheckDigit(gtin.substring(0, 13));
  if (expected !== parseInt(gtin[13], 10)) {
    return { valid: false, error: `Invalid check digit (expected ${expected})` };
  }
  return { valid: true };
}

/**
 * Computes check digit for first 13 digits of a GTIN-14.
 * From rightmost of those 13, assign alternating weights 3 and 1.
 */
export function computeGtinCheckDigit(first13: string): number {
  const digits = first13.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    // Position from right: index 12 is rightmost → weight 3, index 11 → weight 1, etc.
    const weight = (13 - i) % 2 === 1 ? 3 : 1;
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10;
}

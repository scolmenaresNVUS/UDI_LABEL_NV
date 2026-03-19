import type { GS1LabelData } from '../types/gs1.types';

/**
 * Formats Date to YYMMDD for GS1 date AIs.
 */
export function formatGS1Date(date: Date): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Builds the GS1 element string for bwip-js gs1datamatrix encoding.
 *
 * ENCODING ORDER (optimized for DataMatrix — fixed-length AIs first):
 *   LOT MODE:    "(01)GTIN(11)YYMMDD(10)LOTVALUE"
 *   SERIAL MODE: "(01)GTIN(17)YYMMDD(11)YYMMDD(21)SERIALVALUE"
 *   Variable-length field (10 or 21) is LAST so no GS separator is needed.
 *
 * bwip-js handles FNC1 automatically for gs1datamatrix — do NOT add manually.
 */
export function buildGS1ElementString(data: GS1LabelData): string {
  const mfgDate = formatGS1Date(data.manufacturingDate);

  if (data.identifierMode === 'lot') {
    // LOT: (01)GTIN(11)MfgDate(10)Lot — NO AI 17 EVER
    return `(01)${data.gtin}(11)${mfgDate}(10)${data.lotNumber || ''}`;
  } else {
    // SERIAL: (01)GTIN(17)ExpDate(11)MfgDate(21)Serial — WITH AI 17
    if (!data.expirationDate) {
      throw new Error('Serial mode requires expiration date');
    }
    const expDate = formatGS1Date(data.expirationDate);
    return `(01)${data.gtin}(17)${expDate}(11)${mfgDate}(21)${data.serialNumber || ''}`;
  }
}

/**
 * Builds HRI text lines in the correct DISPLAY order.
 *
 * HRI order is: GTIN → Identifier (lot or serial) → Date(s)
 *
 * LOT MODE — 3 lines:
 *   ["(01) 00850008393006", "(10) MG96CI-260116", "(11) 260116"]
 *
 * SERIAL MODE — 4 lines:
 *   ["(01) 00850008393006", "(21) BWIII2026-1234", "(11) 260218", "(17) 330218"]
 */
export function buildHriText(data: GS1LabelData): string[] {
  const mfgDate = formatGS1Date(data.manufacturingDate);

  if (data.identifierMode === 'lot') {
    return [
      `(01) ${data.gtin}`,
      `(10) ${data.lotNumber || ''}`,
      `(11) ${mfgDate}`,
    ];
  } else {
    const expDate = data.expirationDate ? formatGS1Date(data.expirationDate) : '';
    return [
      `(01) ${data.gtin}`,
      `(21) ${data.serialNumber || ''}`,
      `(11) ${mfgDate}`,
      `(17) ${expDate}`,
    ];
  }
}

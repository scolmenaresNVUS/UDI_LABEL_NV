import { TemplateElement, LabelTemplate } from '../types';

function mmToDots(mm: number, dpi: number): number {
  return Math.round(mm * (dpi / 25.4));
}

function fontSizeToDots(fontSize: number, dpi: number): number {
  return Math.round(fontSize * dpi / 72);
}

function rotationChar(rotation: number): string {
  switch (rotation) {
    case 90: return 'R';
    case 180: return 'I';
    case 270: return 'B';
    default: return 'N';
  }
}

function formatGS1Date(isoDate: string): string {
  const d = new Date(isoDate);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export interface ZplInput {
  template: LabelTemplate;
  data: {
    gtin: string;
    identifierMode: 'lot' | 'serial';
    lotNumber?: string;
    serialNumber?: string;
    manufacturingDate: string;
    expirationDate?: string;
  };
}

/**
 * Build GS1 element string for ZPL DataMatrix encoding.
 * LOT: (01)GTIN(11)MfgDate(10)Lot — NO AI 17
 * SERIAL: (01)GTIN(17)ExpDate(11)MfgDate(21)Serial — WITH AI 17
 */
export function buildZplGs1String(data: ZplInput['data']): string {
  const mfg = formatGS1Date(data.manufacturingDate);

  if (data.identifierMode === 'lot') {
    // LOT MODE: NO expiration date
    return `(01)${data.gtin}(11)${mfg}(10)${data.lotNumber || ''}`;
  } else {
    // SERIAL MODE: WITH expiration date
    if (!data.expirationDate) throw new Error('Serial mode requires expiration date');
    const exp = formatGS1Date(data.expirationDate);
    return `(01)${data.gtin}(17)${exp}(11)${mfg}(21)${data.serialNumber || ''}`;
  }
}

/**
 * Build HRI text lines in DISPLAY order for ZPL text commands.
 * LOT: (01) GTIN, (10) LOT, (11) MfgDate — 3 lines
 * SERIAL: (01) GTIN, (21) SERIAL, (11) MfgDate, (17) ExpDate — 4 lines
 */
function buildHriLines(data: ZplInput['data']): string[] {
  const mfg = formatGS1Date(data.manufacturingDate);

  if (data.identifierMode === 'lot') {
    return [
      `(01) ${data.gtin}`,
      `(10) ${data.lotNumber || ''}`,
      `(11) ${mfg}`,
    ];
  } else {
    const exp = data.expirationDate ? formatGS1Date(data.expirationDate) : '';
    return [
      `(01) ${data.gtin}`,
      `(21) ${data.serialNumber || ''}`,
      `(11) ${mfg}`,
      `(17) ${exp}`,
    ];
  }
}

/**
 * Generate ZPL II for a single label.
 */
export function generateZpl(input: ZplInput): string {
  const { template, data } = input;
  const dpi = template.dpi || 203;
  const wDots = mmToDots(template.widthMm, dpi);
  const hDots = mmToDots(template.heightMm, dpi);

  const lines: string[] = [
    '^XA',
    `^PW${wDots}`,
    `^LL${hDots}`,
    '^LH0,0',
  ];

  for (const el of template.elements) {
    const x = mmToDots(el.x_mm, dpi);
    const y = mmToDots(el.y_mm, dpi);
    const rot = rotationChar(el.rotation);

    switch (el.type) {
      case 'datamatrix': {
        const modSize = (el as any).moduleSize || 4;
        const gs1Str = buildZplGs1String(data);
        // ^BX for DataMatrix, ~1 for GS1 mode
        lines.push(`^FO${x},${y}^BX${rot},${modSize},200,,,,~1^FD${gs1Str}^FS`);
        break;
      }
      case 'hri_text': {
        const fontSize = (el as any).fontSize || 7;
        const font = (el as any).fontFamily || '0';
        const lineSpacing = (el as any).lineSpacing || 1.2;
        const fh = fontSizeToDots(fontSize, dpi);
        const fw = Math.round(fh * 0.6);
        const spacingDots = mmToDots(lineSpacing, dpi) + fh;

        const hriLines = buildHriLines(data);
        hriLines.forEach((text, i) => {
          const ly = y + i * spacingDots;
          lines.push(`^FO${x},${ly}^A${font}${rot},${fh},${fw}^FD${text}^FS`);
        });
        break;
      }
      case 'static_text': {
        const fontSize = (el as any).fontSize || 8;
        const font = (el as any).fontFamily || '0';
        const bold = (el as any).bold;
        const text = (el as any).text || '';
        const fh = fontSizeToDots(fontSize, dpi);
        const fw = Math.round(fh * 0.6);
        // Bold: use wider font
        const fwFinal = bold ? Math.round(fh * 0.8) : fw;
        lines.push(`^FO${x},${y}^A${font}${rot},${fh},${fwFinal}^FD${text}^FS`);
        break;
      }
      case 'line': {
        const ex = mmToDots((el as any).endX_mm || 0, dpi);
        const ey = mmToDots((el as any).endY_mm || 0, dpi);
        const thickness = (el as any).thickness || 1;
        const w = Math.abs(ex - x) || thickness;
        const h = Math.abs(ey - y) || thickness;
        lines.push(`^FO${x},${y}^GB${w},${h},${thickness}^FS`);
        break;
      }
      case 'rectangle': {
        const rw = mmToDots((el as any).width_mm || 10, dpi);
        const rh = mmToDots((el as any).height_mm || 10, dpi);
        const border = (el as any).borderThickness || 1;
        const filled = (el as any).filled;
        if (filled) {
          lines.push(`^FO${x},${y}^GB${rw},${rh},${rw},B^FS`);
        } else {
          lines.push(`^FO${x},${y}^GB${rw},${rh},${border}^FS`);
        }
        break;
      }
    }
  }

  lines.push('^XZ');
  return lines.join('\n');
}

/**
 * Batch ZPL for serial mode: one ^XA...^XZ per serial.
 */
export function generateBatchZpl(
  input: ZplInput,
  serials: string[],
  copiesPerLabel: number
): string {
  return serials.map(serial => {
    const singleInput: ZplInput = {
      ...input,
      data: { ...input.data, serialNumber: serial },
    };
    const zpl = generateZpl(singleInput);
    if (copiesPerLabel > 1) {
      return zpl.replace('^XZ', `^PQ${copiesPerLabel}\n^XZ`);
    }
    return zpl;
  }).join('\n');
}

/**
 * Batch ZPL for lot mode: same label repeated N times using ^PQ.
 */
export function generateLotBatchZpl(
  input: ZplInput,
  copies: number
): string {
  const zpl = generateZpl(input);
  return zpl.replace('^XZ', `^PQ${copies}\n^XZ`);
}

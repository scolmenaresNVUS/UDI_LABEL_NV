import bwipjs from 'bwip-js';

export interface LabelExportOptions {
  gs1String: string;
  hriLines: string[];
  labelWidthMm: number;
  labelHeightMm: number;
  elements: Array<{
    type: string;
    x_mm: number;
    y_mm: number;
    moduleSize?: number;
    fontSize?: number;
    lineSpacing?: number;
    text?: string;
    bold?: boolean;
    endX_mm?: number;
    endY_mm?: number;
    thickness?: number;
    width_mm?: number;
    height_mm?: number;
    borderThickness?: number;
    filled?: boolean;
  }>;
  dpi?: number;
  filename?: string;
}

// The templates are designed for ZPL rendering at this DPI
const ZPL_BASE_DPI = 203;

/**
 * Render a full label onto a high-resolution canvas.
 *
 * Layout-aware rendering:
 * 1. Pre-scan elements to detect the barcode/text spatial relationship
 *    (stacked vs side-by-side) and compute maximum barcode dimensions.
 * 2. Render the DataMatrix at a high intermediate scale, then drawImage
 *    at the constrained physical size so it never overflows into the
 *    text area or past the label edge.
 * 3. Auto-shrink HRI/static text if it would exceed available width.
 */
async function renderLabelCanvas(opts: LabelExportOptions): Promise<HTMLCanvasElement> {
  const dpi = opts.dpi || 600;
  const pxPerMm = dpi / 25.4;
  const canvasW = Math.round(opts.labelWidthMm * pxPerMm);
  const canvasH = Math.round(opts.labelHeightMm * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // Clip everything to label bounds
  ctx.beginPath();
  ctx.rect(0, 0, canvasW, canvasH);
  ctx.clip();

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const elements = opts.elements.length > 0
    ? opts.elements
    : defaultElements(opts.labelWidthMm, opts.labelHeightMm);

  // --- Pre-scan: determine barcode constraints from layout ---
  const dmEl = elements.find(e => e.type === 'datamatrix');
  const hriEl = elements.find(e => e.type === 'hri_text');
  const MARGIN_MM = 0.5; // safety margin

  // Maximum barcode dimensions in mm (defaults to label edge minus margin)
  let dmMaxWMm = opts.labelWidthMm - (dmEl?.x_mm ?? 0) - MARGIN_MM;
  let dmMaxHMm = opts.labelHeightMm - (dmEl?.y_mm ?? 0) - MARGIN_MM;

  if (dmEl && hriEl) {
    const sameRow = Math.abs(hriEl.y_mm - dmEl.y_mm) < 3; // within 3mm = side-by-side
    if (sameRow) {
      // Side-by-side: barcode max width = gap to text, full height available
      if (hriEl.x_mm > dmEl.x_mm) {
        dmMaxWMm = hriEl.x_mm - dmEl.x_mm - MARGIN_MM;
      }
    } else if (hriEl.y_mm > dmEl.y_mm) {
      // Stacked: barcode above text — limit height to gap above text
      dmMaxHMm = hriEl.y_mm - dmEl.y_mm - MARGIN_MM;
    }
  }
  // Barcode is square, so use the smaller constraint for both dimensions
  const dmMaxSizeMm = Math.max(4, Math.min(dmMaxWMm, dmMaxHMm));

  for (const el of elements) {
    const x = Math.round(el.x_mm * pxPerMm);
    const y = Math.round(el.y_mm * pxPerMm);

    switch (el.type) {
      case 'datamatrix': {
        if (!opts.gs1String) break;

        // Render barcode at a high intermediate scale for quality
        const RENDER_SCALE = 10;
        const barcodeCanvas = document.createElement('canvas');
        try {
          (bwipjs.toCanvas as Function)(barcodeCanvas, {
            bcid: 'gs1datamatrix',
            text: opts.gs1String,
            scale: RENDER_SCALE,
            padding: 0,
            parsefnc: true,
          });

          // Target: constrain to dmMaxSizeMm while keeping aspect ratio
          const maxPx = Math.round(dmMaxSizeMm * pxPerMm);
          // barcodeCanvas is square (DataMatrix), so use one dimension
          const targetSize = Math.min(maxPx, Math.round(barcodeCanvas.width * pxPerMm * dmMaxSizeMm / barcodeCanvas.width));

          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(barcodeCanvas, x, y, targetSize, targetSize);
          ctx.imageSmoothingEnabled = true;
        } catch {
          // barcode render failed — skip
        }
        break;
      }

      case 'hri_text': {
        const fontPt = el.fontSize || 7;
        let pxSize = Math.round(fontPt * dpi / 72);

        // Available width from text origin to label edge
        const availableW = canvasW - x - Math.round(MARGIN_MM * pxPerMm);

        // Measure widest line and auto-shrink if needed
        ctx.font = `${pxSize}px "Courier New", Courier, monospace`;
        let maxTextW = 0;
        for (const line of opts.hriLines) {
          const w = ctx.measureText(line).width;
          if (w > maxTextW) maxTextW = w;
        }
        if (maxTextW > availableW && availableW > 0) {
          pxSize = Math.floor(pxSize * availableW / maxTextW);
        }

        // Also check vertical fit: shrink if lines would exceed label bottom
        const lineGapInitial = el.lineSpacing
          ? Math.round(el.lineSpacing * pxPerMm) + pxSize
          : Math.round(pxSize * 1.4);
        const totalTextH = pxSize + (opts.hriLines.length - 1) * lineGapInitial;
        const availableH = canvasH - y - Math.round(MARGIN_MM * pxPerMm);
        if (totalTextH > availableH && availableH > 0) {
          const vScale = availableH / totalTextH;
          pxSize = Math.floor(pxSize * vScale);
        }

        const lineGap = el.lineSpacing
          ? Math.round(el.lineSpacing * pxPerMm * pxSize / Math.round((el.fontSize || 7) * dpi / 72)) + pxSize
          : Math.round(pxSize * 1.4);

        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        opts.hriLines.forEach((line, i) => {
          ctx.font = i === 0
            ? `bold ${pxSize}px "Courier New", Courier, monospace`
            : `${pxSize}px "Courier New", Courier, monospace`;
          ctx.fillText(line, x, y + i * lineGap);
        });
        break;
      }

      case 'static_text': {
        const fontPt = el.fontSize || 8;
        let pxSize = Math.round(fontPt * dpi / 72);
        const availableW = canvasW - x - Math.round(MARGIN_MM * pxPerMm);

        ctx.font = el.bold
          ? `bold ${pxSize}px "Courier New", Courier, monospace`
          : `${pxSize}px "Courier New", Courier, monospace`;
        const measured = ctx.measureText(el.text || '').width;
        if (measured > availableW && availableW > 0) {
          pxSize = Math.floor(pxSize * availableW / measured);
          ctx.font = el.bold
            ? `bold ${pxSize}px "Courier New", Courier, monospace`
            : `${pxSize}px "Courier New", Courier, monospace`;
        }

        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        ctx.fillText(el.text || '', x, y);
        break;
      }

      case 'line': {
        const endX = Math.round((el.endX_mm || el.x_mm) * pxPerMm);
        const endY = Math.round((el.endY_mm || el.y_mm) * pxPerMm);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, Math.round((el.thickness || 1) * pxPerMm / 8));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        break;
      }

      case 'rectangle': {
        const rw = Math.round((el.width_mm || 10) * pxPerMm);
        const rh = Math.round((el.height_mm || 10) * pxPerMm);
        if (el.filled) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, y, rw, rh);
        } else {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(1, Math.round((el.borderThickness || 1) * pxPerMm / 8));
          ctx.strokeRect(x, y, rw, rh);
        }
        break;
      }
    }
  }

  return canvas;
}

/** Fallback element positions when template has no elements */
function defaultElements(wMm: number, hMm: number) {
  return [
    { type: 'datamatrix', x_mm: wMm * 0.04, y_mm: hMm * 0.06, moduleSize: 3 },
    { type: 'hri_text', x_mm: wMm * 0.04, y_mm: hMm * 0.55, fontSize: 6, lineSpacing: 1.0 },
  ];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export the label as a high-resolution PNG image */
export async function exportLabelPng(opts: LabelExportOptions): Promise<void> {
  const canvas = await renderLabelCanvas(opts);
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(b => resolve(b!), 'image/png')
  );
  downloadBlob(blob, (opts.filename || 'label') + '.png');
}

/** Export the label as a PDF at exact physical dimensions */
export async function exportLabelPdf(opts: LabelExportOptions): Promise<void> {
  const canvas = await renderLabelCanvas(opts);

  // Render canvas to high-quality JPEG for PDF embedding
  const jpegBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(b => resolve(b!), 'image/jpeg', 1.0)
  );
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

  // Label dimensions in PDF points (1pt = 1/72 inch, 1mm = 72/25.4 pt)
  const pageW = +(opts.labelWidthMm * 72 / 25.4).toFixed(4);
  const pageH = +(opts.labelHeightMm * 72 / 25.4).toFixed(4);

  const pdfBlob = buildMinimalPdf(jpegBytes, canvas.width, canvas.height, pageW, pageH);
  downloadBlob(pdfBlob, (opts.filename || 'label') + '.pdf');
}

/**
 * Construct a minimal valid PDF (v1.4) with a single page containing
 * a full-bleed JPEG image at the specified physical dimensions.
 *
 * Structure: Catalog -> Pages -> Page -> ContentStream + Image XObject
 * The JPEG is embedded directly via DCTDecode (no re-encoding).
 */
function buildMinimalPdf(
  jpeg: Uint8Array,
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
): Blob {
  const contentStr = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  const enc = new TextEncoder();

  // All PDF object strings are pure ASCII (< 0x80), so string.length === byte length
  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`;
  const obj4a = `4 0 obj\n<< /Length ${contentStr.length} >>\nstream\n`;
  const obj4b = '\nendstream\nendobj\n';
  const obj5a = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`;
  const obj5b = '\nendstream\nendobj\n';

  // Calculate byte offsets for xref table
  let pos = header.length;
  const off1 = pos; pos += obj1.length;
  const off2 = pos; pos += obj2.length;
  const off3 = pos; pos += obj3.length;
  const off4 = pos; pos += obj4a.length + contentStr.length + obj4b.length;
  const off5 = pos; pos += obj5a.length + jpeg.length + obj5b.length;
  const xrefPos = pos;

  const pad = (n: number) => String(n).padStart(10, '0');
  const xref = [
    'xref\n0 6\n',
    '0000000000 65535 f \n',
    `${pad(off1)} 00000 n \n`,
    `${pad(off2)} 00000 n \n`,
    `${pad(off3)} 00000 n \n`,
    `${pad(off4)} 00000 n \n`,
    `${pad(off5)} 00000 n \n`,
    'trailer\n<< /Size 6 /Root 1 0 R >>\n',
    `startxref\n${xrefPos}\n%%EOF\n`,
  ].join('');

  return new Blob(
    [
      enc.encode(header),
      enc.encode(obj1),
      enc.encode(obj2),
      enc.encode(obj3),
      enc.encode(obj4a), enc.encode(contentStr), enc.encode(obj4b),
      enc.encode(obj5a), jpeg, enc.encode(obj5b),
      enc.encode(xref),
    ],
    { type: 'application/pdf' },
  );
}

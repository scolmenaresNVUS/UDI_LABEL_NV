import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { templateStore } from '../stores';
import { generateZpl, generateBatchZpl, generateLotBatchZpl, ZplInput } from '../services/zpl.service';
import { generateDataMatrixPng } from '../services/barcode.service';

const router = Router();

// POST /api/zpl/generate - generate ZPL for a single label
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { templateId, data } = req.body;
    const template = await templateStore.findById(templateId);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const input: ZplInput = { template, data };
    const zpl = generateZpl(input);
    res.json({ zpl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ZPL generation failed';
    res.status(500).json({ error: msg });
  }
});

// POST /api/zpl/batch-generate - generate batch ZPL
router.post('/batch-generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { templateId, data, serials, copies, copiesPerLabel } = req.body;
    const template = await templateStore.findById(templateId);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const input: ZplInput = { template, data };
    let zpl: string;

    if (data.identifierMode === 'serial' && serials?.length) {
      zpl = generateBatchZpl(input, serials, copiesPerLabel || 1);
    } else {
      zpl = generateLotBatchZpl(input, copies || 1);
    }

    res.json({ zpl, labelCount: serials?.length || copies || 1 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Batch ZPL generation failed';
    res.status(500).json({ error: msg });
  }
});

// POST /api/zpl/preview-image - render ZPL via Labelary API
router.post('/preview-image', authenticate, async (req: Request, res: Response) => {
  try {
    const { zpl, dpi, widthInches, heightInches } = req.body;
    const labelaryDpi = dpi || 8; // 8dpmm = ~203 DPI
    const w = widthInches || 2;
    const h = heightInches || 1;

    const response = await fetch(
      `http://api.labelary.com/v1/printers/${labelaryDpi}dpmm/labels/${w}x${h}/0/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: zpl,
      }
    );

    if (!response.ok) {
      res.status(500).json({ error: 'Labelary API error' });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Preview generation failed' });
  }
});

// POST /api/export/png - export barcode as PNG
router.post('/export/png', authenticate, async (req: Request, res: Response) => {
  try {
    const { gs1ElementString, moduleSize } = req.body;
    const png = await generateDataMatrixPng(gs1ElementString, moduleSize || 5);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename=barcode.png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'PNG export failed' });
  }
});

export default router;

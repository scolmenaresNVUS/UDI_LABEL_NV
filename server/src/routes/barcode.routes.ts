import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateDataMatrixPng } from '../services/barcode.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const barcodeSchema = z.object({
  gs1ElementString: z.string().min(1),
  moduleSize: z.number().min(1).max(10).optional(),
});

// POST /api/barcode/preview
router.post('/preview', authenticate, async (req: Request, res: Response) => {
  try {
    const { gs1ElementString, moduleSize } = barcodeSchema.parse(req.body);
    const png = await generateDataMatrixPng(gs1ElementString, moduleSize);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    const message = err instanceof Error ? err.message : 'Barcode generation failed';
    res.status(500).json({ error: message });
  }
});

export default router;

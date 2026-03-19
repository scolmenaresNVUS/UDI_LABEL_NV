import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const ZBP_URL = 'http://localhost:9100';

// Proxy: GET /api/zebra/available
router.get('/available', authenticate, async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const zbpRes = await fetch(`${ZBP_URL}/available`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!zbpRes.ok) {
      res.json({ available: false, error: `ZBP returned ${zbpRes.status}` });
      return;
    }
    const data = await zbpRes.json() as Record<string, unknown>;
    res.json({ available: true, ...data });
  } catch (err: any) {
    res.json({ available: false, error: err.message || 'Cannot reach Zebra Browser Print' });
  }
});

// Proxy: GET /api/zebra/default
router.get('/default', authenticate, async (_req: Request, res: Response) => {
  try {
    const zbpRes = await fetch(`${ZBP_URL}/default?type=printer`);
    if (!zbpRes.ok) {
      res.json({});
      return;
    }
    const data = await zbpRes.json();
    res.json(data);
  } catch {
    res.json({});
  }
});

// Proxy: POST /api/zebra/write — send ZPL to printer
router.post('/write', authenticate, async (req: Request, res: Response) => {
  try {
    const zbpRes = await fetch(`${ZBP_URL}/write`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    if (!zbpRes.ok) {
      const errText = await zbpRes.text().catch(() => '');
      res.status(zbpRes.status).json({ error: `ZBP write failed: ${errText}` });
      return;
    }
    const text = await zbpRes.text();
    res.json({ success: true, response: text });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send to Zebra Browser Print' });
  }
});

// Proxy: POST /api/zebra/read — read printer status
router.post('/read', authenticate, async (req: Request, res: Response) => {
  try {
    const zbpRes = await fetch(`${ZBP_URL}/read`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    if (!zbpRes.ok) {
      res.json({ status: 'Error' });
      return;
    }
    const text = await zbpRes.text();
    res.json({ status: text || 'Ready' });
  } catch {
    res.json({ status: 'Offline' });
  }
});

export default router;

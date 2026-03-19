import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { printerStore } from '../stores';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { logAction } from '../services/audit.service';
import { NetworkTcpDriver } from '../drivers/NetworkTcpDriver';

const router = Router();

// GET /api/printers
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const printers = await printerStore.readAll();
  res.json(printers);
});

// POST /api/printers
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const printer = {
    id: uuidv4(),
    name: req.body.name || 'New Printer',
    connectionType: req.body.connectionType || 'zebra_browser_print',
    ipAddress: req.body.ipAddress || null,
    port: req.body.port || 9100,
    printerModel: req.body.printerModel || 'Zebra GK420D',
    dpi: req.body.dpi || 203,
    driver: 'zebra_zpl',
    isDefault: req.body.isDefault || false,
    createdBy: req.user!.id,
    createdAt: now,
    updatedAt: now,
  };

  // If setting as default, unset others
  if (printer.isDefault) {
    const all = await printerStore.readAll();
    for (const p of all) {
      if (p.isDefault) await printerStore.updateById(p.id, { isDefault: false } as any);
    }
  }

  await printerStore.append(printer);
  await logAction(req.user!.id, req.user!.username, 'printer.create', 'printer', printer.id, { name: printer.name }, req.ip as string || '');
  res.status(201).json(printer);
});

// PUT /api/printers/:id
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const updated = await printerStore.updateById(req.params.id as string, {
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) {
    res.status(404).json({ error: 'Printer not found' });
    return;
  }
  res.json(updated);
});

// DELETE /api/printers/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const deleted = await printerStore.deleteById(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Printer not found' });
    return;
  }
  await logAction(req.user!.id, req.user!.username, 'printer.delete', 'printer', req.params.id as string, {}, req.ip as string || '');
  res.json({ message: 'Printer deleted' });
});

// POST /api/printers/:id/test
router.post('/:id/test', authenticate, async (req: Request, res: Response) => {
  const printer = await printerStore.findById(req.params.id as string);
  if (!printer) {
    res.status(404).json({ error: 'Printer not found' });
    return;
  }

  if (printer.connectionType === 'network_tcp' && printer.ipAddress) {
    try {
      const driver = new NetworkTcpDriver(printer.ipAddress, printer.port);
      await driver.sendTestLabel(printer.name);
      res.json({ success: true, message: 'Test label sent' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test print failed';
      res.status(500).json({ error: msg });
    }
  } else {
    // For Zebra Browser Print, return test ZPL for client-side delivery
    const testZpl = `^XA\n^FO50,50^A0N,40,40^FDTest Print^FS\n^FO50,100^A0N,25,25^FD${printer.name}^FS\n^FO50,140^A0N,25,25^FD${new Date().toISOString()}^FS\n^XZ`;
    res.json({ success: true, zpl: testZpl, deliveryMethod: 'zebra_browser_print' });
  }
});

// POST /api/printers/:id/set-default
router.post('/:id/set-default', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const all = await printerStore.readAll();
  for (const p of all) {
    await printerStore.updateById(p.id, { isDefault: p.id === req.params.id as string } as any);
  }
  res.json({ message: 'Default printer set' });
});

export default router;

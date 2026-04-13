import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { printJobStore, serialCounterStore, templateStore, printerStore, productStore } from '../stores';
import { authenticate } from '../middleware/auth.middleware';
import { logAction } from '../services/audit.service';
import { generateZpl, generateBatchZpl, generateLotBatchZpl, ZplInput } from '../services/zpl.service';
import { NetworkTcpDriver } from '../drivers/NetworkTcpDriver';

const router = Router();

// GET /api/print-jobs
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const jobs = await printJobStore.readAll();
  // Sort by creation date descending
  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(jobs);
});

// GET /api/print-jobs/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const job = await printJobStore.findById(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Print job not found' });
    return;
  }
  res.json(job);
});

// POST /api/print-jobs - Create a new print job
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      templateId, printerId, productId, identifierMode,
      gtin, lotNumber, serialNumbers, manufacturingDate,
      expirationDate, totalLabels, copiesPerLabel, includeDataMatrix
    } = req.body;

    const template = await templateStore.findById(templateId);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Build ZPL
    const data = {
      gtin,
      identifierMode,
      lotNumber: lotNumber || undefined,
      serialNumber: serialNumbers?.[0] || undefined,
      manufacturingDate,
      expirationDate: expirationDate || undefined,
    };

    // Free-text mode: only the dedicated "LOT Label" product prints raw text without GS1/DataMatrix.
    const product = productId ? await productStore.findById(productId) : null;
    const freeTextMode = !!product && (product as any).partNumber === 'LOT LABEL';

    const input: ZplInput = {
      template,
      data,
      includeDataMatrix: freeTextMode ? false : includeDataMatrix !== false,
      freeTextMode,
    };
    let zpl: string;

    if (identifierMode === 'serial' && serialNumbers?.length) {
      zpl = generateBatchZpl(input, serialNumbers, copiesPerLabel || 1);
    } else {
      zpl = generateLotBatchZpl(input, totalLabels || 1);
    }

    const now = new Date().toISOString();
    const job = {
      id: uuidv4(),
      userId: req.user!.id,
      templateId,
      printerId: printerId || '',
      productId,
      identifierMode,
      gtin,
      lotNumber: lotNumber || null,
      serialPatternJson: serialNumbers ? JSON.stringify(serialNumbers) : null,
      manufacturingDate,
      expirationDate: expirationDate || null,
      totalLabels: serialNumbers?.length || totalLabels || 1,
      copiesPerLabel: copiesPerLabel || 1,
      status: 'queued' as const,
      labelsPrinted: 0,
      errorMessage: null,
      zplData: zpl,
      createdAt: now,
      completedAt: null,
    };

    await printJobStore.append(job);
    await logAction(req.user!.id, req.user!.username, 'printjob.create', 'printjob', job.id,
      { productId, identifierMode, totalLabels: job.totalLabels }, req.ip as string || '');

    res.status(201).json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create print job';
    res.status(500).json({ error: msg });
  }
});

// POST /api/print-jobs/:id/print - Execute printing (send ZPL to printer)
router.post('/:id/print', authenticate, async (req: Request, res: Response) => {
  const job = await printJobStore.findById(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Print job not found' });
    return;
  }

  if (!job.zplData) {
    res.status(400).json({ error: 'No ZPL data in job' });
    return;
  }

  const printer = job.printerId ? await printerStore.findById(job.printerId) : null;

  // If printer is network TCP, send directly
  if (printer && printer.connectionType === 'network_tcp' && printer.ipAddress) {
    try {
      await printJobStore.updateById(job.id, { status: 'printing', labelsPrinted: 0 } as any);

      const driver = new NetworkTcpDriver(printer.ipAddress, printer.port);
      await driver.sendJob(job.zplData);

      await printJobStore.updateById(job.id, {
        status: 'completed',
        labelsPrinted: job.totalLabels,
        completedAt: new Date().toISOString(),
      } as any);

      // Update serial counters if serial mode
      if (job.identifierMode === 'serial' && job.serialPatternJson) {
        await updateSerialCounters(job.serialPatternJson);
      }

      await logAction(req.user!.id, req.user!.username, 'printjob.complete', 'printjob', job.id,
        { totalLabels: job.totalLabels }, req.ip as string || '');

      res.json({ success: true, message: 'Print job sent to network printer' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      await printJobStore.updateById(job.id, { status: 'failed', errorMessage: msg } as any);
      res.status(500).json({ error: msg });
    }
  } else {
    // Zebra Browser Print: return ZPL for client-side delivery
    await printJobStore.updateById(job.id, { status: 'printing' } as any);
    res.json({
      success: true,
      deliveryMethod: 'zebra_browser_print',
      zpl: job.zplData,
      jobId: job.id,
      totalLabels: job.totalLabels,
    });
  }
});

// POST /api/print-jobs/:id/complete - Mark job as completed (called by client after ZBP delivery)
router.post('/:id/complete', authenticate, async (req: Request, res: Response) => {
  const job = await printJobStore.findById(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Print job not found' });
    return;
  }

  await printJobStore.updateById(job.id, {
    status: 'completed',
    labelsPrinted: job.totalLabels,
    completedAt: new Date().toISOString(),
  } as any);

  // Update serial counters if serial mode
  if (job.identifierMode === 'serial' && job.serialPatternJson) {
    await updateSerialCounters(job.serialPatternJson);
  }

  await logAction(req.user!.id, req.user!.username, 'printjob.complete', 'printjob', job.id,
    { totalLabels: job.totalLabels }, req.ip as string || '');

  res.json({ message: 'Job marked as completed' });
});

// POST /api/print-jobs/:id/cancel
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  const job = await printJobStore.findById(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Print job not found' });
    return;
  }

  await printJobStore.updateById(job.id, { status: 'cancelled' } as any);
  res.json({ message: 'Job cancelled' });
});

// POST /api/print-jobs/:id/fail
router.post('/:id/fail', authenticate, async (req: Request, res: Response) => {
  const job = await printJobStore.findById(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Print job not found' });
    return;
  }

  await printJobStore.updateById(job.id, {
    status: 'failed',
    errorMessage: req.body.errorMessage || 'Print failed',
  } as any);
  res.json({ message: 'Job marked as failed' });
});

// GET /api/serial-counters/:prefix/:year
router.get('/serial-counters/:prefix/:year', authenticate, async (req: Request, res: Response) => {
  const { prefix, year } = req.params as { prefix: string; year: string };
  const counters = await serialCounterStore.readAll();
  const counter = counters.find(c => c.prefix === prefix && c.year === parseInt(year));
  res.json({ lastUsed: counter?.lastUsed || 0, nextSuggested: (counter?.lastUsed || 0) + 1 });
});

async function updateSerialCounters(serialPatternJson: string): Promise<void> {
  try {
    const serials = JSON.parse(serialPatternJson) as string[];
    if (serials.length === 0) return;

    // Extract prefix and find max number
    // Serial format: PREFIX-YYNNN or similar
    const lastSerial = serials[serials.length - 1];
    const match = lastSerial.match(/^(.+?)(\d+)$/);
    if (!match) return;

    const prefix = match[1].replace(/-$/, '');
    const lastNum = parseInt(match[2]);
    const year = new Date().getFullYear();

    const counters = await serialCounterStore.readAll();
    const existing = counters.find(c => c.prefix === prefix && c.year === year);

    if (existing) {
      if (lastNum > existing.lastUsed) {
        await serialCounterStore.updateById(existing.id, {
          lastUsed: lastNum,
          updatedAt: new Date().toISOString(),
        } as any);
      }
    } else {
      const { v4: uuidv4 } = await import('uuid');
      await serialCounterStore.append({
        id: uuidv4(),
        prefix,
        year,
        lastUsed: lastNum,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Non-critical, don't fail the print
  }
}

export default router;

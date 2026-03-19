import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { productStore } from '../stores';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { logAction } from '../services/audit.service';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1),
  partNumber: z.string().min(1),
  gtin: z.string().length(14).regex(/^\d+$/),
  description: z.string().optional().default(''),
  identifierMode: z.enum(['lot', 'serial']),
  lotPrefix: z.string().nullable().optional().default(null),
  serialPrefix: z.string().nullable().optional().default(null),
  serialStart: z.number().nullable().optional().default(null),
  shelfLifeYears: z.number().min(0).optional().default(0),
  shelfLifeMonths: z.number().min(0).optional().default(0),
  shelfLifeDays: z.number().min(0).optional().default(0),
});

// GET /api/products
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const products = await productStore.readAll();
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const product = await productStore.findById(req.params.id as string);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});

// POST /api/products
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const data = productSchema.parse(req.body);
    const now = new Date().toISOString();
    const product = {
      id: uuidv4(),
      ...data,
      createdBy: req.user!.id,
      createdAt: now,
      updatedAt: now,
    };
    await productStore.append(product);
    await logAction(req.user!.id, req.user!.username, 'product.create', 'product', product.id, { name: data.name }, req.ip as string || '');
    res.status(201).json(product);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const data = productSchema.parse(req.body);
    const updated = await productStore.updateById(req.params.id as string, {
      ...data,
      updatedAt: new Date().toISOString(),
    } as any);
    if (!updated) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    await logAction(req.user!.id, req.user!.username, 'product.update', 'product', req.params.id as string, { name: data.name }, req.ip as string || '');
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const deleted = await productStore.deleteById(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  await logAction(req.user!.id, req.user!.username, 'product.delete', 'product', req.params.id as string, {}, req.ip as string || '');
  res.json({ message: 'Product deleted' });
});

// POST /api/products/seed - seed the 39 default products
router.post('/seed', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const existing = await productStore.readAll();
  if (existing.length > 0) {
    res.status(400).json({ error: 'Products already exist. Delete all first to re-seed.' });
    return;
  }

  const now = new Date().toISOString();
  const products = DEFAULT_PRODUCTS.map(p => ({
    ...p,
    id: uuidv4(),
    createdBy: req.user!.id,
    createdAt: now,
    updatedAt: now,
  }));

  for (const p of products) {
    await productStore.append(p);
  }

  await logAction(req.user!.id, req.user!.username, 'product.seed', 'product', 'bulk', { count: products.length }, req.ip as string || '');
  res.status(201).json({ message: `Seeded ${products.length} products`, count: products.length });
});

export default router;

const DEFAULT_PRODUCTS = [
  // SERIAL MODE — BWIII family
  { name: "PV2010E - BWIII Basics", partNumber: "PV2010E", gtin: "00850008393174", description: "BWIII Basics System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWIII", serialStart: 3000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV2006E - BWIII EEG", partNumber: "PV2006E", gtin: "00850008393181", description: "BWIII EEG System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWIII", serialStart: 3000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV2007E - BWIII EEG Plus", partNumber: "PV2007E", gtin: "00850008393198", description: "BWIII EEG Plus System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWIII", serialStart: 3000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV2008E - BWIII PSG", partNumber: "PV2008E", gtin: "00850008393204", description: "BWIII PSG System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWIII", serialStart: 3000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV2009E - BWIII PSG Plus", partNumber: "PV2009E", gtin: "00850008393211", description: "BWIII PSG Plus System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWIII", serialStart: 3000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // SERIAL MODE — BWMini family
  { name: "PV2310 - BWMini EEG", partNumber: "PV2310", gtin: "00850008393235", description: "BWMini EEG System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWM", serialStart: 6000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV2312 - BWMini HST", partNumber: "PV2312", gtin: "00850008393242", description: "BWMini HST System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWM", serialStart: 6000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1842 - BWMini HST Compass", partNumber: "SI1842", gtin: "00850008393259", description: "BWMini HST Compass System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWM", serialStart: 6000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV2311 - BWMini PSG", partNumber: "PV2311", gtin: "00850008393228", description: "BWMini PSG System", identifierMode: "serial" as const, lotPrefix: null, serialPrefix: "BWM", serialStart: 6000, shelfLifeYears: 7, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — Gold Electrodes
  { name: "PV1010-33CI - Maxxi Gold Electrode 48\"", partNumber: "PV1010-33CI", gtin: "00850008393044", description: "Maxxi Gold Electrode 48 inch", identifierMode: "lot" as const, lotPrefix: "MG48CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV1010-13CI - Maxxi Gold Electrode 60\"", partNumber: "PV1010-13CI", gtin: "00867975000295", description: "Maxxi Gold Electrode 60 inch", identifierMode: "lot" as const, lotPrefix: "MG60CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "PV1010-23CI - Maxxi Gold Electrode 96\"", partNumber: "PV1010-23CI", gtin: "00850008393006", description: "Maxxi Gold Electrode 96 inch", identifierMode: "lot" as const, lotPrefix: "MG96CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — Snap Electrodes
  { name: "SI1872 - Maxxi Gold Snap Electrode 48\"", partNumber: "SI1872", gtin: "00850008393037", description: "Maxxi Gold Snap Electrode 48 inch", identifierMode: "lot" as const, lotPrefix: "MS48CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1873 - Maxxi Gold Snap Electrode 60\"", partNumber: "SI1873", gtin: "00850008393020", description: "Maxxi Gold Snap Electrode 60 inch", identifierMode: "lot" as const, lotPrefix: "MS60CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1778B - Maxxi Gold Snap Electrode 96\"", partNumber: "SI1778B", gtin: "00850008393013", description: "Maxxi Gold Snap Electrode 96 inch", identifierMode: "lot" as const, lotPrefix: "MS96CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — AgCl Electrodes
  { name: "SI2036 - Maxxi Gold AgCl Electrode 60\" Disposable", partNumber: "SI2036", gtin: "00850008393303", description: "AgCl Electrode 60 inch Disposable", identifierMode: "lot" as const, lotPrefix: "MA60CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI2137 - Maxxi Gold AgCl Electrode 60\" Reusable", partNumber: "SI2137", gtin: "00850008393358", description: "AgCl Electrode 60 inch Reusable", identifierMode: "lot" as const, lotPrefix: "MAR60CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI2037 - Maxxi Gold AgCl Electrode 96\" Disposable", partNumber: "SI2037", gtin: "00850008393365", description: "AgCl Electrode 96 inch Disposable", identifierMode: "lot" as const, lotPrefix: "MA96CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI2138 - Maxxi Gold AgCl Electrode 96\" Reusable", partNumber: "SI2138", gtin: "00850008393310", description: "AgCl Electrode 96 inch Reusable", identifierMode: "lot" as const, lotPrefix: "MAR96CI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — Flow Sensors
  { name: "SI1775B - Maxxi Flow Sensor 3ft Key Connector", partNumber: "SI1775B", gtin: "00850008393341", description: "Flow Sensor 3ft Key", identifierMode: "lot" as const, lotPrefix: "MF3KCI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1776B - Maxxi Flow Sensor 7ft Key Connector", partNumber: "SI1776B", gtin: "00850008393334", description: "Flow Sensor 7ft Key", identifierMode: "lot" as const, lotPrefix: "MF7KCI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1486C - Maxxi Flow Sensor 7ft TP Connector", partNumber: "SI1486C", gtin: "00850008393327", description: "Flow Sensor 7ft TP", identifierMode: "lot" as const, lotPrefix: "MF7SCI", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — Position Sensors (shared GTIN)
  { name: "SI1247U - Maxxi Position Sensor AC 1.0", partNumber: "SI1247U", gtin: "00850008393297", description: "Position Sensor AC 1.0", identifierMode: "lot" as const, lotPrefix: "MP", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1247A - Maxxi Position Sensor AC 1.1", partNumber: "SI1247A", gtin: "00850008393297", description: "Position Sensor AC 1.1", identifierMode: "lot" as const, lotPrefix: "MPAC", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1247D - Maxxi Position Sensor DC", partNumber: "SI1247D", gtin: "00850008393297", description: "Position Sensor DC", identifierMode: "lot" as const, lotPrefix: "MPDC", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — RIP
  { name: "SI2121 - Maxxi RIP Abdomen Interface 3ft", partNumber: "SI2121", gtin: "00850008393136", description: "RIP Abdomen Interface 3ft", identifierMode: "lot" as const, lotPrefix: "IA3", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI2124 - Maxxi RIP Abdomen Interface 7ft", partNumber: "SI2124", gtin: "00850008393143", description: "RIP Abdomen Interface 7ft", identifierMode: "lot" as const, lotPrefix: "IA7", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1659 - Maxxi RIP Adjustable Inductive Belt", partNumber: "SI1659", gtin: "00850008393105", description: "RIP Adjustable Inductive Belt", identifierMode: "lot" as const, lotPrefix: "AB", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1660 - Maxxi RIP Infant Inductive Belt", partNumber: "SI1660", gtin: "00850008393051", description: "RIP Infant Inductive Belt", identifierMode: "lot" as const, lotPrefix: "IB", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1693 - Maxxi RIP Large Inductive Belt", partNumber: "SI1693", gtin: "00850008393075", description: "RIP Large Inductive Belt", identifierMode: "lot" as const, lotPrefix: "LB", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1665 - Maxxi RIP Pediatric Inductive Belt", partNumber: "SI1665", gtin: "00850008393068", description: "RIP Pediatric Inductive Belt", identifierMode: "lot" as const, lotPrefix: "PB", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI2125 - Maxxi RIP Thorax Interface 3ft", partNumber: "SI2125", gtin: "00850008393129", description: "RIP Thorax Interface 3ft", identifierMode: "lot" as const, lotPrefix: "IT3", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI2123 - Maxxi RIP Thorax Interface 7ft", partNumber: "SI2123", gtin: "00850008393112", description: "RIP Thorax Interface 7ft", identifierMode: "lot" as const, lotPrefix: "IT7", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1694 - Maxxi RIP X-Large Inductive Belt", partNumber: "SI1694", gtin: "00850008393082", description: "RIP X-Large Inductive Belt", identifierMode: "lot" as const, lotPrefix: "XLB", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1662 - Maxxi RIP XX-Large Inductive Belt", partNumber: "SI1662", gtin: "00850008393099", description: "RIP XX-Large Inductive Belt", identifierMode: "lot" as const, lotPrefix: "XXLB", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — Snore
  { name: "SI1866B - Maxxi Snore 2ft Key Connector", partNumber: "SI1866B", gtin: "00850008393266", description: "Snore 2ft Key", identifierMode: "lot" as const, lotPrefix: "MS2K", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1784B - Maxxi Snore 7ft Key Connector", partNumber: "SI1784B", gtin: "00850008393273", description: "Snore 7ft Key", identifierMode: "lot" as const, lotPrefix: "MS7K", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1487B - Maxxi Snore 7ft TP Connector", partNumber: "SI1487B", gtin: "00850008393280", description: "Snore 7ft TP", identifierMode: "lot" as const, lotPrefix: "MS7S", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  // LOT MODE — Cannula
  { name: "SI1058 - Maxxi Cannula 7ft Adult Nasal/Oral", partNumber: "SI1058", gtin: "00850008393389", description: "Cannula 7ft Adult Nasal/Oral", identifierMode: "lot" as const, lotPrefix: "MCANO7", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1057 - Maxxi Cannula 7ft Nasal", partNumber: "SI1057", gtin: "00850008393396", description: "Cannula 7ft Nasal", identifierMode: "lot" as const, lotPrefix: "MCAN7", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
  { name: "SI1195 - Maxxi Cannula 2ft Nasal", partNumber: "SI1195", gtin: "00850008393372", description: "Cannula 2ft Nasal", identifierMode: "lot" as const, lotPrefix: "MCAN2", serialPrefix: null, serialStart: null, shelfLifeYears: 0, shelfLifeMonths: 0, shelfLifeDays: 0 },
];

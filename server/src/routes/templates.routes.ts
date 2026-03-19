import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { templateStore } from '../stores';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { logAction } from '../services/audit.service';
import { LabelTemplate } from '../types';

const router = Router();

// GET /api/templates - list current versions only
router.get('/', authenticate, async (_req: Request, res: Response) => {
  const all = await templateStore.readAll();
  res.json(all.filter(t => t.isCurrent));
});

// GET /api/templates/:id
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const template = await templateStore.findById(req.params.id as string);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(template);
});

// GET /api/templates/:id/versions
router.get('/:id/versions', authenticate, async (req: Request, res: Response) => {
  const template = await templateStore.findById(req.params.id as string);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  const all = await templateStore.readAll();
  const versions = all
    .filter(t => t.templateGroupId === template.templateGroupId)
    .sort((a, b) => b.version - a.version);
  res.json(versions);
});

// POST /api/templates - create new
router.post('/', authenticate, async (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const id = uuidv4();
  const templateGroupId = uuidv4();

  const template: LabelTemplate = {
    id,
    templateGroupId,
    version: 1,
    isCurrent: true,
    name: req.body.name || 'Untitled Template',
    description: req.body.description || '',
    widthMm: req.body.widthMm || 50.8,
    heightMm: req.body.heightMm || 25.4,
    marginMm: req.body.marginMm ?? 1,
    dpi: req.body.dpi || 203,
    elements: req.body.elements || [],
    createdBy: req.user!.id,
    createdAt: now,
  };

  await templateStore.append(template);
  await logAction(req.user!.id, req.user!.username, 'template.create', 'template', id, { name: template.name }, req.ip as string || '');
  res.status(201).json(template);
});

// PUT /api/templates/:id - versioned update
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  const all = await templateStore.readAll();
  const current = all.find(t => t.id === req.params.id as string);

  if (!current) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  // Mark old as not current
  current.isCurrent = false;

  // Create new version
  const now = new Date().toISOString();
  const newVersion: LabelTemplate = {
    id: uuidv4(),
    templateGroupId: current.templateGroupId,
    version: current.version + 1,
    isCurrent: true,
    name: req.body.name || current.name,
    description: req.body.description ?? current.description,
    widthMm: req.body.widthMm ?? current.widthMm,
    heightMm: req.body.heightMm ?? current.heightMm,
    marginMm: req.body.marginMm ?? current.marginMm ?? 1,
    dpi: req.body.dpi ?? current.dpi,
    elements: req.body.elements ?? current.elements,
    createdBy: req.user!.id,
    createdAt: now,
  };

  all.push(newVersion);
  await templateStore.write(all);
  await logAction(req.user!.id, req.user!.username, 'template.update', 'template', newVersion.id, { name: newVersion.name, version: newVersion.version }, req.ip as string || '');
  res.json(newVersion);
});

// POST /api/templates/:id/duplicate
router.post('/:id/duplicate', authenticate, async (req: Request, res: Response) => {
  const template = await templateStore.findById(req.params.id as string);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const now = new Date().toISOString();
  const dup: LabelTemplate = {
    ...template,
    id: uuidv4(),
    templateGroupId: uuidv4(),
    version: 1,
    isCurrent: true,
    name: `${template.name} (Copy)`,
    createdBy: req.user!.id,
    createdAt: now,
  };

  await templateStore.append(dup);
  res.status(201).json(dup);
});

// DELETE /api/templates/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const deleted = await templateStore.deleteById(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  await logAction(req.user!.id, req.user!.username, 'template.delete', 'template', req.params.id as string, {}, req.ip as string || '');
  res.json({ message: 'Template deleted' });
});

// POST /api/templates/seed - seed default templates
router.post('/seed', authenticate, async (req: Request, res: Response) => {
  const existing = await templateStore.readAll();
  if (existing.length > 0) {
    res.status(400).json({ error: 'Templates already exist' });
    return;
  }

  const now = new Date().toISOString();
  const userId = req.user!.id;

  const defaults: Omit<LabelTemplate, 'id' | 'templateGroupId' | 'createdBy' | 'createdAt'>[] = [
    {
      version: 1, isCurrent: true, name: 'Square 1x1 inch', description: 'Default 1x1 inch square label',
      widthMm: 25.4, heightMm: 25.4, dpi: 203, marginMm: 1,
      elements: [
        { id: uuidv4(), type: 'datamatrix', x_mm: 1, y_mm: 1, moduleSize: 3, rotation: 0, locked: false },
        { id: uuidv4(), type: 'hri_text', x_mm: 1, y_mm: 14, fontSize: 4, fontFamily: '0', lineSpacing: 0.5, rotation: 0, locked: false },
      ],
    },
    {
      version: 1, isCurrent: true, name: 'Standard 2x1 inch', description: 'Standard medical device label',
      widthMm: 50.8, heightMm: 25.4, dpi: 203, marginMm: 1,
      elements: [
        { id: uuidv4(), type: 'datamatrix', x_mm: 1.5, y_mm: 2, moduleSize: 4, rotation: 0, locked: false },
        { id: uuidv4(), type: 'hri_text', x_mm: 22, y_mm: 2, fontSize: 7, fontFamily: '0', lineSpacing: 1.2, rotation: 0, locked: false },
      ],
    },
    {
      version: 1, isCurrent: true, name: 'Small 1.5x0.75 inch', description: 'Compact label',
      widthMm: 38.1, heightMm: 19.05, dpi: 203, marginMm: 1,
      elements: [
        { id: uuidv4(), type: 'datamatrix', x_mm: 1, y_mm: 1.5, moduleSize: 3, rotation: 0, locked: false },
        { id: uuidv4(), type: 'hri_text', x_mm: 15, y_mm: 1.5, fontSize: 5, fontFamily: '0', lineSpacing: 1, rotation: 0, locked: false },
      ],
    },
    {
      version: 1, isCurrent: true, name: 'Large 3x2 inch', description: 'Large label with extra text',
      widthMm: 76.2, heightMm: 50.8, dpi: 203, marginMm: 1,
      elements: [
        { id: uuidv4(), type: 'datamatrix', x_mm: 2, y_mm: 5, moduleSize: 5, rotation: 0, locked: false },
        { id: uuidv4(), type: 'hri_text', x_mm: 32, y_mm: 5, fontSize: 9, fontFamily: '0', lineSpacing: 1.5, rotation: 0, locked: false },
        { id: uuidv4(), type: 'static_text', x_mm: 2, y_mm: 42, text: 'Medical Device', fontSize: 8, fontFamily: '0', bold: true, rotation: 0, locked: false },
      ],
    },
  ];

  for (const d of defaults) {
    const template: LabelTemplate = {
      ...d,
      id: uuidv4(),
      templateGroupId: uuidv4(),
      createdBy: userId,
      createdAt: now,
    } as LabelTemplate;
    await templateStore.append(template);
  }

  res.status(201).json({ message: `Seeded ${defaults.length} default templates` });
});

export default router;

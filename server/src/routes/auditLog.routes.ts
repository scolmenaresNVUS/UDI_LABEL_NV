import { Router, Request, Response } from 'express';
import { auditLogStore } from '../stores';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// GET /api/audit-log
router.get('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const all = await auditLogStore.readAll();

  // Apply filters
  let filtered = all;

  const { actionType, entityType, userId, from, to, search } = req.query;

  if (actionType) {
    filtered = filtered.filter(e => e.actionType === actionType);
  }
  if (entityType) {
    filtered = filtered.filter(e => e.entityType === entityType);
  }
  if (userId) {
    filtered = filtered.filter(e => e.userId === userId);
  }
  if (from) {
    const fromDate = new Date(from as string);
    filtered = filtered.filter(e => new Date(e.timestamp) >= fromDate);
  }
  if (to) {
    const toDate = new Date(to as string);
    filtered = filtered.filter(e => new Date(e.timestamp) <= toDate);
  }
  if (search) {
    const s = (search as string).toLowerCase();
    filtered = filtered.filter(e =>
      e.username.toLowerCase().includes(s) ||
      e.actionType.toLowerCase().includes(s) ||
      e.entityType.toLowerCase().includes(s) ||
      JSON.stringify(e.details).toLowerCase().includes(s)
    );
  }

  // Sort descending by timestamp
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(filtered);
});

// GET /api/audit-log/export/csv
router.get('/export/csv', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  const all = await auditLogStore.readAll();
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const headers = ['ID', 'Timestamp', 'User ID', 'Username', 'Action', 'Entity Type', 'Entity ID', 'Details', 'IP Address'];
  const rows = all.map(e => [
    e.id,
    e.timestamp,
    e.userId,
    e.username,
    e.actionType,
    e.entityType,
    e.entityId,
    JSON.stringify(e.details).replace(/"/g, '""'),
    e.ipAddress,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

export default router;

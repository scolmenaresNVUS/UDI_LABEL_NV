import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { userStore } from '../stores';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { logAction } from '../services/audit.service';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30m';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator']),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'operator']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const users = await userStore.readAll();
    const user = users.find(u => u.username === username);

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: 1800 } // 30 minutes in seconds
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000,
    });

    await logAction(user.id, user.username, 'user.login', 'user', user.id, {}, req.ip || '');

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  if (req.user) {
    await logAction(req.user.id, req.user.username, 'user.logout', 'user', req.user.id, {}, req.ip || '');
  }
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await userStore.findById(req.user.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  });
});

// GET /api/auth/users - admin only
router.get('/users', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  const users = await userStore.readAll();
  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  })));
});

// POST /api/auth/users - admin only
router.post('/users', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const users = await userStore.readAll();

    if (users.length >= 6) {
      res.status(400).json({ error: 'Maximum 6 users reached' });
      return;
    }

    if (users.find(u => u.username === data.username)) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }

    if (users.find(u => u.email === data.email)) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const newUser = {
      id: uuidv4(),
      username: data.username,
      email: data.email,
      passwordHash,
      role: data.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await userStore.append(newUser);
    await logAction(
      req.user!.id, req.user!.username,
      'user.create', 'user', newUser.id,
      { newUsername: data.username, role: data.role },
      req.ip || ''
    );

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/auth/users/:id - admin only
router.patch('/users/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const data = updateUserSchema.parse(req.body);
    const user = await userStore.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (data.email !== undefined) updates.email = data.email;
    if (data.role !== undefined) updates.role = data.role;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.password) updates.passwordHash = await bcrypt.hash(data.password, 12);

    const updated = await userStore.updateById(userId, updates as Partial<typeof user>);

    await logAction(
      req.user!.id, req.user!.username,
      'user.update', 'user', userId,
      { changes: Object.keys(data) },
      req.ip || ''
    );

    if (updated) {
      res.json({
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

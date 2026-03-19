import fs from 'fs/promises';
import path from 'path';
import lockfile from 'proper-lockfile';
import { AuditLogEntry } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');

export class AuditLogStore {
  private filePath: string;

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
  }

  async init(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]', 'utf-8');
    }
  }

  async readAll(): Promise<AuditLogEntry[]> {
    const release = await lockfile.lock(this.filePath, { retries: { retries: 5, minTimeout: 50 } });
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as AuditLogEntry[];
    } finally {
      await release();
    }
  }

  async append(entry: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry> {
    const release = await lockfile.lock(this.filePath, { retries: { retries: 5, minTimeout: 50 } });
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const all = JSON.parse(raw) as AuditLogEntry[];
      const maxId = all.length > 0 ? Math.max(...all.map(e => e.id)) : 0;
      const newEntry: AuditLogEntry = { ...entry, id: maxId + 1 };
      all.push(newEntry);
      await fs.writeFile(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
      return newEntry;
    } finally {
      await release();
    }
  }
}

import fs from 'fs/promises';
import path from 'path';
import lockfile from 'proper-lockfile';

const DATA_DIR = path.join(process.cwd(), 'data');

export class JsonStore<T extends { id: string | number }> {
  protected filePath: string;

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

  async readAll(): Promise<T[]> {
    const release = await lockfile.lock(this.filePath, { retries: { retries: 5, minTimeout: 50 } });
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as T[];
    } finally {
      await release();
    }
  }

  async write(data: T[]): Promise<void> {
    const release = await lockfile.lock(this.filePath, { retries: { retries: 5, minTimeout: 50 } });
    try {
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } finally {
      await release();
    }
  }

  async append(item: T): Promise<void> {
    const all = await this.readAll();
    all.push(item);
    await this.write(all);
  }

  async findById(id: string | number): Promise<T | undefined> {
    const all = await this.readAll();
    return all.find(item => item.id === id);
  }

  async updateById(id: string | number, partial: Partial<T>): Promise<T | null> {
    const all = await this.readAll();
    const index = all.findIndex(item => item.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...partial, id } as T;
    await this.write(all);
    return all[index];
  }

  async deleteById(id: string | number): Promise<boolean> {
    const all = await this.readAll();
    const filtered = all.filter(item => item.id !== id);
    if (filtered.length === all.length) return false;
    await this.write(filtered);
    return true;
  }
}

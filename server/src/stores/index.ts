import { JsonStore } from '../services/jsonStore';
import { AuditLogStore } from '../services/auditLogStore';
import { User, Product, LabelTemplate, Printer, PrintJob, SerialCounter } from '../types';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const userStore = new JsonStore<User>('users.json');
export const productStore = new JsonStore<Product>('products.json');
export const templateStore = new JsonStore<LabelTemplate>('templates.json');
export const printerStore = new JsonStore<Printer>('printers.json');
export const printJobStore = new JsonStore<PrintJob>('print-jobs.json');
export const serialCounterStore = new JsonStore<SerialCounter>('serial-counters.json');
export const auditLogStore = new AuditLogStore('audit-log.json');

async function seedDefaultAdmin(): Promise<void> {
  const users = await userStore.readAll();
  if (users.length === 0) {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
    const now = new Date().toISOString();
    await userStore.append({
      id: uuidv4(),
      username: 'admin',
      email: 'admin@system.local',
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log('Default admin user seeded (admin / ChangeMe123!)');
  }
}

export async function initializeStores(): Promise<void> {
  await userStore.init();
  await productStore.init();
  await templateStore.init();
  await printerStore.init();
  await printJobStore.init();
  await serialCounterStore.init();
  await auditLogStore.init();
  await seedDefaultAdmin();
}

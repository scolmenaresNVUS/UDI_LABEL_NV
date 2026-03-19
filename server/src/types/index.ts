export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'operator';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  partNumber: string;
  gtin: string;
  description: string;
  identifierMode: 'lot' | 'serial';
  lotPrefix: string | null;
  serialPrefix: string | null;
  serialStart: number | null;
  shelfLifeYears: number;
  shelfLifeMonths: number;
  shelfLifeDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabelTemplate {
  id: string;
  templateGroupId: string;
  version: number;
  isCurrent: boolean;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  dpi: number;
  elements: TemplateElement[];
  createdBy: string;
  createdAt: string;
}

export interface TemplateElement {
  id: string;
  type: 'datamatrix' | 'hri_text' | 'static_text' | 'line' | 'rectangle';
  x_mm: number;
  y_mm: number;
  rotation: number;
  locked: boolean;
  [key: string]: unknown;
}

export interface Printer {
  id: string;
  name: string;
  connectionType: 'zebra_browser_print' | 'network_tcp';
  ipAddress: string | null;
  port: number;
  printerModel: string;
  dpi: number;
  driver: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrintJob {
  id: string;
  userId: string;
  templateId: string;
  printerId: string;
  productId: string;
  identifierMode: 'lot' | 'serial';
  gtin: string;
  lotNumber: string | null;
  serialPatternJson: string | null;
  manufacturingDate: string;
  expirationDate: string | null;
  totalLabels: number;
  copiesPerLabel: number;
  status: 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled' | 'paused';
  labelsPrinted: number;
  errorMessage: string | null;
  zplData: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  userId: string;
  username: string;
  actionType: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string;
}

export interface SerialCounter {
  id: string;
  prefix: string;
  year: number;
  lastUsed: number;
  updatedAt: string;
}

export interface JwtPayload {
  id: string;
  username: string;
  role: 'admin' | 'operator';
}

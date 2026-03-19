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

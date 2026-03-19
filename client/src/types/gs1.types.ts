export interface GS1LabelData {
  gtin: string;
  identifierMode: 'lot' | 'serial';
  lotNumber?: string;
  serialNumber?: string;
  manufacturingDate: Date;
  expirationDate?: Date;
}

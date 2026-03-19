export type MeasurementUnit = 'mm' | 'in';
export type ElementType = 'datamatrix' | 'hri_text' | 'static_text' | 'line' | 'rectangle';

export interface BaseElement {
  id: string;
  type: ElementType;
  x_mm: number;
  y_mm: number;
  rotation: 0 | 90 | 180 | 270;
  locked: boolean;
}

export interface DataMatrixElementData extends BaseElement {
  type: 'datamatrix';
  moduleSize: number;
}

export interface HriTextElementData extends BaseElement {
  type: 'hri_text';
  fontSize: number;
  fontFamily: string;
  lineSpacing: number;
}

export interface StaticTextElementData extends BaseElement {
  type: 'static_text';
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
}

export interface LineElementData extends BaseElement {
  type: 'line';
  endX_mm: number;
  endY_mm: number;
  thickness: number;
}

export interface RectangleElementData extends BaseElement {
  type: 'rectangle';
  width_mm: number;
  height_mm: number;
  borderThickness: number;
  filled: boolean;
}

export type LabelElement =
  | DataMatrixElementData
  | HriTextElementData
  | StaticTextElementData
  | LineElementData
  | RectangleElementData;

export interface LabelTemplate {
  id: string;
  templateGroupId: string;
  version: number;
  isCurrent: boolean;
  name: string;
  description?: string;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  dpi: number;
  elements: LabelElement[];
  createdBy: string;
  createdAt: string;
}

export const LABEL_PRESETS = [
  { name: '2" x 1" (standard)',     widthMm: 50.8,  heightMm: 25.4  },
  { name: '1.5" x 0.75" (small)',   widthMm: 38.1,  heightMm: 19.05 },
  { name: '3" x 2" (large)',        widthMm: 76.2,  heightMm: 50.8  },
  { name: '1" x 1" (square small)', widthMm: 25.4,  heightMm: 25.4  },
  { name: '2" x 2" (square)',       widthMm: 50.8,  heightMm: 50.8  },
  { name: '4" x 2" (wide)',         widthMm: 101.6, heightMm: 50.8  },
  { name: '4" x 3" (extra large)',  widthMm: 101.6, heightMm: 76.2  },
  { name: 'Custom',                 widthMm: 0,     heightMm: 0     },
] as const;

export function mmToInches(mm: number): number {
  return Math.round((mm / 25.4) * 1000) / 1000;
}

export function inchesToMm(inches: number): number {
  return Math.round(inches * 25.4 * 100) / 100;
}

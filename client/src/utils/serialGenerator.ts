export interface SerialPattern {
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  step: number;
  padWidth: number;
}

export function generateSerials(pattern: SerialPattern): string[] {
  const serials: string[] = [];
  for (let i = pattern.start; i <= pattern.end; i += pattern.step) {
    const num = String(i).padStart(pattern.padWidth, '0');
    serials.push(`${pattern.prefix}${num}${pattern.suffix}`);
  }
  return serials;
}

export function countSerials(pattern: SerialPattern): number {
  if (pattern.step <= 0) return 0;
  return Math.floor((pattern.end - pattern.start) / pattern.step) + 1;
}

export function suggestPadWidth(end: number): number {
  return String(end).length;
}

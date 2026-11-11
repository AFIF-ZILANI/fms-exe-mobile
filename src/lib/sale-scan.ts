import type { ScanSale } from '@/lib/types';

/** Packs scanned out of a QR sale against what it needs, across all its lines. */
export function saleProgress(s: ScanSale): { scanned: number; needed: number; done: boolean } {
  const scanned = s.lines.reduce((sum, l) => sum + Math.min(l.scanned, l.quantity), 0);
  const needed = s.lines.reduce((sum, l) => sum + l.quantity, 0);
  return { scanned, needed, done: scanned >= needed };
}

/** How many QR sales still have packs to scan -- the count on the Stock tab's shortcut. */
export function waitingCount(list: ScanSale[]): number {
  return list.filter((s) => !saleProgress(s).done).length;
}

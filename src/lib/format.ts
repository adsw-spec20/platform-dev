/** Display formatting. All inputs are INTEGER AGOROT. */
export function formatPrice(agorot: number): string {
  return `₪${(agorot / 100).toFixed(2)}`;
}

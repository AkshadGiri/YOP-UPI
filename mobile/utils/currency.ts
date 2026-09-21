/**
 * Formats a decimal amount (as returned by the API — a string, to avoid
 * float precision issues over JSON) as an Indian-grouped rupee amount,
 * e.g. "20000" -> "₹20,000", "150000" -> "₹1,50,000".
 */
export function formatINR(amount: string | number): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(value)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

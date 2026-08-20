export function sanitizeExcelCell(value: unknown): unknown {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

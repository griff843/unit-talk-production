export type Primitive = string | number | boolean | null | undefined | Date;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function toCamel(str: string): string {
  return str.replace(/[_-](\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function toSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
    .replace(/^_+/, '');
}

export function toCamelKeys<T = any>(input: unknown): T {
  if (Array.isArray(input)) return input.map((v) => toCamelKeys(v)) as any;
  if (input instanceof Date) return input as any;
  if (!input || typeof input !== 'object' || !isPlainObject(input)) return input as any;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = toCamel(k);
    out[key] = toCamelKeys(v as any);
  }
  return out as T;
}

export function toSnakeKeys<T = any>(input: unknown): T {
  if (Array.isArray(input)) return input.map((v) => toSnakeKeys(v)) as any;
  if (input instanceof Date) return input as any;
  if (!input || typeof input !== 'object' || !isPlainObject(input)) return input as any;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = toSnake(k);
    out[key] = toSnakeKeys(v as any);
  }
  return out as T;
}


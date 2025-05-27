import { RawProp, RawPropSchema } from './ingestion.types';

export function validateRawProp(prop: unknown): prop is RawProp {
  try {
    RawPropSchema.parse(prop);
    return true;
  } catch {
    return false;
  }
}

import { fetchRawProps } from '../fetchRawProps';
import { RawPropSchema } from '../ingestion.types';

describe('fetchRawProps', () => {
  it('should return valid RawProps', async () => {
    const props = await fetchRawProps();
    expect(Array.isArray(props)).toBe(true);
    props.forEach((prop) => {
      expect(() => RawPropSchema.parse(prop)).not.toThrow();
    });
  });
});

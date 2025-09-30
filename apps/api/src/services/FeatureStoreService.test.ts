import { FeatureStoreService } from './FeatureStoreService';

describe('FeatureStoreService', () => {
  it('should import without duplicate identifier errors', () => {
    expect(FeatureStoreService).toBeDefined();
    const service = new FeatureStoreService();
    expect(service).toBeInstanceOf(FeatureStoreService);
  });

  it('should have required methods', () => {
    const service = new FeatureStoreService();
    expect(typeof service.upsertFeature).toBe('function');
    expect(typeof service.queryFeatures).toBe('function');
  });
});
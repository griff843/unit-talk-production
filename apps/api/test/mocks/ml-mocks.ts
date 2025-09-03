import { FeatureSet, PredictionResult } from '../../src/types/ml';

export const mockFeatureSet: FeatureSet = {
  id: 'test-feature-1',
  features: {
    numericFeature1: 0.5,
    numericFeature2: 1.0,
    categoricalFeature1: 'A',
    categoricalFeature2: 'B'
  },
  metadata: {
    timestamp: new Date().toISOString(),
    source: 'test'
  }
};

export const mockPredictionResult: PredictionResult = {
  id: 'test-prediction-1',
  featureSetId: 'test-feature-1',
  prediction: 0.75,
  confidence: 0.85,
  metadata: {
    modelVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    cached: false
  }
}; 
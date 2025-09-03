import { Position, RiskMetrics } from '../../src/types/risk';

export const mockPosition: Position = {
  id: 'test-position-1',
  type: 'LONG',
  size: 1000,
  entryPrice: 100,
  currentPrice: 105,
  metadata: {
    asset: 'BTC',
    timestamp: new Date().toISOString()
  }
};

export const mockRiskMetrics: RiskMetrics = {
  id: 'test-risk-1',
  positionId: 'test-position-1',
  var95: 50,
  var99: 75,
  sharpeRatio: 1.5,
  maxDrawdown: 0.1,
  metadata: {
    calculationDate: new Date().toISOString(),
    modelVersion: '1.0.0'
  }
}; 
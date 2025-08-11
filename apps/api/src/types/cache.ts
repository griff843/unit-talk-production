export interface CacheEntry {
  value: any;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  ttl: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  metricsInterval: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
}

export interface CacheStrategy {
  type: 'LRU' | 'LFU' | 'TTL' | 'HYBRID';
  maxSize: number;
  ttl: number;
  evictionPolicy: 'LRU' | 'LFU' | 'RANDOM';
}

export interface CachePerformance {
  hitRate: number;
  avgLatency: number;
  memoryUsage: number;
  throughput: number;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
  avgLatency: number;
}

export interface CacheKey {
  prefix: string;
  components: Record<string, any>;
  timestamp?: number;
}

export interface CacheInvalidationRule {
  pattern: string;
  ttl: number;
  conditions: Record<string, any>;
} 
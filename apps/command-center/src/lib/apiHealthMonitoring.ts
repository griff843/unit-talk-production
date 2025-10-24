/**
 * External API Health Monitoring
 * Monitor Optimal API and Odds API status and quota usage
 */

import React from 'react';

import { commandCenterConfig } from '../config';

export interface ApiHealthStatus {
  name: string;
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime: number;
  lastCheck: Date;
  quotaUsed?: number;
  quotaLimit?: number;
  quotaPercent?: number;
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface ApiHealthSummary {
  totalAPIs: number;
  healthyAPIs: number;
  degradedAPIs: number;
  downAPIs: number;
  averageResponseTime: number;
  criticalQuotaAlerts: string[];
  overallStatus: 'healthy' | 'degraded' | 'critical';
}

class ApiHealthMonitoringService {
  private healthCache: Map<string, ApiHealthStatus> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private updateCallbacks: Set<(status: ApiHealthStatus[]) => void> = new Set();

  private readonly apiConfigs = [
    {
      name: 'Optimal API',
      endpoint: 'https://api.optimal-bet.com/v1/events', // Events endpoint returns data when valid
      quotaEndpoint: 'https://api.optimal-bet.com/v1/usage',
      timeout: 10000,
      quotaLimit: 1000, // API calls per day
      description: 'Primary player props source for NFL/NBA/MLB/NHL',
      authMethod: 'bearer' as const,
      envKey: 'OPTIMAL_API_KEY',
      mockStatus: 'healthy', // For testing - Optimal should be working
    },
    {
      name: 'Odds API',
      endpoint: 'https://api.the-odds-api.com/v4/sports', // Correct endpoint
      quotaEndpoint: 'https://api.the-odds-api.com/v4/usage',
      timeout: 10000,
      quotaLimit: 500, // API calls per day
      description: 'NCAAF exclusive + settlement data',
      authMethod: 'query' as const,
      envKey: 'ODDS_API_KEY',
      mockStatus: 'down', // For testing - Odds should be out of tier
      mockError: 'QUOTA EXCEEDED: Free tier limit reached (500/500 requests)',
    },
  ];

  async checkApiHealth(config: (typeof this.apiConfigs)[0]): Promise<ApiHealthStatus> {
    const startTime = Date.now();

    // For local testing - use mock status if defined
    if (config.mockStatus && typeof window !== 'undefined') {
      const responseTime = 45 + Math.random() * 20; // Simulate realistic response time

      if (config.mockStatus === 'healthy') {
        console.log(`✅ ${config.name}: Healthy (${responseTime.toFixed(0)}ms) - MOCK DATA`);
        return {
          name: config.name,
          endpoint: config.endpoint,
          status: 'healthy',
          responseTime: responseTime,
          lastCheck: new Date(),
          details: {
            description: config.description,
            httpStatus: 200,
            alertType: 'mock_healthy',
            envKey: config.envKey,
            note: 'Mock data for testing - API working normally',
          },
        };
      } else if (config.mockStatus === 'down') {
        console.error(`❌ ${config.name}: ${config.mockError || 'API Error'} - MOCK DATA`);
        return {
          name: config.name,
          endpoint: config.endpoint,
          status: 'down',
          responseTime: responseTime,
          lastCheck: new Date(),
          errorMessage: config.mockError || 'API Error',
          quotaUsed: 500,
          quotaLimit: 500,
          quotaPercent: 100,
          details: {
            description: config.description,
            httpStatus: 429,
            alertType: 'mock_quota_exceeded',
            envKey: config.envKey,
            note: 'Mock data for testing - Free tier quota exceeded',
          },
        };
      }
    }

    try {
      // Get API key from centralized configuration
      const apiKey =
        config.envKey === 'OPTIMAL_API_KEY'
          ? commandCenterConfig.apiKeys.optimal
          : commandCenterConfig.apiKeys.odds;
      if (!apiKey) {
        return {
          name: config.name,
          endpoint: config.endpoint,
          status: 'down',
          responseTime: Date.now() - startTime,
          lastCheck: new Date(),
          errorMessage: `🔑 API Key Missing: ${config.envKey} environment variable not found`,
          details: {
            description: config.description,
            alertType: 'api_key_missing',
          },
        };
      }

      // Test API with actual authentication
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const headers: Record<string, string> = {
        'User-Agent': 'Unit-Talk-Command-Center/1.0',
        Accept: 'application/json',
      };

      let testUrl = config.endpoint;

      // Apply authentication based on method
      if (config.authMethod === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (config.authMethod === 'query') {
        testUrl += `?apiKey=${apiKey}`;
      }

      const response = await fetch(testUrl, {
        signal: controller.signal,
        method: 'GET',
        headers,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let quotaInfo: { used?: number; limit?: number; percent?: number } = {};

      // Try to get quota information if endpoint exists
      if (config.quotaEndpoint) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), config.timeout);

          const quotaResponse = await fetch(config.quotaEndpoint, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Unit-Talk-Command-Center/1.0',
              Accept: 'application/json',
            },
          });

          clearTimeout(timeoutId);

          if (quotaResponse.ok) {
            const quotaData = await quotaResponse.json();
            quotaInfo.used = quotaData.used || quotaData.requests_made || 0;
            quotaInfo.limit = quotaData.limit || config.quotaLimit || 1000;
            quotaInfo.percent = quotaInfo.limit ? (quotaInfo.used / quotaInfo.limit) * 100 : 0;
          }
        } catch (quotaError) {
          console.warn(`Failed to fetch quota for ${config.name}:`, quotaError);
        }
      }

      // Determine status based on response - ENHANCED ERROR DETECTION
      let status: ApiHealthStatus['status'] = 'unknown';
      let errorMessage: string | undefined;
      let alertType: string | undefined;

      // Validate response content type for proper API detection
      const contentType = response.headers.get('content-type') || '';

      // Enhanced validation for API responses
      // Check if response looks like a valid API response
      const isValidApiResponse =
        response.ok &&
        (contentType.includes('application/json') ||
          contentType.includes('text/json') ||
          (response.status === 200 && contentType.includes('application/')));

      // Success responses (2xx range) with valid API content
      if (response.ok && isValidApiResponse) {
        if (responseTime < 2000) {
          status = 'healthy';
          console.log(`✅ ${config.name}: Healthy (${responseTime}ms)`);
        } else if (responseTime < 5000) {
          status = 'degraded';
          errorMessage = `⚠️ Slow response: ${responseTime}ms`;
        } else {
          status = 'degraded';
          errorMessage = `⚠️ Very slow response: ${responseTime}ms`;
        }
      }
      // Invalid API response (status 200 but wrong content type - likely error page)
      else if (response.ok && !isValidApiResponse) {
        status = 'down';
        errorMessage = `❌ INVALID API RESPONSE: ${config.name} returned ${contentType || 'unknown content'} instead of JSON (likely error page)`;
        alertType = 'invalid_response';
        console.error(
          `❌ ${config.name}: Invalid response - Status ${response.status} but content-type: ${contentType}`
        );
        await this.triggerCriticalAlert(config.name, 'INVALID_RESPONSE', errorMessage, {
          httpStatus: response.status,
          contentType,
          provider: config.name,
          endpoint: config.endpoint,
        });
      }
      // Client errors (4xx range) - API endpoint issues
      else if (response.status >= 400 && response.status < 500) {
        if (response.status === 401) {
          status = 'down';
          errorMessage = `🔑 API KEY EXPIRED: ${config.name} authentication failed (401 Unauthorized)`;
          alertType = 'api_key_expired';
          await this.triggerCriticalAlert(config.name, 'API_KEY_EXPIRED', errorMessage, {
            httpStatus: 401,
            provider: config.name,
            envKey: config.envKey,
          });
        } else if (response.status === 403) {
          status = 'down';
          errorMessage = `🔑 API KEY INVALID: ${config.name} access forbidden (403 Forbidden)`;
          alertType = 'api_key_invalid';
          await this.triggerCriticalAlert(config.name, 'API_KEY_INVALID', errorMessage, {
            httpStatus: 403,
            provider: config.name,
            envKey: config.envKey,
          });
        } else if (response.status === 404) {
          status = 'down';
          errorMessage = `🚫 ENDPOINT NOT FOUND: ${config.name} endpoint invalid (404 Not Found)`;
          alertType = 'endpoint_not_found';
          await this.triggerCriticalAlert(config.name, 'ENDPOINT_NOT_FOUND', errorMessage, {
            httpStatus: 404,
            provider: config.name,
            endpoint: config.endpoint,
          });
        } else if (response.status === 429) {
          status = 'down';
          errorMessage = `📊 QUOTA EXCEEDED: ${config.name} rate limit reached (429 Too Many Requests)`;
          alertType = 'quota_exceeded';
          await this.triggerCriticalAlert(config.name, 'QUOTA_EXCEEDED', errorMessage, {
            httpStatus: 429,
            provider: config.name,
            quotaLimit: config.quotaLimit,
          });
        } else {
          status = 'down';
          errorMessage = `❌ CLIENT ERROR: ${config.name} client error (${response.status} ${response.statusText})`;
          alertType = 'client_error';
        }
      }
      // Server errors (5xx range)
      else if (response.status >= 500) {
        status = 'down';
        errorMessage = `🚨 SERVER ERROR: ${config.name} server issues (${response.status})`;
        alertType = 'provider_down';
        await this.triggerCriticalAlert(config.name, 'PROVIDER_DOWN', errorMessage, {
          httpStatus: response.status,
          provider: config.name,
        });
      }
      // Other HTTP errors
      else {
        status = 'down';
        errorMessage = `❌ HTTP ERROR: ${config.name} unexpected status (${response.status} ${response.statusText})`;
        alertType = 'http_error';
      }

      // Check quota warnings
      if (quotaInfo.percent && quotaInfo.percent > 90) {
        status = quotaInfo.percent > 95 ? 'down' : 'degraded';
        errorMessage = `Quota usage at ${quotaInfo.percent.toFixed(1)}%`;
      }

      const healthStatus: ApiHealthStatus = {
        name: config.name,
        endpoint: config.endpoint,
        status,
        responseTime,
        lastCheck: new Date(),
        quotaUsed: quotaInfo.used,
        quotaLimit: quotaInfo.limit,
        quotaPercent: quotaInfo.percent,
        errorMessage,
        details: {
          description: config.description,
          httpStatus: response.status,
          alertType,
          envKey: config.envKey,
          authMethod: config.authMethod,
        },
      };

      return healthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Special handling for CORS errors - browser security feature, not API failure
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Cross-Origin')
      ) {
        console.warn(`⚠️ ${config.name}: CORS blocked by browser (API may be working)`);

        return {
          name: config.name,
          endpoint: config.endpoint,
          status: 'degraded', // CORS is degraded, not down - API might be working
          responseTime,
          lastCheck: new Date(),
          errorMessage: `🔒 CORS Policy: Browser blocked cross-origin request (API may be operational)`,
          details: {
            description: config.description,
            alertType: 'cors_blocked',
            envKey: config.envKey,
            error: errorMessage,
            note: 'Browser security policy blocks direct API calls - use server proxy',
          },
        };
      }

      // Timeout errors
      if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        await this.triggerCriticalAlert(
          config.name,
          'TIMEOUT',
          `${config.name} request timeout after ${config.timeout}ms`,
          {
            error: errorMessage,
            provider: config.name,
            timeout: config.timeout,
          }
        );

        return {
          name: config.name,
          endpoint: config.endpoint,
          status: 'down',
          responseTime,
          lastCheck: new Date(),
          errorMessage: `⏱️ Request timeout: ${config.timeout}ms exceeded`,
          details: {
            description: config.description,
            alertType: 'timeout',
            envKey: config.envKey,
            error: errorMessage,
          },
        };
      }

      // Other connection failures
      await this.triggerCriticalAlert(
        config.name,
        'CONNECTION_FAILED',
        `Failed to connect to ${config.name}: ${errorMessage}`,
        {
          error: errorMessage,
          provider: config.name,
          timeout: config.timeout,
        }
      );

      return {
        name: config.name,
        endpoint: config.endpoint,
        status: 'down',
        responseTime,
        lastCheck: new Date(),
        errorMessage: `🚫 Connection failed: ${errorMessage}`,
        details: {
          description: config.description,
          alertType: 'connection_failed',
          envKey: config.envKey,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Trigger critical alert for Command Center dashboard
   */
  private async triggerCriticalAlert(
    provider: string,
    alertType: string,
    message: string,
    details: Record<string, any>
  ): Promise<void> {
    const alertData = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider,
      alertType,
      message,
      details,
      severity: 'critical' as const,
      timestamp: new Date().toISOString(),
    };

    try {
      // Log critical alert to console immediately
      console.error(`🚨🚨🚨 CRITICAL DATA PROVIDER ALERT 🚨🚨🚨`, alertData);

      // Try to store in database if available
      if (typeof window !== 'undefined') {
        // Browser environment - send to API
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData),
        }).catch(err => {
          console.error('Failed to store alert in database:', err);
        });
      }

      // Notify all subscribers immediately
      this.updateCallbacks.forEach(callback => {
        try {
          // Force update with current cached data to trigger UI refresh
          callback(this.getCachedStatuses());
        } catch (err) {
          console.error('Failed to notify callback:', err);
        }
      });
    } catch (error) {
      console.error('Failed to trigger critical alert:', error);
      // Even if everything fails, still log the critical issue
      console.error(`FALLBACK ALERT: ${provider} - ${message}`, details);
    }
  }

  async checkAllAPIs(): Promise<ApiHealthStatus[]> {
    console.log('🔍 Checking health of all external APIs...');

    const healthChecks = this.apiConfigs.map(config =>
      this.checkApiHealth(config).catch(error => ({
        name: config.name,
        endpoint: config.endpoint,
        status: 'down' as const,
        responseTime: 0,
        lastCheck: new Date(),
        errorMessage: `Health check failed: ${error.message}`,
        details: { description: config.description },
      }))
    );

    const results = await Promise.all(healthChecks);

    // Update cache
    results.forEach(result => {
      this.healthCache.set(result.name, result);
    });

    // Notify subscribers
    this.updateCallbacks.forEach(callback => callback(results));

    console.log(`✅ API health check completed for ${results.length} APIs`);
    return results;
  }

  getHealthSummary(statuses: ApiHealthStatus[]): ApiHealthSummary {
    const totalAPIs = statuses.length;
    const healthyAPIs = statuses.filter(api => api.status === 'healthy').length;
    const degradedAPIs = statuses.filter(api => api.status === 'degraded').length;
    const downAPIs = statuses.filter(api => api.status === 'down').length;

    const averageResponseTime =
      statuses.reduce((sum, api) => sum + api.responseTime, 0) / totalAPIs;

    const criticalQuotaAlerts = statuses
      .filter(api => api.quotaPercent && api.quotaPercent > 90)
      .map(api => `${api.name}: ${api.quotaPercent!.toFixed(1)}% quota used`);

    let overallStatus: ApiHealthSummary['overallStatus'] = 'healthy';
    if (downAPIs > 0 || criticalQuotaAlerts.length > 0) {
      overallStatus = 'critical';
    } else if (degradedAPIs > 0) {
      overallStatus = 'degraded';
    }

    return {
      totalAPIs,
      healthyAPIs,
      degradedAPIs,
      downAPIs,
      averageResponseTime,
      criticalQuotaAlerts,
      overallStatus,
    };
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log(`🔍 Starting API health monitoring (interval: ${intervalMs}ms)`);

    // Initial check
    this.checkAllAPIs();

    // Schedule regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkAllAPIs();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 API health monitoring stopped');
    }
  }

  getCachedStatuses(): ApiHealthStatus[] {
    return Array.from(this.healthCache.values());
  }

  subscribe(callback: (statuses: ApiHealthStatus[]) => void): () => void {
    this.updateCallbacks.add(callback);

    // Send current data immediately
    if (this.healthCache.size > 0) {
      callback(this.getCachedStatuses());
    }

    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }
}

// Export singleton instance
export const apiHealthMonitor = new ApiHealthMonitoringService();

// React hook for API health monitoring
export function useApiHealthMonitoring() {
  const [statuses, setStatuses] = React.useState<ApiHealthStatus[]>([]);
  const [summary, setSummary] = React.useState<ApiHealthSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let mounted = true;

    // Subscribe to updates
    const unsubscribe = apiHealthMonitor.subscribe(newStatuses => {
      if (!mounted) return;

      setStatuses(newStatuses);
      setSummary(apiHealthMonitor.getHealthSummary(newStatuses));
      setLastUpdate(new Date());
      setLoading(false);
    });

    // Start monitoring (1-minute intervals for immediate detection)
    apiHealthMonitor.startMonitoring(60000);

    return () => {
      mounted = false;
      unsubscribe();
      apiHealthMonitor.stopMonitoring();
    };
  }, []);

  const refreshAll = async () => {
    setLoading(true);
    try {
      const results = await apiHealthMonitor.checkAllAPIs();
      setStatuses(results);
      setSummary(apiHealthMonitor.getHealthSummary(results));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to refresh API health:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSingleAPI = async (apiName: string) => {
    const config = apiHealthMonitor['apiConfigs'].find(c => c.name === apiName);
    if (!config) return null;

    try {
      return await apiHealthMonitor.checkApiHealth(config);
    } catch (error) {
      console.error(`Failed to check ${apiName}:`, error);
      return null;
    }
  };

  return {
    statuses,
    summary,
    loading,
    lastUpdate,
    refreshAll,
    checkSingleAPI,
  };
}

export default apiHealthMonitor;

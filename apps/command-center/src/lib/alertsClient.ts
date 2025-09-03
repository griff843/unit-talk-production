// Note: Removed fs and path imports for client compatibility
import { z } from 'zod';

// Alert policy schema
export const AlertPolicySchema = z.object({
  id: z.string(),
  key: z.string(),
  enabled: z.boolean(),
  threshold: z.number().optional(),
  channels: z.array(z.object({
    type: z.enum(['discord', 'email', 'slack']),
    target: z.string(),
    config: z.record(z.any()).optional()
  })),
  tenant_id: z.string().default('default'),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export type AlertPolicy = z.infer<typeof AlertPolicySchema>;

interface AlertsClientOptions {
  tenantId?: string;
  opsKey?: string;
  apiUrl?: string;
}

/**
 * Client for interacting with alerts API or local stub
 */
export class AlertsClient {
  private tenantId: string;
  private opsKey: string | undefined;
  private apiUrl: string;

  constructor(options: AlertsClientOptions = {}) {
    this.tenantId = options.tenantId || 'default';
    this.opsKey = options.opsKey;
    this.apiUrl = options.apiUrl || 'http://localhost:3001';
  }

  /**
   * List all alert policies
   */
  async list(): Promise<AlertPolicy[]> {
    try {
      // Try API first
      if (this.opsKey) {
        const response = await fetch(
          `${this.apiUrl}/api/ops/alerts?tenant_id=${this.tenantId}`,
          {
            headers: {
              'x-ops-key': this.opsKey,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          return data.map((item: any) => AlertPolicySchema.parse(item));
        }
        
        if (response.status !== 404) {
          console.error(`[AlertsClient] API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('[AlertsClient] API request failed:', error);
    }

    // Fallback to mock data
    console.warn('[AlertsClient] Using mock data for alerts');
    return this.getMockPolicies();
  }

  /**
   * Create a new alert policy
   */
  async create(policy: Omit<AlertPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<AlertPolicy> {
    const newPolicy: AlertPolicy = {
      ...policy,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: this.tenantId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // Try API first
      if (this.opsKey) {
        const response = await fetch(
          `${this.apiUrl}/api/ops/alerts`,
          {
            method: 'POST',
            headers: {
              'x-ops-key': this.opsKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newPolicy)
          }
        );

        if (response.ok) {
          const data = await response.json();
          return AlertPolicySchema.parse(data);
        }
        
        if (response.status !== 404) {
          console.error(`[AlertsClient] API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('[AlertsClient] API request failed:', error);
    }

    // Fallback to mock data (client-side does not support persistence)
    console.warn('[AlertsClient] Using mock data for alerts - changes will not persist');
    return newPolicy;
  }

  /**
   * Update an existing alert policy
   */
  async update(id: string, updates: Partial<Omit<AlertPolicy, 'id' | 'tenant_id'>>): Promise<AlertPolicy> {
    try {
      // Try API first
      if (this.opsKey) {
        const response = await fetch(
          `${this.apiUrl}/api/ops/alerts/${id}`,
          {
            method: 'PATCH',
            headers: {
              'x-ops-key': this.opsKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...updates,
              updated_at: new Date().toISOString()
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          return AlertPolicySchema.parse(data);
        }
        
        if (response.status !== 404) {
          console.error(`[AlertsClient] API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('[AlertsClient] API request failed:', error);
    }

    // Fallback to mock data (client-side does not support persistence)
    console.warn('[AlertsClient] Using mock data for alerts - changes will not persist');
    const mockPolicies = await this.getMockPolicies();
    const policy = mockPolicies.find(p => p.id === id);
    
    if (!policy) {
      throw new Error(`Alert policy ${id} not found`);
    }

    return {
      ...policy,
      ...updates,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Delete an alert policy
   */
  async delete(id: string): Promise<void> {
    try {
      // Try API first
      if (this.opsKey) {
        const response = await fetch(
          `${this.apiUrl}/api/ops/alerts/${id}`,
          {
            method: 'DELETE',
            headers: {
              'x-ops-key': this.opsKey,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          return;
        }
        
        if (response.status !== 404) {
          console.error(`[AlertsClient] API error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('[AlertsClient] API request failed:', error);
    }

    // Fallback to mock data (client-side does not support persistence)
    console.warn('[AlertsClient] Using mock data for alerts - changes will not persist');
    const mockPolicies = await this.getMockPolicies();
    const policy = mockPolicies.find(p => p.id === id);
    
    if (!policy) {
      throw new Error(`Alert policy ${id} not found`);
    }
    
    // In client-side mode, just confirm deletion without actual persistence
  }

  /**
   * Get mock alert policies for client-side development
   */
  private async getMockPolicies(): Promise<AlertPolicy[]> {
    return [
      {
        id: 'alert_mock_1',
        key: 'high_error_rate',
        enabled: true,
        threshold: 5,
        channels: [
          { type: 'discord', target: '#alerts', config: {} }
        ],
        tenant_id: this.tenantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'alert_mock_2',
        key: 'low_success_rate',
        enabled: false,
        threshold: 95,
        channels: [
          { type: 'discord', target: '#alerts', config: {} },
          { type: 'email', target: 'ops@unittalk.com', config: {} }
        ],
        tenant_id: this.tenantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }
}
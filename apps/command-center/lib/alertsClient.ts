import { promises as fs } from 'fs';
import path from 'path';
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
  private stubFilePath: string;

  constructor(options: AlertsClientOptions = {}) {
    this.tenantId = options.tenantId || 'default';
    this.opsKey = options.opsKey || process.env['OPS_API_KEY'];
    this.apiUrl = options.apiUrl || process.env['API_URL'] || 'http://localhost:3001';
    
    // Windows-safe path for local stub
    const repoRoot = path.resolve(process.cwd(), '../..');
    this.stubFilePath = path.join(repoRoot, 'out', 'ops', 'alert-policies.local.json');
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

    // Fallback to local stub
    console.warn('[AlertsClient] Using local stub for alerts');
    return this.readLocalStub();
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

    // Fallback to local stub
    console.warn('[AlertsClient] Using local stub for alerts');
    const policies = await this.readLocalStub();
    policies.push(newPolicy);
    await this.writeLocalStub(policies);
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

    // Fallback to local stub
    console.warn('[AlertsClient] Using local stub for alerts');
    const policies = await this.readLocalStub();
    const index = policies.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error(`Alert policy ${id} not found`);
    }

    policies[index] = {
      ...policies[index],
      ...updates,
      updated_at: new Date().toISOString()
    } as AlertPolicy;

    await this.writeLocalStub(policies);
    return policies[index] as AlertPolicy;
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

    // Fallback to local stub
    console.warn('[AlertsClient] Using local stub for alerts');
    const policies = await this.readLocalStub();
    const filtered = policies.filter(p => p.id !== id);
    
    if (filtered.length === policies.length) {
      throw new Error(`Alert policy ${id} not found`);
    }

    await this.writeLocalStub(filtered);
  }

  /**
   * Read policies from local stub file
   */
  private async readLocalStub(): Promise<AlertPolicy[]> {
    try {
      const content = await fs.readFile(this.stubFilePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Filter by tenant and validate
      return data
        .filter((p: any) => p.tenant_id === this.tenantId)
        .map((p: any) => AlertPolicySchema.parse(p));
    } catch (error) {
      // File doesn't exist or is invalid - return empty array
      return [];
    }
  }

  /**
   * Write policies to local stub file
   */
  private async writeLocalStub(policies: AlertPolicy[]): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.stubFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Read existing policies for other tenants
      let allPolicies: AlertPolicy[] = [];
      try {
        const content = await fs.readFile(this.stubFilePath, 'utf-8');
        const data = JSON.parse(content);
        allPolicies = data.filter((p: any) => p.tenant_id !== this.tenantId);
      } catch {
        // File doesn't exist yet
      }
      
      // Combine with updated policies for this tenant
      allPolicies.push(...policies);
      
      // Write back
      await fs.writeFile(
        this.stubFilePath,
        JSON.stringify(allPolicies, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[AlertsClient] Failed to write local stub:', error);
      throw error;
    }
  }
}
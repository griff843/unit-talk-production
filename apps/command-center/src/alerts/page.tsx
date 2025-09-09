import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, AlertTriangle } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { TenantBadge } from '@/components/TenantBadge';
import { AlertsClient } from '@/lib/alertsClient';
import { AlertsContent } from './AlertsContent';

export default async function AlertsPage() {
  // RBAC check
  const { tenant } = await requireAuth();
  
  // Initialize alerts client
  const client = new AlertsClient({ tenantId: (tenant as any)?.id || tenant || 'default' });
  
  // Fetch initial policies
  let policies: any[] = [];
  let isUsingStub = false;
  
  try {
    policies = await client.list();
    
    // Check if we're using the stub (if OPS_API_KEY is not set, we're definitely using stub)
    if (!process.env['OPS_API_KEY']) {
      isUsingStub = true;
    }
  } catch (error) {
    console.error('[AlertsPage] Failed to fetch policies:', error);
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Policies</h1>
          <p className="text-muted-foreground mt-2">
            Configure alert thresholds and notification channels
          </p>
        </div>
        <TenantBadge tenant={tenant} />
      </div>

      {/* Stub Warning */}
      {isUsingStub && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base text-amber-900">Using Local Stub</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              Alert policies are currently stored locally in <code className="px-1 py-0.5 bg-amber-100 rounded">out/ops/alert-policies.local.json</code>
            </p>
            <p className="text-xs text-amber-600 mt-2">
              Configure OPS_API_KEY environment variable to connect to the production alerts API
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Active Policies</CardTitle>
          </div>
          <CardDescription>
            Manage alert policies for system monitoring and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertsContent
            initialPolicies={policies}
            tenantId={(tenant as any)?.id || tenant || 'default'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
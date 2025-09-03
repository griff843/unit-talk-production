'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AlertsTable } from '@/components/AlertsTable';
import { AlertEditor } from '@/components/AlertEditor';
import { AlertsClient, type AlertPolicy } from '@/lib/alertsClient';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface AlertsContentProps {
  initialPolicies: AlertPolicy[];
  tenantId: string;
}

export function AlertsContent({ initialPolicies, tenantId }: AlertsContentProps) {
  const router = useRouter();
  const [policies, setPolicies] = useState<AlertPolicy[]>(initialPolicies);
  const [editingPolicy, setEditingPolicy] = useState<AlertPolicy | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const client = new AlertsClient({ tenantId });

  const handleCreate = () => {
    setEditingPolicy(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (policy: AlertPolicy) => {
    setEditingPolicy(policy);
    setIsEditorOpen(true);
  };

  const handleSave = async (policyData: Omit<AlertPolicy, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingPolicy) {
        // Update existing
        const updated = await client.update(editingPolicy.id, policyData);
        setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        // Create new
        const created = await client.create(policyData);
        setPolicies(prev => [...prev, created]);
      }
      
      setIsEditorOpen(false);
      router.refresh();
    } catch (error) {
      throw error; // Let AlertEditor handle the error
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert policy?')) {
      return;
    }

    try {
      await client.delete(id);
      setPolicies(prev => prev.filter(p => p.id !== id));
      
      toast({
        title: 'Alert Deleted',
        description: 'The alert policy has been removed',
      });
      
      router.refresh();
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete alert policy',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const updated = await client.update(id, { enabled });
      setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p));
      
      toast({
        title: enabled ? 'Alert Enabled' : 'Alert Disabled',
        description: `Alert policy has been ${enabled ? 'enabled' : 'disabled'}`,
      });
      
      router.refresh();
    } catch (error) {
      toast({
        title: 'Toggle Failed',
        description: error instanceof Error ? error.message : 'Failed to toggle alert policy',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Policy
        </Button>
      </div>

      {/* Alerts Table */}
      <AlertsTable
        policies={policies}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
      />

      {/* Alert Editor Modal */}
      <AlertEditor
        policy={editingPolicy}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
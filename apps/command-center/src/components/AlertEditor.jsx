// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertCircle } from 'lucide-react';
import { z } from 'zod';
// import type { AlertPolicy } from '@/lib/alertsClient';
import { toast } from '@/components/ui/use-toast';

// interface AlertEditorProps {
//   policy: AlertPolicy | null;
//   isOpen: boolean;
//   onClose: () => void;
//   onSave: (policy: Omit<AlertPolicy, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
// }

const defaultChannels = [
  {
    type: 'discord',
    target: '#alerts',
    config: {}
  }
];

export function AlertEditor({ policy, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    key: '',
    enabled: true,
    threshold: '',
    channels: JSON.stringify(defaultChannels, null, 2)
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (policy) {
      setFormData({
        key: policy.key,
        enabled: policy.enabled,
        threshold: policy.threshold?.toString() || '',
        channels: JSON.stringify(policy.channels, null, 2)
      });
    } else {
      setFormData({
        key: '',
        enabled: true,
        threshold: '',
        channels: JSON.stringify(defaultChannels, null, 2)
      });
    }
    setErrors({});
  }, [policy, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    // Validate key
    if (!formData.key.trim()) {
      newErrors.key = 'Key is required';
    } else if (!/^[a-z0-9_-]+$/i.test(formData.key)) {
      newErrors.key = 'Key must contain only letters, numbers, hyphens, and underscores';
    }

    // Validate threshold if provided
    if (formData.threshold && isNaN(Number(formData.threshold))) {
      newErrors.threshold = 'Threshold must be a number';
    }

    // Validate channels JSON
    try {
      const channels = JSON.parse(formData.channels);
      if (!Array.isArray(channels)) {
        newErrors.channels = 'Channels must be an array';
      } else {
        // Validate each channel
        for (const channel of channels) {
          if (!channel.type || !['discord', 'email', 'slack'].includes(channel.type)) {
            newErrors.channels = 'Invalid channel type. Must be discord, email, or slack';
            break;
          }
          if (!channel.target) {
            newErrors.channels = 'Each channel must have a target';
            break;
          }
        }
      }
    } catch (e) {
      newErrors.channels = 'Invalid JSON format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const channels = JSON.parse(formData.channels);
      
      await onSave({
        key: formData.key,
        enabled: formData.enabled,
        threshold: formData.threshold ? Number(formData.threshold) : undefined,
        channels,
        tenant_id: 'default' // Will be overridden by server
      });

      toast({
        title: policy ? 'Alert Updated' : 'Alert Created',
        description: `Alert policy "${formData.key}" has been ${policy ? 'updated' : 'created'} successfully`,
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save alert policy',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader key="header">
          <DialogTitle>{policy ? 'Edit Alert Policy' : 'Create Alert Policy'}</DialogTitle>
          <DialogDescription>
            Configure alert policy settings and notification channels
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Key */}
          <div className="space-y-2">
            <Label htmlFor="key">Alert Key</Label>
            <Input
              id="key"
              placeholder="e.g., high_error_rate"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              disabled={!!policy} // Don't allow changing key when editing
            />
            {errors.key && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.key}
              </p>
            )}
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <Label htmlFor="threshold">Threshold (Optional)</Label>
            <Input
              id="threshold"
              type="number"
              placeholder="e.g., 100"
              value={formData.threshold}
              onChange={(e) => setFormData(prev => ({ ...prev, threshold: e.target.value }))}
            />
            {errors.threshold && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.threshold}
              </p>
            )}
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <Label htmlFor="channels">Notification Channels (JSON)</Label>
            <Textarea
              id="channels"
              rows={8}
              className="font-mono text-sm"
              placeholder='[{"type": "discord", "target": "#alerts"}]'
              value={formData.channels}
              onChange={(e) => setFormData(prev => ({ ...prev, channels: e.target.value }))}
            />
            {errors.channels && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.channels}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Define notification channels as a JSON array. Supported types: discord, email, slack
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : policy ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
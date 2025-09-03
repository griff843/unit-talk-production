'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Settings } from 'lucide-react';
import { updateRuntimeMode } from './actions';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

interface RuntimeConfig {
  mode: 'production' | 'shadow' | 'maintenance';
  bot_publish: boolean;
  smartform_writes: boolean;
  ingestion_enabled: boolean;
  promoter_enabled: boolean;
  alerts_enabled: boolean;
}

interface RuntimeModeControlsProps {
  currentConfig: RuntimeConfig;
}

export function RuntimeModeControls({ currentConfig }: RuntimeModeControlsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [config, setConfig] = useState<RuntimeConfig>(currentConfig);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleModeChange = (newMode: string) => {
    if (newMode === 'production' && currentConfig.mode !== 'production') {
      setConfirmProduction(true);
    } else {
      setConfig(prev => ({ ...prev, mode: newMode as RuntimeConfig['mode'] }));
    }
  };

  const confirmProductionMode = () => {
    setConfig(prev => ({ ...prev, mode: 'production' }));
    setConfirmProduction(false);
  };

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const result = await updateRuntimeMode(config);
      
      if (result.success) {
        toast({
          title: 'Runtime Mode Updated',
          description: `Successfully switched to ${config.mode} mode`,
        });
        setIsOpen(false);
        router.refresh();
      } else {
        toast({
          title: 'Update Failed',
          description: result.error || 'Failed to update runtime mode',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Update Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="w-full"
      >
        <Settings className="h-4 w-4 mr-2" />
        Configure Runtime Mode
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Runtime Configuration</DialogTitle>
            <DialogDescription>
              Configure the runtime mode and feature flags for the platform
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="space-y-2">
              <Label htmlFor="mode">Runtime Mode</Label>
              <Select 
                value={config.mode} 
                onValueChange={handleModeChange}
              >
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shadow">Shadow (Monitoring Only)</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3">
              <Label>Feature Flags</Label>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="bot-publish" className="text-sm font-normal">
                  Discord Bot Publishing
                </Label>
                <Switch
                  id="bot-publish"
                  checked={config.bot_publish}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, bot_publish: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="smartform" className="text-sm font-normal">
                  SmartForm Writes
                </Label>
                <Switch
                  id="smartform"
                  checked={config.smartform_writes}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, smartform_writes: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="ingestion" className="text-sm font-normal">
                  Data Ingestion
                </Label>
                <Switch
                  id="ingestion"
                  checked={config.ingestion_enabled}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, ingestion_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="promoter" className="text-sm font-normal">
                  Promoter System
                </Label>
                <Switch
                  id="promoter"
                  checked={config.promoter_enabled}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, promoter_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="alerts" className="text-sm font-normal">
                  Alert System
                </Label>
                <Switch
                  id="alerts"
                  checked={config.alerts_enabled}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, alerts_enabled: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Mode Confirmation */}
      <Dialog open={confirmProduction} onOpenChange={setConfirmProduction}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <DialogTitle>Confirm Production Mode</DialogTitle>
            </div>
            <DialogDescription>
              Switching to production mode will enable all live systems including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Discord bot publishing to channels</li>
                <li>SmartForm database writes</li>
                <li>Live data ingestion</li>
                <li>Promoter campaigns</li>
                <li>Alert notifications</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmProduction(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmProductionMode}
            >
              Switch to Production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
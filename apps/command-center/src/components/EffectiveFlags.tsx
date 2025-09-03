'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface Flag {
  key: string;
  label: string;
  value: boolean;
  effective: boolean;
  reason?: string;
}

interface EffectiveFlagsProps {
  mode: 'production' | 'shadow' | 'maintenance';
  botPublish: boolean;
  smartformWrites: boolean;
  ingestionEnabled: boolean;
  promoterEnabled: boolean;
  alertsEnabled: boolean;
}

export function EffectiveFlags({
  mode,
  botPublish,
  smartformWrites,
  ingestionEnabled,
  promoterEnabled,
  alertsEnabled
}: EffectiveFlagsProps) {
  // Compute effective flags based on mode and toggles
  const flags: Flag[] = [
    {
      key: 'discord',
      label: 'Discord',
      value: botPublish,
      effective: mode === 'production' && botPublish,
      reason: mode !== 'production' ? 'OFF (non-prod)' : botPublish ? 'ON' : 'OFF (disabled)'
    },
    {
      key: 'smartform',
      label: 'SmartForm Writes',
      value: smartformWrites,
      effective: mode === 'production' && smartformWrites,
      reason: mode !== 'production' ? 'OFF (non-prod)' : smartformWrites ? 'ON' : 'OFF (disabled)'
    },
    {
      key: 'ingestion',
      label: 'Ingestion',
      value: ingestionEnabled,
      effective: mode !== 'maintenance' && ingestionEnabled,
      reason: mode === 'maintenance' ? 'OFF (maintenance)' : ingestionEnabled ? 'ON' : 'OFF (disabled)'
    },
    {
      key: 'promoter',
      label: 'Promoter',
      value: promoterEnabled,
      effective: mode === 'production' && promoterEnabled,
      reason: mode !== 'production' ? 'OFF (non-prod)' : promoterEnabled ? 'ON' : 'OFF (disabled)'
    },
    {
      key: 'alerts',
      label: 'Alerts',
      value: alertsEnabled,
      effective: mode === 'production' && alertsEnabled,
      reason: mode !== 'production' ? 'OFF (non-prod)' : alertsEnabled ? 'ON' : 'OFF (disabled)'
    }
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {flags.map((flag) => (
          <Tooltip key={flag.key}>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1">
                <Badge 
                  variant={flag.effective ? 'default' : 'secondary'}
                  className={flag.effective 
                    ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200'
                  }
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                    flag.effective ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`} />
                  {flag.label}: {flag.effective ? 'ON' : 'OFF'}
                </Badge>
                {flag.reason && flag.reason !== (flag.effective ? 'ON' : 'OFF') && (
                  <Info className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </TooltipTrigger>
            {flag.reason && (
              <TooltipContent>
                <p className="text-xs">{flag.reason}</p>
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
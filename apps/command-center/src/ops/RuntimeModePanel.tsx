'use server';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Zap } from 'lucide-react';
import { EffectiveFlags } from '@/components/EffectiveFlags';
import { RuntimeModeControls } from './RuntimeModeControls';
import { getRuntimeMode } from './actions';

export async function RuntimeModePanel() {
  const config = await getRuntimeMode();
  
  if (!config) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-900">Runtime Mode Error</CardTitle>
          <CardDescription className="text-red-700">
            Could not fetch runtime configuration. Check API connection.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const modeConfig = {
    production: {
      icon: <Zap className="h-5 w-5" />,
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      description: 'Full production mode - all systems active'
    },
    shadow: {
      icon: <Shield className="h-5 w-5" />,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: 'Shadow mode - monitoring only, no writes'
    },
    maintenance: {
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      description: 'Maintenance mode - limited functionality'
    }
  };

  const currentMode = modeConfig[config.mode];

  return (
    <Card className={`${currentMode.bgColor} ${currentMode.borderColor}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={currentMode.color}>
              {currentMode.icon}
            </div>
            <div>
              <CardTitle>Runtime Mode</CardTitle>
              <CardDescription className="mt-1">
                {currentMode.description}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`text-lg px-3 py-1 ${currentMode.color} ${currentMode.borderColor}`}
          >
            {config.mode.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Effective Flags Display */}
        <div>
          <h3 className="text-sm font-medium mb-2">Effective Flags</h3>
          <EffectiveFlags
            mode={config.mode}
            botPublish={config.bot_publish}
            smartformWrites={config.smartform_writes}
            ingestionEnabled={config.ingestion_enabled}
            promoterEnabled={config.promoter_enabled}
            alertsEnabled={config.alerts_enabled}
          />
        </div>

        {/* Runtime Controls */}
        <div className="pt-4 border-t">
          <RuntimeModeControls currentConfig={config} />
        </div>
      </CardContent>
    </Card>
  );
}
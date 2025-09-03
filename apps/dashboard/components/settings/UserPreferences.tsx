'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Eye,
  Bell,
  Download,
  Palette,
  RefreshCw,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  autoRefresh: boolean;
  refreshInterval: number;
  notifications: {
    picks: boolean;
    insights: boolean;
    system: boolean;
    sound: boolean;
  };
  display: {
    compactMode: boolean;
    showPredictions: boolean;
    showConfidence: boolean;
    animationsEnabled: boolean;
  };
  export: {
    includeMetadata: boolean;
    format: 'csv' | 'pdf' | 'json';
  };
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  autoRefresh: true,
  refreshInterval: 300,
  notifications: {
    picks: true,
    insights: true,
    system: true,
    sound: true,
  },
  display: {
    compactMode: false,
    showPredictions: true,
    showConfidence: true,
    animationsEnabled: true,
  },
  export: {
    includeMetadata: true,
    format: 'csv',
  },
};

export function UserPreferences() {
  const { theme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unitTalk_preferences');
      return saved ? JSON.parse(saved) : defaultPreferences;
    }
    return defaultPreferences;
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    localStorage.setItem('unitTalk_preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (path: string[], value: any) => {
    setPreferences(prev => {
      const newPrefs = { ...prev };
      let current = newPrefs;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newPrefs;
    });
    setIsDirty(true);
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    setIsDirty(true);
  };

  const savePreferences = () => {
    localStorage.setItem('unitTalk_preferences', JSON.stringify(preferences));
    setIsDirty(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="interactive-hover">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-morphism border-purple-500/20 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>User Preferences</DialogTitle>
          <DialogDescription>Customize your Unit Talk dashboard experience.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="appearance" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance" className="flex items-center space-x-2">
              <Palette className="h-4 w-4" />
              <span>Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="display" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Display</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Theme</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="w-24"
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="w-24"
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="w-24"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto Refresh</Label>
                <div className="flex items-center space-x-4">
                  <Switch
                    checked={preferences.autoRefresh}
                    onCheckedChange={checked => updatePreferences(['autoRefresh'], checked)}
                  />
                  {preferences.autoRefresh && (
                    <Select
                      value={preferences.refreshInterval.toString()}
                      onValueChange={value =>
                        updatePreferences(['refreshInterval'], parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Interval" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                        <SelectItem value="600">10 minutes</SelectItem>
                        <SelectItem value="1800">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Pick Notifications</Label>
                <Switch
                  checked={preferences.notifications.picks}
                  onCheckedChange={checked =>
                    updatePreferences(['notifications', 'picks'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>AI Insights</Label>
                <Switch
                  checked={preferences.notifications.insights}
                  onCheckedChange={checked =>
                    updatePreferences(['notifications', 'insights'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>System Updates</Label>
                <Switch
                  checked={preferences.notifications.system}
                  onCheckedChange={checked =>
                    updatePreferences(['notifications', 'system'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Sound Effects</Label>
                <Switch
                  checked={preferences.notifications.sound}
                  onCheckedChange={checked =>
                    updatePreferences(['notifications', 'sound'], checked)
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="display" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Compact Mode</Label>
                <Switch
                  checked={preferences.display.compactMode}
                  onCheckedChange={checked =>
                    updatePreferences(['display', 'compactMode'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Predictions</Label>
                <Switch
                  checked={preferences.display.showPredictions}
                  onCheckedChange={checked =>
                    updatePreferences(['display', 'showPredictions'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Confidence</Label>
                <Switch
                  checked={preferences.display.showConfidence}
                  onCheckedChange={checked =>
                    updatePreferences(['display', 'showConfidence'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Animations</Label>
                <Switch
                  checked={preferences.display.animationsEnabled}
                  onCheckedChange={checked =>
                    updatePreferences(['display', 'animationsEnabled'], checked)
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Include Metadata</Label>
                <Switch
                  checked={preferences.export.includeMetadata}
                  onCheckedChange={checked =>
                    updatePreferences(['export', 'includeMetadata'], checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Export Format</Label>
                <Select
                  value={preferences.export.format}
                  onValueChange={(value: 'csv' | 'pdf' | 'json') =>
                    updatePreferences(['export', 'format'], value)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={resetPreferences}
            className="text-white border-white/20 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            onClick={savePreferences}
            disabled={!isDirty}
            className={!isDirty ? 'opacity-50 cursor-not-allowed' : ''}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

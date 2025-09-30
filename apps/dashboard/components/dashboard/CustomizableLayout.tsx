'use client';

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Settings, Save, RotateCcw, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

// Lazy load heavy components for better performance
const RealTimeAnalytics = lazy(() =>
  import('./RealTimeAnalytics').then(m => ({ default: m.RealTimeAnalytics }))
);
const NotificationCenter = lazy(() =>
  import('@/components/notifications/NotificationCenter').then(m => ({
    default: m.NotificationCenter,
  }))
);
const UserPreferences = lazy(() =>
  import('@/components/settings/UserPreferences').then(m => ({ default: m.UserPreferences }))
);
const MobileNav = lazy(() =>
  import('@/components/mobile/MobileNav').then(m => ({ default: m.MobileNav }))
);

// Loading component for lazy-loaded components
const ComponentLoader = ({ name }: { name: string }) => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mr-2"></div>
    <span className="text-gray-400 text-sm">Loading {name}...</span>
  </div>
);

interface WidgetConfig {
  id: string;
  title: string;
  enabled: boolean;
  size: 'small' | 'medium' | 'large';
  defaultOrder: number;
}

const defaultWidgets: WidgetConfig[] = [
  {
    id: 'performance',
    title: 'Performance Metrics',
    enabled: true,
    size: 'medium',
    defaultOrder: 0,
  },
  { id: 'picks', title: 'Recent Picks', enabled: true, size: 'medium', defaultOrder: 1 },
  { id: 'roi', title: 'ROI Analysis', enabled: true, size: 'small', defaultOrder: 2 },
  { id: 'trends', title: 'Market Trends', enabled: true, size: 'large', defaultOrder: 3 },
  { id: 'ai-insights', title: 'AI Insights', enabled: true, size: 'medium', defaultOrder: 4 },
  { id: 'leaderboard', title: 'Top Cappers', enabled: true, size: 'small', defaultOrder: 5 },
];

export function CustomizableLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unitTalk_widgetConfig');
      return saved ? JSON.parse(saved) : defaultWidgets;
    }
    return defaultWidgets;
  });

  const [_isCustomizing, setIsCustomizing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    localStorage.setItem('unitTalk_widgetConfig', JSON.stringify(widgets));
  }, [widgets]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgets(items);
  };

  const toggleWidget = (id: string) => {
    setWidgets(prev =>
      prev.map(widget => (widget.id === id ? { ...widget, enabled: !widget.enabled } : widget))
    );
  };

  const resetToDefault = () => {
    setWidgets(defaultWidgets);
  };

  return (
    <div className="space-y-4" data-testid="dashboard-container">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="hidden md:block">
            <Suspense fallback={<ComponentLoader name="Notifications" />}>
              <NotificationCenter />
            </Suspense>
          </div>
          <Suspense fallback={<ComponentLoader name="Preferences" />}>
            <UserPreferences />
          </Suspense>
          {/* TODO: Fix Dialog type issue */}
          <Button variant="outline" className="interactive-hover hidden md:flex" onClick={() => console.log('Customize Dashboard')}>
            <Settings className="h-4 w-4 mr-2" />
            Customize Dashboard
          </Button>
          {false && (
            <div className="glass-morphism border-purple-500/20">
              <div>
                <h2>Dashboard Customization</h2>
                <p>
                  Enable/disable widgets and drag to reorder them.
                </p>
              </div>
              <div className="space-y-4">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="widgets">
                    {provided => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {widgets.map((widget, index) => (
                          <Draggable key={widget.id} draggableId={widget.id} index={index}>
                            {provided => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 interactive-hover"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 flex items-center justify-center text-gray-400">
                                    ⋮⋮
                                  </div>
                                  <span className="text-white">{widget.title}</span>
                                </div>
                                <Switch
                                  checked={widget.enabled}
                                  onCheckedChange={() => toggleWidget(widget.id)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={resetToDefault}
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                  <Button onClick={() => setIsCustomizing(false)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Layout
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <Suspense fallback={<ComponentLoader name="Mobile Navigation" />}>
          <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        </Suspense>
      </div>

      {/* Main Content */}
      <div className="w-full">
        <Suspense fallback={<ComponentLoader name="Analytics Dashboard" />}>
          <RealTimeAnalytics />
        </Suspense>
      </div>

      {/* Quick Actions for Mobile */}
      <div className="fixed bottom-24 left-4 md:hidden">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-12 w-12 bg-purple-500 border-purple-400 shadow-lg"
          onClick={() => window.location.reload()}
          data-testid="refresh-dashboard"
        >
          <RefreshCw className="h-6 w-6" />
        </Button>
      </div>

      {/* Notification Center for Mobile */}
      <div className="fixed bottom-24 left-20 md:hidden">
        <Suspense fallback={<ComponentLoader name="Mobile Notifications" />}>
          <NotificationCenter />
        </Suspense>
      </div>
    </div>
  );
}

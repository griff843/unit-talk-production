'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Target,
  Wallet,
  Brain,
  Flame,
  Trophy,
  Activity,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const tabs = [
    { id: 'overview', icon: BarChart3, label: 'Overview' },
    { id: 'performance', icon: TrendingUp, label: 'Performance' },
    { id: 'picks', icon: Target, label: 'Picks' },
    { id: 'portfolio', icon: Wallet, label: 'Portfolio' },
    { id: 'ai', icon: Brain, label: 'AI Insights' },
    { id: 'market', icon: Flame, label: 'Market' },
    { id: 'cappers', icon: Trophy, label: 'Cappers' },
    { id: 'system', icon: Activity, label: 'System' },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-gray-800 lg:hidden"
      >
        <div className="grid grid-cols-4 gap-1 p-2">
          {tabs.slice(0, 4).map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                className={`flex flex-col items-center justify-center py-2 px-1 space-y-1 ${
                  activeTab === tab.id ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400'
                }`}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </motion.nav>

      {/* More Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-20 right-4 rounded-full h-12 w-12 bg-purple-500 border-purple-400 shadow-lg lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="glass-morphism border-purple-500/20">
          <SheetHeader>
            <SheetTitle>More Options</SheetTitle>
            <SheetDescription>Access additional dashboard features</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {tabs.slice(4).map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant="outline"
                  className={`flex items-center space-x-2 ${
                    activeTab === tab.id ? 'text-purple-500 bg-purple-500/10' : 'text-gray-400'
                  }`}
                  onClick={() => {
                    onTabChange(tab.id);
                    // Close sheet after selection
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Spacing for Mobile */}
      <div className="h-20 lg:hidden" />
    </>
  );
}

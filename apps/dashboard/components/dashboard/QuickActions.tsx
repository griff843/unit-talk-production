'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Target, Brain, Flame, Settings, HelpCircle, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  username: string;
  tier: 'MEMBER' | 'VIP' | 'VIP_PLUS' | 'BLACK_LABEL' | 'CAPPER' | 'ADMIN';
  avatar: string;
  joinDate: string;
  lastActive: string;
}

interface QuickActionsProps {
  user: User;
}

export function QuickActions({ user }: QuickActionsProps) {
  return (
    // Temporarily simplified quick actions for build fix
    <div>
      <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3">
        <Plus className="h-5 w-5 text-gray-300" />
      </button>
      {/* DropdownMenu temporarily disabled for build fix */}
      {/* <DropdownMenuContent
        align="end"
        className="w-56 bg-black/90 backdrop-blur-sm border-gray-800"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-white">Quick Actions</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />

        <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">
          <Target className="h-4 w-4 mr-2" />
          Submit Pick
        </DropdownMenuItem>

        {user.tier !== 'MEMBER' && (
          <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">
            <Brain className="h-4 w-4 mr-2" />
            Ask AI Coach
          </DropdownMenuItem>
        )}

        {(user.tier === 'VIP_PLUS' || user.tier === 'BLACK_LABEL') && (
          <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">
            <Flame className="h-4 w-4 mr-2" />
            View Heat Signals
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-gray-800" />

        <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help & Support
        </DropdownMenuItem>

        <DropdownMenuItem className="text-gray-300 hover:bg-gray-800">
          <ExternalLink className="h-4 w-4 mr-2" />
          Discord Server
        </DropdownMenuItem>
      </DropdownMenuContent> */}
    {/* </DropdownMenu> */}
    </div>
  );
}

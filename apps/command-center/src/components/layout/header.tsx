'use client';

import { Bell, Search, Settings, User, LogOut, Bot, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ConnectionIndicator } from '@/components/ui/sync-status';
// import { ThemeToggle } from '@/components/ui/theme-toggle'

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={`flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 ${className}`}
    >
      {/* Search */}
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search picks, agents, users..."
            className="pl-10 w-full bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Connection Status */}
        <ConnectionIndicator />

        {/* Theme Toggle - DISABLED due to hydration issues */}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel>Notifications (3)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-96 overflow-y-auto">
              <DropdownMenuItem className="flex-col items-start space-y-1 h-auto py-3">
                <div className="font-medium">Agent GradingAgent needs attention</div>
                <div className="text-sm text-muted-foreground">
                  Performance degraded - response time &gt;5s
                </div>
                <div className="text-xs text-muted-foreground">2 minutes ago</div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex-col items-start space-y-1 h-auto py-3">
                <div className="font-medium">5 picks pending approval</div>
                <div className="text-sm text-muted-foreground">NBA picks require manual review</div>
                <div className="text-xs text-muted-foreground">15 minutes ago</div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex-col items-start space-y-1 h-auto py-3">
                <div className="font-medium">Database connection restored</div>
                <div className="text-sm text-muted-foreground">
                  Connection to Unit Talk Production is stable
                </div>
                <div className="text-xs text-muted-foreground">1 hour ago</div>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Settings className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>System Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => (window.location.href = '/dashboard/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>General Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (window.location.href = '/dashboard/agents')}>
              <Bot className="mr-2 h-4 w-4" />
              <span>Agent Configuration</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (window.location.href = '/dashboard/users')}>
              <Users className="mr-2 h-4 w-4" />
              <span>User Management</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => (window.location.href = '/dashboard/analytics')}>
              <Activity className="mr-2 h-4 w-4" />
              <span>Analytics Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/avatars/admin.svg" alt="Admin" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Admin User</p>
                <p className="text-xs leading-none text-muted-foreground">admin@unittalk.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

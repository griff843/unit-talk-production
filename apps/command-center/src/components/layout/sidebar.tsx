'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bot,
  FileCheck,
  Users,
  Zap,
  Target,
  Settings,
  Activity,
  TrendingUp,
  Shield,
  ChevronLeft,
  ChevronRight,
  Command,
  Brain,
  Timer,
  FileText,
  Database,
  Wifi,
  Layers,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  className?: string;
}

const navigation = [
  {
    name: 'Global Health & Control',
    href: '/dashboard/health',
    icon: Heart,
    description: 'Unified health monitoring for all platform components',
  },
  {
    name: 'Overview',
    href: '/dashboard',
    icon: BarChart3,
    description: 'System overview and key metrics',
  },
  {
    name: 'PicksHQ',
    href: '/dashboard/picks',
    icon: Target,
    description: 'Advanced pick filtering and analytics',
  },
  {
    name: 'Agent Control',
    href: '/dashboard/agents',
    icon: Bot,
    description: 'Real-time agent monitoring and controls',
  },
  {
    name: 'Grading HQ',
    href: '/dashboard/grading',
    icon: Timer,
    description: 'Real-time grading queue and combo builder',
  },
  {
    name: 'Data Flow Monitor',
    href: '/dashboard/data-flow',
    icon: Database,
    description: 'Live tracking of props, grading, and agent activity',
  },
  {
    name: 'API Health',
    href: '/dashboard/api-health',
    icon: Wifi,
    description: 'Real-time API monitoring and data provider alerts',
  },
  {
    name: 'Events Stream',
    href: '/dashboard/events',
    icon: Layers,
    description: 'Production pipeline events and real-time monitoring',
  },
  {
    name: 'SmartForm Review',
    href: '/dashboard/smartform',
    icon: FileCheck,
    description: 'Submission validation and approval',
  },
  {
    name: 'LLM Task Center',
    href: '/dashboard/tasks',
    icon: Zap,
    description: 'AI-powered task assignment',
  },
  {
    name: 'User Management',
    href: '/dashboard/users',
    icon: Users,
    description: 'User profiles and permissions',
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: TrendingUp,
    description: 'Business intelligence and insights',
  },
  {
    name: 'Phase D',
    href: '/dashboard/phase-d',
    icon: Brain,
    description: 'AI-powered predictive analytics',
  },
  {
    name: 'Security',
    href: '/dashboard/security',
    icon: Shield,
    description: 'Security monitoring and audit logs',
  },
  {
    name: 'Audit & Compliance',
    href: '/dashboard/audit',
    icon: FileText,
    description: 'Comprehensive audit trails and compliance',
  },
];

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <Command className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">Command Center</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                'hover:bg-accent/50 hover:text-accent-foreground',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', !collapsed && 'mr-3')} />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status Indicator */}
      <div className="p-4 border-t border-border">
        {!collapsed ? (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">System Healthy</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

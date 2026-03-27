'use client';

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  FileCheck,
  GitBranch,
  Users,
  Zap,
  Target,
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
  Gavel,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType, useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Navigation sections
// ---------------------------------------------------------------------------

interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { name: 'Overview', href: '/dashboard', icon: BarChart3 },
      { name: 'Command Center', href: '/dashboard/capper-command-center', icon: Command },
      { name: 'Settlement', href: '/dashboard/settlement', icon: Gavel },
      { name: 'PicksHQ', href: '/dashboard/picks', icon: Target },
      { name: 'Grading HQ', href: '/dashboard/grading', icon: Timer },
      { name: 'Replay', href: '/dashboard/replay', icon: RefreshCw },
      { name: 'Workflows', href: '/dashboard/workflows', icon: GitBranch },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { name: 'Agent Control', href: '/dashboard/agents', icon: Bot },
      { name: 'Data Flow', href: '/dashboard/data-flow', icon: Database },
      { name: 'API Health', href: '/dashboard/api-health', icon: Wifi },
      { name: 'Events Stream', href: '/dashboard/events', icon: Layers },
      { name: 'Risk Engine', href: '/dashboard/risk', icon: Shield },
      { name: 'Platform Health', href: '/dashboard/health', icon: Activity },
      { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
      { name: 'Real-time', href: '/dashboard/real-time', icon: Wifi },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { name: 'Cappers', href: '/dashboard/cappers', icon: Users },
      { name: 'SmartForm', href: '/dashboard/smartform', icon: FileCheck },
      { name: 'LLM Tasks', href: '/dashboard/tasks', icon: Zap },
      { name: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp },
      { name: 'Phase D', href: '/dashboard/phase-d', icon: Brain },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Users', href: '/dashboard/users', icon: Users },
      { name: 'Security', href: '/dashboard/security', icon: Shield },
      { name: 'Audit', href: '/dashboard/audit', icon: FileText },
    ],
  },
];

// ---------------------------------------------------------------------------
// Status hook — polls /api/pipeline/health every 30s
// ---------------------------------------------------------------------------

type SystemStatus = 'healthy' | 'degraded' | 'down';

function useSystemStatus(): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>('healthy');

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/health');
      if (!res.ok) {
        setStatus('down');
        return;
      }
      const data = await res.json();
      setStatus(data.status === 'healthy' ? 'healthy' : 'degraded');
    } catch {
      setStatus('down');
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  return status;
}

const STATUS_META: Record<SystemStatus, { color: string; label: string }> = {
  healthy: { color: 'bg-emerald-500', label: 'System Healthy' },
  degraded: { color: 'bg-yellow-500', label: 'Degraded' },
  down: { color: 'bg-red-500', label: 'Disconnected' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SidebarProps {
  className?: string;
}

function SidebarHeader({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="flex items-center gap-2">
      <Command className="h-6 w-6 text-primary" />
      <span className="font-semibold text-foreground">Command Center</span>
    </div>
  );
}

function NavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent/50 hover:text-accent-foreground',
        isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.name : undefined}
    >
      <item.icon className={cn('h-4 w-4 flex-shrink-0', !collapsed && 'mr-2.5')} />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );
}

function StatusFooter({ collapsed, status }: { collapsed: boolean; status: SystemStatus }) {
  const { color, label } = STATUS_META[status];
  return (
    <div className="p-4 border-t border-border">
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-2')}>
        <div className={cn('h-2 w-2 rounded-full animate-pulse', color)} />
        {!collapsed && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const status = useSystemStatus();

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300',
        collapsed ? 'w-16' : 'w-56',
        className
      )}
    >
      <div className="flex h-14 items-center justify-between px-3 border-b border-border">
        <SidebarHeader collapsed={collapsed} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(c => !c)}
          className="h-7 w-7 p-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  isActive={
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <StatusFooter collapsed={collapsed} status={status} />
    </div>
  );
}

'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

// GAUNTLET-CLOSEOUT-028: Fix Radix UI type inference issue
// Cast to any to work around strict type inference
const TabsRoot = TabsPrimitive.Root as any;
const TabsListPrimitive = TabsPrimitive.List as any;
const TabsTriggerPrimitive = TabsPrimitive.Trigger as any;
const TabsContentPrimitive = TabsPrimitive.Content as any;

interface TabsProps {
  children?: React.ReactNode;
  className?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, children, ...props }, ref) => (
    <TabsRoot ref={ref} className={className} {...props}>
      {children}
    </TabsRoot>
  )
);
Tabs.displayName = 'Tabs';

interface TabsListProps {
  children?: React.ReactNode;
  className?: string;
}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => (
    <TabsListPrimitive
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500',
        className
      )}
      {...props}
    >
      {children}
    </TabsListPrimitive>
  )
);
TabsList.displayName = 'TabsList';

interface TabsTriggerProps {
  children?: React.ReactNode;
  className?: string;
  value: string;
  disabled?: boolean;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <TabsTriggerPrimitive
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </TabsTriggerPrimitive>
  )
);
TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps {
  children?: React.ReactNode;
  className?: string;
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, children, ...props }, ref) => (
    <TabsContentPrimitive
      ref={ref}
      className={cn(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
        className
      )}
      {...props}
    >
      {children}
    </TabsContentPrimitive>
  )
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };

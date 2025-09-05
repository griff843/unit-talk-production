"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

// Type-safe wrappers with internal primitive type escape to support className/children reliably
const TabsRootPrimitive = TabsPrimitive.Root as unknown as React.ComponentType<any>;
const TabsListPrimitive = TabsPrimitive.List as unknown as React.ComponentType<any>;
const TabsTriggerPrimitive = TabsPrimitive.Trigger as unknown as React.ComponentType<any>;
const TabsContentPrimitive = TabsPrimitive.Content as unknown as React.ComponentType<any>;

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  Omit<React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, 'className'> & { className?: string; children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div className={className}>
    <TabsRootPrimitive ref={ref} {...props}>
      {children}
    </TabsRootPrimitive>
  </div>
))
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { className?: string; children?: React.ReactNode }
>(({ className, ...props }, ref) => (
  <TabsListPrimitive
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  >
    {props.children}
  </TabsListPrimitive>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { className?: string; children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <TabsTriggerPrimitive
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  >
    {children}
  </TabsTriggerPrimitive>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & { className?: string; children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <TabsContentPrimitive
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  >
    {children}
  </TabsContentPrimitive>
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
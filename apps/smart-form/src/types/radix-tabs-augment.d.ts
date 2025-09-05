import * as React from 'react';

declare module '@radix-ui/react-tabs' {
  interface TabsProps { className?: string; children?: React.ReactNode }
  interface TabsListProps { className?: string; children?: React.ReactNode }
  interface TabsTriggerProps { className?: string; children?: React.ReactNode }
  interface TabsContentProps { className?: string; children?: React.ReactNode }
}


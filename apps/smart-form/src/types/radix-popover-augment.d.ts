import * as React from 'react';

declare module '@radix-ui/react-popover' {
  interface PopoverTriggerProps { asChild?: boolean; children?: React.ReactNode }
  interface PopoverContentProps { className?: string; children?: React.ReactNode }
}


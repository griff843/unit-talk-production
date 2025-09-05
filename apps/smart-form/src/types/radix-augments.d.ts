import * as React from 'react';

declare module '@radix-ui/react-tabs' {
  interface TabsListProps { className?: string; children?: React.ReactNode }
  interface TabsTriggerProps { className?: string; children?: React.ReactNode }
  interface TabsContentProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-select' {
  interface SelectTriggerProps { className?: string; children?: React.ReactNode }
  interface SelectContentProps { className?: string; children?: React.ReactNode; position?: 'popper' | 'item-aligned' }
  interface SelectViewportProps { className?: string; children?: React.ReactNode }
  interface SelectLabelProps { className?: string }
  interface SelectItemProps { className?: string; children?: React.ReactNode }
  interface SelectSeparatorProps { className?: string }
  interface SelectIconProps { children?: React.ReactNode }
  interface SelectScrollUpButtonProps { className?: string; children?: React.ReactNode }
  interface SelectScrollDownButtonProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-toast' {
  interface ToastProps { className?: string; children?: React.ReactNode }
  interface ToastTitleProps { className?: string; children?: React.ReactNode }
  interface ToastDescriptionProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-separator' {
  interface SeparatorProps { className?: string }
}

declare module '@radix-ui/react-label' {
  interface LabelProps { className?: string; htmlFor?: string }
}


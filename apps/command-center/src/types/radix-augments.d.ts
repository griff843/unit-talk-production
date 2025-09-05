// Radix UI props augmentation to align with our wrapper usage
// This keeps shadcn-style wrappers working across our TS/Radix versions.
import * as React from 'react';

declare module '@radix-ui/react-tabs' {
  interface TabsListProps { className?: string; children?: React.ReactNode }
  interface TabsTriggerProps { className?: string; children?: React.ReactNode }
  interface TabsContentProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-dropdown-menu' {
  interface DropdownMenuTriggerProps { asChild?: boolean; children?: React.ReactNode }
  interface DropdownMenuContentProps { className?: string; children?: React.ReactNode }
  interface DropdownMenuSubTriggerProps { className?: string; children?: React.ReactNode; inset?: boolean }
  interface DropdownMenuSubContentProps { className?: string; children?: React.ReactNode }
  interface DropdownMenuItemProps { className?: string; children?: React.ReactNode; onClick?: (e: any) => void }
  interface DropdownMenuCheckboxItemProps { className?: string; children?: React.ReactNode }
  interface DropdownMenuRadioItemProps { className?: string; children?: React.ReactNode }
  interface DropdownMenuLabelProps { className?: string; children?: React.ReactNode; inset?: boolean }
  interface DropdownMenuSeparatorProps { className?: string }
  interface DropdownMenuItemIndicatorProps { children?: React.ReactNode }
}

declare module '@radix-ui/react-select' {
  interface SelectTriggerProps { className?: string; children?: React.ReactNode; id?: string }
  interface SelectContentProps { className?: string; children?: React.ReactNode; position?: 'popper' | 'item-aligned' }
  interface SelectViewportProps { className?: string; children?: React.ReactNode }
  interface SelectScrollUpButtonProps { className?: string; children?: React.ReactNode }
  interface SelectScrollDownButtonProps { className?: string; children?: React.ReactNode }
  interface SelectLabelProps { className?: string }
  interface SelectItemProps { className?: string; children?: React.ReactNode }
  interface SelectSeparatorProps { className?: string }
  interface SelectIconProps { children?: React.ReactNode }
}

declare module '@radix-ui/react-dialog' {
  interface DialogOverlayProps { className?: string }
  interface DialogContentProps { className?: string; children?: React.ReactNode }
  interface DialogTitleProps { className?: string; children?: React.ReactNode }
  interface DialogDescriptionProps { className?: string; children?: React.ReactNode }
  interface DialogCloseProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-avatar' {
  interface AvatarProps { className?: string; children?: React.ReactNode }
  interface AvatarImageProps { className?: string; src?: string; alt?: string }
  interface AvatarFallbackProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-progress' {
  interface ProgressProps { className?: string; children?: React.ReactNode }
  interface ProgressIndicatorProps { className?: string }
}

declare module '@radix-ui/react-toast' {
  interface ToastViewportProps { className?: string }
  interface ToastProps { className?: string; children?: React.ReactNode }
  interface ToastActionProps { className?: string }
  interface ToastCloseProps { className?: string; children?: React.ReactNode }
  interface ToastTitleProps { className?: string; children?: React.ReactNode }
  interface ToastDescriptionProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-separator' {
  interface SeparatorProps { className?: string }
}

declare module '@radix-ui/react-label' {
  interface LabelProps { className?: string; htmlFor?: string }
}


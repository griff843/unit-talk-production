/**
 * Temporary type overrides for Radix UI React 19 compatibility
 * TODO: Remove when upgrading to Radix UI v2
 */

declare module '@radix-ui/react-tabs' {
  interface TabsProps {
    children?: React.ReactNode;
  }
  
  interface TabsListProps {
    children?: React.ReactNode;
  }
  
  interface TabsTriggerProps {
    children?: React.ReactNode;
  }
  
  interface TabsContentProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-toast' {
  interface ToastProps {
    children?: React.ReactNode;
  }
  
  interface ToastTitleProps {
    children?: React.ReactNode;
  }
  
  interface ToastDescriptionProps {
    children?: React.ReactNode;
  }
  
  interface ToastCloseProps {
    children?: React.ReactNode;
  }
  
  interface ToastActionProps {
    children?: React.ReactNode;
  }
  
  interface ToastViewportProps {
    children?: React.ReactNode;
  }
  
  export interface Toast {
    Provider: any;
    Root: any;
    Title: any;
    Description: any;
    Close: any;
    Action: any;
    Viewport: any;
  }
}

declare module '@radix-ui/react-progress' {
  interface ProgressProps {
    className?: string;
  }
}

declare module '@radix-ui/react-select' {
  interface SelectTriggerProps {
    children?: React.ReactNode;
  }
  
  interface SelectContentProps {
    children?: React.ReactNode;
  }
  
  interface SelectItemProps {
    children?: React.ReactNode;
  }
  
  interface SelectValueProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-dialog' {
  interface DialogProps {
    children?: React.ReactNode;
  }
  
  interface DialogTriggerProps {
    children?: React.ReactNode;
  }
  
  interface DialogContentProps {
    children?: React.ReactNode;
  }
  
  interface DialogHeaderProps {
    children?: React.ReactNode;
  }
  
  interface DialogTitleProps {
    children?: React.ReactNode;
  }
  
  interface DialogDescriptionProps {
    children?: React.ReactNode;
  }
  
  export const Root: any;
  export const Trigger: any;
  export const Portal: any;
  export const Close: any;
  export const Overlay: any;
  export const Content: any;
  export const Title: any;
  export const Description: any;
}

declare module '@radix-ui/react-dropdown-menu' {
  interface DropdownMenuTriggerProps {
    children?: React.ReactNode;
  }
  
  interface DropdownMenuContentProps {
    children?: React.ReactNode;
  }
  
  interface DropdownMenuLabelProps {
    children?: React.ReactNode;
  }
  
  interface DropdownMenuItemProps {
    children?: React.ReactNode;
  }
  
  interface DropdownMenuSeparatorProps {
    children?: React.ReactNode;
  }
  
  interface DropdownMenuGroupProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-label' {
  interface LabelProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-switch' {
  interface SwitchProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-checkbox' {
  interface CheckboxProps {
    children?: React.ReactNode;
  }
  
  export interface Checkbox {
    Root: any;
    Indicator: any;
  }
}

declare module '@radix-ui/react-avatar' {
  interface AvatarProps {
    children?: React.ReactNode;
  }
  
  interface AvatarImageProps {
    children?: React.ReactNode;
  }
  
  interface AvatarFallbackProps {
    children?: React.ReactNode;
  }
  
  export interface Avatar {
    Root: any;
    Image: any;
    Fallback: any;
  }
}

declare module '@radix-ui/react-scroll-area' {
  interface ScrollAreaProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-separator' {
  interface SeparatorProps {
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-slot' {
  interface SlotProps {
    children?: React.ReactNode;
  }
  
  export const Slot: any;
}
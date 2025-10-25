/**
 * Type augmentations for Radix UI components
 *
 * Newer versions of Radix UI have incomplete type definitions that don't include
 * className and children props, even though the components accept them at runtime.
 * This file augments those types to include the missing props.
 *
 * Date: 2025-10-25
 * Pattern: Same as apps/command-center/src/types/radix-ui.d.ts
 */

import * as React from 'react';

declare module '@radix-ui/react-tabs' {
  interface TabsProps {
    className?: string;
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    defaultValue?: string;
  }

  interface TabsListProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface TabsTriggerProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface TabsContentProps {
    className?: string;
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-toast' {
  interface ToastViewportProps {
    className?: string;
  }

  interface ToastProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface ToastActionProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface ToastCloseProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface ToastTitleProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface ToastDescriptionProps {
    className?: string;
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-avatar' {
  interface AvatarProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface AvatarImageProps {
    className?: string;
    src?: string;
    alt?: string;
  }

  interface AvatarFallbackProps {
    className?: string;
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-popover' {
  interface PopoverTriggerProps {
    asChild?: boolean;
    children?: React.ReactNode;
  }

  interface PopoverContentProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface PopoverArrowProps {
    className?: string;
  }

  interface PopoverCloseProps {
    className?: string;
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-label' {
  interface LabelProps {
    className?: string;
    children?: React.ReactNode;
    htmlFor?: string;
  }
}

declare module '@radix-ui/react-separator' {
  interface SeparatorProps {
    className?: string;
    orientation?: 'horizontal' | 'vertical';
    decorative?: boolean;
  }
}

declare module '@radix-ui/react-progress' {
  interface ProgressProps {
    className?: string;
    value?: number;
    children?: React.ReactNode;
  }

  interface ProgressIndicatorProps {
    className?: string;
    style?: React.CSSProperties;
  }
}

declare module '@radix-ui/react-select' {
  interface SelectTriggerProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SelectScrollUpButtonProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SelectScrollDownButtonProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SelectContentProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SelectLabelProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SelectItemProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SelectSeparatorProps {
    className?: string;
  }

  interface SelectIconProps {
    asChild?: boolean;
    children?: React.ReactNode;
  }

  interface SelectViewportProps {
    className?: string;
    children?: React.ReactNode;
  }
}

declare module '@radix-ui/react-slot' {
  interface SlotProps {
    children?: React.ReactNode;
    className?: string;
  }
}

declare module '@radix-ui/react-switch' {
  interface SwitchProps {
    className?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }

  interface SwitchThumbProps {
    className?: string;
  }
}

declare module '@radix-ui/react-slider' {
  interface SliderProps {
    className?: string;
    value?: number[];
    onValueChange?: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    children?: React.ReactNode;
  }

  interface SliderTrackProps {
    className?: string;
    children?: React.ReactNode;
  }

  interface SliderRangeProps {
    className?: string;
  }

  interface SliderThumbProps {
    className?: string;
  }
}

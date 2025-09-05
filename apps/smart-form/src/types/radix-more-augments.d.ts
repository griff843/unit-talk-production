import * as React from 'react';

declare module '@radix-ui/react-avatar' {
  interface AvatarProps { className?: string; children?: React.ReactNode }
  interface AvatarImageProps { className?: string }
  interface AvatarFallbackProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-popover' {
  interface PopoverTriggerProps { children?: React.ReactNode }
  interface PopoverContentProps { className?: string; children?: React.ReactNode }
}

declare module '@radix-ui/react-progress' {
  interface ProgressProps { className?: string; children?: React.ReactNode }
  interface ProgressIndicatorProps { className?: string }
}

declare module '@radix-ui/react-slider' {
  interface SliderProps { className?: string; children?: React.ReactNode }
  interface SliderTrackProps { className?: string; children?: React.ReactNode }
  interface SliderRangeProps { className?: string }
  interface SliderThumbProps { className?: string }
}

declare module '@radix-ui/react-toast' {
  interface ToastViewportProps { className?: string }
  interface ToastActionProps { className?: string }
  interface ToastCloseProps { className?: string; children?: React.ReactNode }
}


'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

// GAUNTLET-CLOSEOUT-028: Fix Radix UI type inference issue
// Radix UI types are overly strict - cast to any for JSX compatibility
const AvatarRoot = AvatarPrimitive.Root as any;
const AvatarImagePrimitive = AvatarPrimitive.Image as any;
const AvatarFallbackPrimitive = AvatarPrimitive.Fallback as any;

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, children, ...props }, ref) => (
    <AvatarRoot
      ref={ref}
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    >
      {children}
    </AvatarRoot>
  )
);
Avatar.displayName = 'Avatar';

interface AvatarImageProps {
  className?: string;
  src?: string;
  alt?: string;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, ...props }, ref) => (
    <AvatarImagePrimitive
      ref={ref}
      className={cn('aspect-square h-full w-full', className)}
      {...props}
    />
  )
);
AvatarImage.displayName = 'AvatarImage';

interface AvatarFallbackProps {
  className?: string;
  children?: React.ReactNode;
  delayMs?: number;
}

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, children, ...props }, ref) => (
    <AvatarFallbackPrimitive
      ref={ref}
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted',
        className
      )}
      {...props}
    >
      {children}
    </AvatarFallbackPrimitive>
  )
);
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };

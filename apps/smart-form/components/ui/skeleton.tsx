'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  );
}

// Preset skeleton variants for common use cases
export function SkeletonInput({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-full', className)} />;
}

export function SkeletonSelect({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-full', className)} />;
}

export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-24', className)} />;
}

export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-3/4', className)} />;
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

// Form field skeleton with label
interface SkeletonFieldProps {
  label?: boolean;
  className?: string;
}

export function SkeletonField({ label = true, className }: SkeletonFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Skeleton className="h-4 w-20" />}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// Card skeleton for loading states
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('p-4 border rounded-lg space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

// Option list skeleton for dropdowns
interface SkeletonOptionsProps {
  count?: number;
  className?: string;
}

export function SkeletonOptions({ count = 3, className }: SkeletonOptionsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

// Game card skeleton
export function SkeletonGameCard({ className }: SkeletonProps) {
  return (
    <div className={cn('p-4 border rounded-lg', className)}>
      <div className="flex justify-between items-center mb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="text-center text-xs text-gray-400 my-2">vs</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  );
}

// Leg card skeleton
export function SkeletonLegCard({ className }: SkeletonProps) {
  return (
    <div className={cn('p-4 border-2 border-dashed rounded-lg', className)}>
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="space-y-4">
        <SkeletonField />
        <SkeletonField />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonField />
          <SkeletonField />
        </div>
      </div>
    </div>
  );
}

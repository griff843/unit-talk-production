'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type AssetShape = 'circle' | 'square';

interface SportsAssetProps {
  imageUrl?: string | null;
  label: string;
  type?: 'player' | 'team';
  shape?: AssetShape;
  className?: string;
  fallbackClassName?: string;
}

function getFallbackLabel(label: string) {
  const parts = label
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function SportsAsset({
  imageUrl,
  label,
  type = 'team',
  shape = 'circle',
  className,
  fallbackClassName,
}: SportsAssetProps) {
  return (
    <Avatar
      className={cn(
        'border border-border/60 bg-white',
        shape === 'square' && 'rounded-md',
        className
      )}
    >
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt={label}
          className={cn(
            type === 'team' && 'object-contain p-1',
            type === 'player' && 'object-cover'
          )}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          'text-[10px] font-semibold uppercase text-slate-600',
          shape === 'square' && 'rounded-md',
          fallbackClassName
        )}
      >
        {getFallbackLabel(label)}
      </AvatarFallback>
    </Avatar>
  );
}

interface MatchupAssetsProps {
  awayLabel: string;
  homeLabel: string;
  awayImageUrl?: string | null;
  homeImageUrl?: string | null;
  className?: string;
  assetClassName?: string;
}

export function MatchupAssets({
  awayLabel,
  homeLabel,
  awayImageUrl,
  homeImageUrl,
  className,
  assetClassName,
}: MatchupAssetsProps) {
  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      <SportsAsset
        label={awayLabel}
        imageUrl={awayImageUrl}
        type="team"
        shape="square"
        className={cn('h-8 w-8 bg-white', assetClassName)}
      />
      <SportsAsset
        label={homeLabel}
        imageUrl={homeImageUrl}
        type="team"
        shape="square"
        className={cn('h-8 w-8 bg-white', assetClassName)}
      />
    </div>
  );
}

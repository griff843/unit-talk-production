/**
 * CapperSelect Component
 *
 * Production-grade capper selection with:
 * - React Query for caching (15m cache, 5m stale)
 * - Radix UI Select for accessibility
 * - Keyboard search support
 * - Discord thread ID caching
 */

'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCappers } from '@/hooks/use-cappers';
import type { Capper } from '@/types/form';

interface CapperSelectProps {
  value?: string;
  onValueChange: (capperId: string) => void;
  onCapperChange?: (capper: Capper | null) => void;
  disabled?: boolean;
  error?: string;
}

export function CapperSelect({
  value,
  onValueChange,
  onCapperChange,
  disabled = false,
  error,
}: CapperSelectProps) {
  const { data: cappers, isLoading, error: queryError } = useCappers(true);
  const [search, setSearch] = React.useState('');

  // Filter cappers by search query
  const filteredCappers = React.useMemo(() => {
    if (!cappers) return [];
    if (!search) return cappers;

    const lowerSearch = search.toLowerCase();
    return cappers.filter(
      capper =>
        capper.name.toLowerCase().includes(lowerSearch) ||
        capper.tier?.toLowerCase().includes(lowerSearch)
    );
  }, [cappers, search]);

  // Handle selection
  const handleValueChange = React.useCallback(
    (capperId: string) => {
      onValueChange(capperId);

      // Cache discord thread ID if available
      const selectedCapper = cappers?.find(c => c.id === capperId);
      if (selectedCapper) {
        onCapperChange?.(selectedCapper);

        // Store in session storage for quick access
        if (selectedCapper.discordId) {
          sessionStorage.setItem(
            `capper:${capperId}:discordId`,
            selectedCapper.discordId
          );
        }
      }
    },
    [cappers, onValueChange, onCapperChange]
  );

  // Keyboard search support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when select is open and key is alphanumeric
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        setSearch(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setSearch(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clear search when select closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearch('');
    }
  };

  const selectedCapper = cappers?.find(c => c.id === value);

  return (
    <div className="space-y-2">
      <SelectPrimitive.Root
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled || isLoading}
        onOpenChange={handleOpenChange}
      >
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive'
          )}
          aria-label="Select capper"
        >
          <span className="flex-1">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading cappers...
              </span>
            ) : selectedCapper ? (
              <span className="flex items-center gap-2">
                <span className="font-medium">{selectedCapper.name}</span>
                {selectedCapper.tier && (
                  <span className="text-xs text-muted-foreground">
                    ({selectedCapper.tier})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Select a capper...</span>
            )}
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            position="popper"
            sideOffset={5}
          >
            <SelectPrimitive.Viewport className="p-1">
              {search && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Searching: {search}
                </div>
              )}

              {filteredCappers.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No cappers found
                </div>
              ) : (
                filteredCappers.map(capper => (
                  <SelectPrimitive.Item
                    key={capper.id}
                    value={capper.id}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>

                    <div className="flex flex-col">
                      <SelectPrimitive.ItemText>
                        <span className="font-medium">{capper.name}</span>
                      </SelectPrimitive.ItemText>
                      {(capper.tier || capper.stats) && (
                        <span className="text-xs text-muted-foreground">
                          {capper.tier}
                          {capper.stats?.winRate && (
                            <> • {(capper.stats.winRate * 100).toFixed(1)}% win rate</>
                          )}
                        </span>
                      )}
                    </div>
                  </SelectPrimitive.Item>
                ))
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      {queryError && (
        <p className="text-sm text-destructive">
          Failed to load cappers. Please try again.
        </p>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboboxItem {
  value: string;
  label: string;
  team_id?: string; // GAUNTLET-CLOSEOUT-028: Optional team_id for player items
}

interface ComboboxProps {
  items: ComboboxItem[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onSearch?: (query: string) => void;
}

export function Combobox({
  items,
  value,
  onValueChange,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  disabled = false,
  loading = false,
  className,
  onSearch,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between bg-white text-gray-900', className)}
          disabled={disabled}
        >
          {loading ? (
            <span className="text-gray-500">Loading...</span>
          ) : value ? (
            items.find(item => item.value === value)?.label || placeholder
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={onSearch}
            className="text-gray-900"
          />
          <CommandEmpty className="py-2 text-center text-sm text-gray-500">
            {emptyText}
          </CommandEmpty>
          <CommandGroup className="max-h-60 overflow-auto">
            {items.map(item => (
              <CommandItem
                key={item.value}
                value={item.value}
                onSelect={() => {
                  onValueChange(item.value);
                  setOpen(false);
                }}
                className="text-gray-900"
              >
                <Check
                  className={cn('mr-2 h-4 w-4', value === item.value ? 'opacity-100' : 'opacity-0')}
                />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

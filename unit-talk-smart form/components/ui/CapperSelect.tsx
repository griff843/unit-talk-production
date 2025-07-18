import { useState, useEffect, useMemo, memo } from 'react';
import { List, AutoSizer } from 'react-virtualized';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tooltip } from './Tooltip';

interface Capper {
  id: string;
  name: string;
  discord_handle: string;
  win_rate: number;
  roi: number;
  total_picks: number;
  avatar_url?: string;
}

// Define the allowed capper names as a union type
export type CapperName =
  | "Griff"
  | "Noah"
  | "Jeffro"
  | "Vicgo"
  | "Sauced"
  | "MoneyReef"
  | "Squirrel"
  | "Ziplock"
  | "Jaybird"
  | "Polo";

interface CapperSelectProps {
  value: CapperName;
  onChange: (value: CapperName) => void;
  className?: string;
}

const fetchCappers = async () => {
  const { data, error } = await supabase
    .from('cappers')
    .select('*')
    .order('win_rate', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

const CapperOption = memo(({ capper, isSelected, onSelect }: {
  capper: Capper;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <div
    className={`p-3 rounded-lg cursor-pointer transition-all ${
      isSelected
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
    }`}
    onClick={onSelect}
    role="option"
    aria-selected={isSelected}
  >
    <div className="flex items-center space-x-3">
      {capper.avatar_url ? (
        <img
          src={capper.avatar_url}
          alt=""
          className="w-8 h-8 rounded-full"
          loading="lazy"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
      )}
      <div>
        <div className="font-medium">{capper.name}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {capper.discord_handle}
        </div>
      </div>
      <div className="ml-auto text-right">
        <div className="text-sm font-medium">
          {(capper.win_rate * 100).toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {capper.total_picks} picks
        </div>
      </div>
    </div>
  </div>
));

CapperOption.displayName = 'CapperOption';

export const CapperSelect = memo(function CapperSelect({ 
  value, 
  onChange, 
  className = '' 
}: CapperSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: cappers = [], isLoading } = useQuery({
    queryKey: ['cappers'],
    queryFn: fetchCappers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const filteredCappers = useMemo(() => 
    cappers.filter(capper => 
      capper.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      capper.discord_handle.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [cappers, searchQuery]
  );

  const selectedCapper = useMemo(() => 
    cappers.find(c => c.name === value || c.discord_handle === value),
    [cappers, value]
  );

  const rowRenderer = ({ index, key, style }: any) => {
    const capper = filteredCappers[index];
    return (
      <div key={key} style={style}>
        <CapperOption
          capper={capper}
          isSelected={capper.name === value || capper.discord_handle === value}
          onSelect={() => {
            onChange(capper.name);
            setIsOpen(false);
          }}
        />
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <Tooltip content="Click to select a capper">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-left"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select capper"
        >
          {selectedCapper ? (
            <div className="flex items-center space-x-3">
              {selectedCapper.avatar_url ? (
                <img
                  src={selectedCapper.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              )}
              <div>
                <div className="font-medium">{selectedCapper.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedCapper.discord_handle}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Select a capper</div>
          )}
        </button>
      </Tooltip>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          role="listbox"
        >
          <div className="p-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cappers..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              aria-label="Search cappers"
            />
          </div>

          <div className="h-64">
            <AutoSizer>
              {({ width, height }) => (
                <List
                  width={width}
                  height={height}
                  rowCount={filteredCappers.length}
                  rowHeight={80}
                  rowRenderer={rowRenderer}
                  overscanRowCount={5}
                />
              )}
            </AutoSizer>
          </div>

          {isLoading && (
            <div className="p-4 text-center text-gray-500">
              Loading cappers...
            </div>
          )}

          {!isLoading && filteredCappers.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No cappers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}); 
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './input';

interface SmartSearchItem {
  id: string;
  name: string;
  type: 'team' | 'player' | 'game';
  sport?: string;
  abbreviation?: string;
  position?: string;
  team?: string;
}

interface SmartSearchProps {
  onSelect: (item: SmartSearchItem) => void;
  placeholder?: string;
  searchType: 'teams' | 'players' | 'games';
  sport?: string;
  disabled?: boolean;
  teamFilter?: string[];
  value?: string;
  onClear?: () => void;
}

/**
 * V1.1 HARDENED: SmartSearch Component
 *
 * SPEC-TRUE ENDPOINTS ONLY:
 * - Teams: GET /api/catalog/teams?sport=&q=
 * - Players: GET /api/catalog/players?sport=&q=
 *
 * Per Section 2 - Canonical Data Source Contract:
 * "All data must originate from canonical DB tables"
 */
export function SmartSearch({
  onSelect,
  placeholder = 'Start typing to search...',
  searchType,
  sport,
  disabled = false,
  teamFilter,
  value = '',
  onClear,
}: SmartSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SmartSearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        setError(null);
        return;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);
      setError(null);

      try {
        let searchResults: SmartSearchItem[] = [];

        if (searchType === 'teams') {
          // V1.1 HARDENED: Use SPEC-TRUE /api/catalog/teams endpoint
          const params = new URLSearchParams();
          if (sport) params.set('sport', sport);
          params.set('q', searchQuery);

          const response = await fetch(`/api/catalog/teams?${params}`, { signal });

          if (signal.aborted) return;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Teams API error: ${response.status}`);
          }

          const data = await response.json();
          searchResults = (data.teams || []).map((team: any) => ({
            id: team.team_uuid || team.id,
            name: team.name,
            type: 'team' as const,
            sport: team.sport,
            abbreviation: team.abbr || team.abbreviation,
          }));
        } else if (searchType === 'players') {
          // V1.1 HARDENED: Use SPEC-TRUE /api/catalog/players endpoint
          const params = new URLSearchParams();
          if (sport) params.set('sport', sport);
          params.set('q', searchQuery);

          const response = await fetch(`/api/catalog/players?${params}`, { signal });

          if (signal.aborted) return;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Players API error: ${response.status}`);
          }

          const data = await response.json();
          searchResults = (data.players || []).map((player: any) => ({
            id: player.name, // Use name as ID (raw_props doesn't have player UUIDs)
            name: player.name,
            type: 'player' as const,
            sport: sport,
            team: player.team,
          }));

          // V1.1 COMPLIANCE: Apply team filter for cascading (Section 3)
          if (teamFilter && teamFilter.length > 0) {
            searchResults = searchResults.filter(
              item =>
                item.team &&
                teamFilter.some(
                  t =>
                    item.team?.toLowerCase().includes(t.toLowerCase()) ||
                    t.toLowerCase().includes(item.team?.toLowerCase() || '')
                )
            );
          }
        } else if (searchType === 'games') {
          // Games are fetched separately via games endpoint
          // This search type may be deprecated in favor of game selection UI
          searchResults = [];
        }

        if (!signal.aborted) {
          setResults(searchResults.slice(0, 10)); // Limit to 10 results
          setIsOpen(searchResults.length > 0);
        }
      } catch (err) {
        if (signal.aborted) return;

        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        console.error('[SmartSearch] Error:', errorMessage);
        setError(errorMessage);
        setResults([]);
        setIsOpen(false);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [searchType, sport, teamFilter]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, performSearch]);

  const handleSelect = (item: SmartSearchItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelect(item);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value === '' && onClear) {
      onClear();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pr-8"
        />
        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {isLoading && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-50 p-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Searching...
          </div>
        </div>
      )}

      {error && query.length >= 2 && !isLoading && (
        <div className="absolute top-full left-0 right-0 bg-red-50 border border-red-200 rounded-b-md shadow-lg z-50 p-2">
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      )}

      {isOpen && results.length > 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {results.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 focus:bg-blue-50 focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">
                    {item.abbreviation && `${item.abbreviation} • `}
                    {item.position && `${item.position} • `}
                    {item.team && `${item.team} • `}
                    {item.sport}
                  </div>
                </div>
                <div className="text-xs text-gray-400 capitalize">{item.type}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && !error && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-50 p-3">
          <div className="text-gray-500 text-sm">No results found for "{query}"</div>
          <div className="text-xs text-gray-400 mt-1">
            Try a different spelling or use manual entry
          </div>
        </div>
      )}

      {query.length > 0 && query.length < 2 && (
        <div className="absolute top-full left-0 right-0 bg-gray-50 border border-gray-200 rounded-b-md shadow-sm z-50 p-2">
          <div className="text-gray-400 text-xs">Type at least 2 characters to search</div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, User } from 'lucide-react';

// SEARCH-CATALOG-CONTRACT-035: Player type from unified search
// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical PlayersRow
interface SearchPlayer {
  id: string;
  name: string;
  team: string;
  team_id?: string;
  display: string;
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Legacy alias for backward compatibility
type Player = SearchPlayer;

interface SmartPlayerInputProps {
  value: string;
  sport: string;
  // SEARCH-CATALOG-CONTRACT-035: Include player_id and team_id for entity resolution
  onChange: (playerName: string, team?: string, playerId?: string, teamId?: string) => void;
  placeholder?: string;
}

export function SmartPlayerInput({
  value,
  sport,
  onChange,
  placeholder = 'Type player name...',
}: SmartPlayerInputProps) {
  const [query, setQuery] = useState(value);
  const [players, setPlayers] = useState<SearchPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // SEARCH-CATALOG-CONTRACT-035: Search players via unified search endpoint
  useEffect(() => {
    const searchPlayers = async () => {
      if (query.length < 2) {
        setPlayers([]);
        setShowSuggestions(false);
        return;
      }

      setLoading(true);
      try {
        // Use the unified search API with type=player filter
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&sport=${sport}&type=player&limit=15`
        );
        const result = await response.json();

        if (result.results) {
          // Transform search results to player format
          const playerResults: Player[] = result.results.map((r: any) => ({
            id: r.id,
            name: r.name,
            team: r.team || '',
            team_id: r.team_id,
            display: r.display_label || `${r.name} (${r.team || r.sport})`,
          }));
          setPlayers(playerResults);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error searching players:', error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchPlayers, 150);
    return () => clearTimeout(debounceTimer);
  }, [query, sport]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
  };

  // SEARCH-CATALOG-CONTRACT-035: Handle player selection with entity IDs
  const handlePlayerSelect = (player: Player) => {
    setQuery(player.name);
    onChange(player.name, player.team, player.id, player.team_id);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || players.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < players.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : players.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < players.length) {
          handlePlayerSelect(players[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (players.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className="pl-10"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && players.length > 0 && (
        <Card
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto border shadow-lg bg-background"
        >
          <div className="p-2">
            <div className="text-xs text-muted-foreground mb-2 px-2">
              Found {players.length} player{players.length !== 1 ? 's' : ''}
            </div>
            {players.map((player, index) => (
              <Button
                key={`${player.name}-${player.team}`}
                variant="ghost"
                className={`w-full justify-start h-auto p-2 ${
                  index === selectedIndex ? 'bg-accent' : ''
                }`}
                onClick={() => handlePlayerSelect(player)}
              >
                <div className="flex items-center gap-2 w-full">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{player.name}</div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {player.team}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {sport}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* No results */}
      {showSuggestions && !loading && query.length >= 2 && players.length === 0 && (
        <Card className="absolute z-50 w-full mt-1 border shadow-lg bg-background">
          <div className="p-4 text-center text-sm text-muted-foreground">
            No players found for "{query}"
          </div>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { SportsAsset } from '@/components/ui/sports-asset';
import { GameSelection, Sport } from '../types';
import { ManualPropCreator } from './ManualPropCreator';
import type { Game } from './GamesList';

interface PlayerPropsPanelProps {
  game: Game;
  sport?: Sport;
  ticketType?: string;
  existingSelections: GameSelection[];
  onAddSelection: (selection: GameSelection) => void;
}

export function PlayerPropsPanel({
  game,
  sport,
  ticketType: _ticketType,
  existingSelections: _existingSelections,
  onAddSelection,
}: PlayerPropsPanelProps) {
  const [props, setProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProp, setSelectedProp] = useState<any>(null);
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('');
  const [line, setLine] = useState('');
  const [showManualPropCreator, setShowManualPropCreator] = useState(false);

  // Player search state
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerItems, setPlayerItems] = useState<ComboboxItem[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  // SMARTFORM-ENTITY-RESOLUTION-001: Store full player data for entity resolution
  const [selectedPlayerData, setSelectedPlayerData] = useState<ComboboxItem | null>(null);
  const playerDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // SEARCH-CATALOG-CONTRACT-035: Player search via canonical player catalog
  // SMARTFORM-ENTITY-RESOLUTION-001: Includes team_id for entity resolution
  const searchPlayers = useCallback(
    async (q: string) => {
      if (q.length < 3) {
        setPlayerItems([]);
        return;
      }
      setPlayersLoading(true);
      setPlayersError(null);
      try {
        const params = new URLSearchParams({
          q,
          sport: sport || '',
          limit: '20',
        });
        const url = `/api/catalog/players?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.message || data.error);

        // SEARCH-CATALOG-CONTRACT-035: Transform catalog results to ComboboxItem format
        // SMARTFORM-ENTITY-RESOLUTION-001: Include team_id for auto-fill
        const items: ComboboxItem[] = (data.players || []).map((p: any) => ({
          value: p.player_id,
          label: p.player_name,
          team_id: p.team_id,
          description: [p.team_abbr || p.team_name, p.position].filter(Boolean).join(' • '),
          imageUrl: p.headshot_url || null,
          assetType: 'player',
        }));
        setPlayerItems(items);
      } catch (err: any) {
        console.error('Error searching players:', err);
        setPlayersError(err.message || 'Player search unavailable');
        setPlayerItems([]);
      } finally {
        setPlayersLoading(false);
      }
    },
    [sport]
  );

  const handlePlayerSearch = useCallback(
    (q: string) => {
      setPlayerQuery(q);
      if (playerDebounceRef.current) clearTimeout(playerDebounceRef.current);
      playerDebounceRef.current = setTimeout(() => searchPlayers(q), 300);
    },
    [searchPlayers]
  );

  // SEARCH-CATALOG-CONTRACT-035: Load props from catalog endpoint
  useEffect(() => {
    const loadProps = async () => {
      setLoading(true);
      try {
        // Try the catalog props endpoint first (optimized MVs)
        // For game-specific props, we query by sport and let the MV handle it
        const response = await fetch(`/api/catalog/props?sport=${sport}&limit=50`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        // V1.1 HARDENED: NO FALLBACK - only catalog endpoint is spec-compliant
        if (result.props?.length > 0) {
          // Transform catalog props to component format
          const transformedProps = result.props.map((p: any) => ({
            id: p.id,
            display_name: p.display_label || `${p.player_name} ${p.stat_type} ${p.line}`,
            player_name: p.player_name,
            player_id: p.player_id,
            team: p.team,
            team_id: p.team_id,
            line: p.line,
            stat_type: p.stat_type,
            selection_options: [
              { value: 'over', label: `Over ${p.line}`, odds: p.over_odds },
              { value: 'under', label: `Under ${p.line}`, odds: p.under_odds },
            ],
          }));
          setProps(transformedProps);
        } else {
          // V1.1 HARDENED: No props available - user can create manual prop
          setProps([]);
        }
      } catch (err) {
        console.error('Error loading props:', err);
        setProps([]);
      } finally {
        setLoading(false);
      }
    };

    loadProps();
  }, [game.id, sport]);

  const handlePropSelectionChange = (propId: string, selectionType: string) => {
    const prop = props.find(p => p.id === propId);
    if (!prop?.selection_options) return;
    const opt = prop.selection_options.find((o: any) => o.value === selectionType);
    if (!opt) return;

    setSelection(`${prop.display_name} - ${opt.label}`);
    setOdds(opt.odds.toString());
    setLine(prop.line ? prop.line.toString() : '');
    setSelectedProp(prop);
  };

  const handleAddSelection = () => {
    if (!selection || !odds) return;

    // SMARTFORM-ENTITY-RESOLUTION-001: Resolve entity IDs from selectedPlayerData OR selectedProp (for manual props)
    // Priority: selectedPlayerData (from Combobox search) > selectedProp (from ManualPropCreator)
    const resolvedPlayerId = selectedPlayerData?.value || (selectedProp as any)?.player_id;
    const resolvedPlayerName = selectedPlayerData?.label || (selectedProp as any)?.player_name;
    const resolvedTeamId = selectedPlayerData?.team_id || (selectedProp as any)?.team_id;
    const resolvedPlayerHeadshotUrl = selectedPlayerData?.imageUrl || null;

    // CLV-COVERAGE-SCALE-001: Explicitly set source:'api' and game_id for Games mode
    // SMARTFORM-ENTITY-RESOLUTION-001: Include entity IDs for FanDuel-style resolution
    const newSelection: GameSelection = {
      id: crypto.randomUUID(),
      game_id: game.id,
      game: game.matchup || `${game.awayTeam} @ ${game.homeTeam}`,
      selection,
      odds,
      line: line || undefined,
      bet_type: 'player_prop', // Player props always have this bet type
      sport, // Per-leg sport for cross-sport parlays
      source: 'api', // CLV-COVERAGE-SCALE-001: Explicit source for game_start_time tracking
      // SMARTFORM-ENTITY-RESOLUTION-001: Include entity IDs from search OR manual prop
      ...(resolvedPlayerId && { player_id: resolvedPlayerId }),
      ...(resolvedPlayerName && { player_name: resolvedPlayerName }),
      ...(resolvedTeamId && { team_id: resolvedTeamId }),
      ...(resolvedPlayerHeadshotUrl && { player_headshot_url: resolvedPlayerHeadshotUrl }),
      ...(game.home_logo_url && { home_team_logo_url: game.home_logo_url }),
      ...(game.away_logo_url && { away_team_logo_url: game.away_logo_url }),
    };

    console.log('[ENTITY-RESOLUTION] Adding selection with entity IDs:', {
      player_id: newSelection.player_id,
      player_name: newSelection.player_name,
      team_id: newSelection.team_id,
      game_id: newSelection.game_id,
      source: selectedPlayerData ? 'combobox_search' : 'manual_prop',
    });

    onAddSelection(newSelection);
    setSelection('');
    setOdds('');
    setLine('');
    setSelectedProp(null);
    setSelectedPlayer('');
    setSelectedPlayerData(null);
  };

  const handleManualPropCreated = (prop: any) => {
    // SMARTFORM-ENTITY-RESOLUTION-001: Preserve entity IDs from ManualPropCreator
    const transformed = {
      id: prop.id,
      display_name: `${prop.player_name} ${prop.prop_type}${prop.line ? ` ${prop.line}` : ''}`,
      line: prop.line,
      // Preserve entity IDs for selection resolution
      player_id: prop.player_id,
      player_name: prop.player_name,
      team_id: prop.team_id,
      selection_options: prop.line
        ? [
            { value: 'over', label: `Over ${prop.line}`, odds: prop.over_odds },
            { value: 'under', label: `Under ${prop.line}`, odds: prop.under_odds },
          ]
        : [
            { value: 'over', label: 'Over', odds: prop.over_odds },
            { value: 'under', label: 'Under', odds: prop.under_odds },
          ],
    };
    console.log('[ENTITY-RESOLUTION] Manual prop created with entity IDs:', {
      player_id: transformed.player_id,
      player_name: transformed.player_name,
      team_id: transformed.team_id,
    });
    setProps(prev => [...prev, transformed]);
    setShowManualPropCreator(false);
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-2 text-xs text-gray-500">Loading player props...</p>
      </div>
    );
  }

  if (props.length === 0 && !showManualPropCreator) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500 mb-2">No player props available for this game</p>
        <Button variant="outline" size="sm" onClick={() => setShowManualPropCreator(true)}>
          Create Custom Prop
        </Button>
      </div>
    );
  }

  // SMARTFORM-GAME-LOCK-003: Build restricted teamItems for game teams ONLY
  // FanDuel-style: Only allow selecting teams that are in this game
  const gameTeamItems: ComboboxItem[] = [];
  const homeTeamUuid = (game as any).home_team_uuid;
  const awayTeamUuid = (game as any).away_team_uuid;

  if (homeTeamUuid) {
    gameTeamItems.push({
      value: homeTeamUuid,
      label: game.homeTeam || 'Home Team',
    });
  }
  if (awayTeamUuid) {
    gameTeamItems.push({
      value: awayTeamUuid,
      label: game.awayTeam || 'Away Team',
    });
  }

  if (showManualPropCreator) {
    return (
      <ManualPropCreator
        gameId={game.id}
        gameMatchup={game.matchup || `${game.awayTeam} @ ${game.homeTeam}`}
        sport={sport || 'MLB'}
        onPropCreated={handleManualPropCreated}
        onCancel={() => setShowManualPropCreator(false)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-700">
          Player Props: {game.awayTeam} @ {game.homeTeam}
        </h4>
        <Button variant="outline" size="sm" onClick={() => setShowManualPropCreator(true)}>
          Custom Prop
        </Button>
      </div>

      {/* Player search combobox */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Search Player</label>
        {playersError ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <span className="flex-1">{playersError}</span>
          </div>
        ) : (
          <Combobox
            items={playerItems}
            value={selectedPlayer}
            onValueChange={value => {
              setSelectedPlayer(value);
              // SMARTFORM-ENTITY-RESOLUTION-001: Store full player data for entity IDs
              const playerData = playerItems.find(p => p.value === value);
              setSelectedPlayerData(playerData || null);
              if (playerData) {
                console.log('[ENTITY-RESOLUTION] Player selected:', {
                  player_id: playerData.value,
                  player_name: playerData.label,
                  team_id: playerData.team_id,
                });
              }
            }}
            placeholder="Type 3+ chars to search players..."
            searchPlaceholder="Search players..."
            emptyText={playerQuery.length < 3 ? 'Type at least 3 characters' : 'No players found'}
            loading={playersLoading}
            onSearch={handlePlayerSearch}
          />
        )}
        {selectedPlayerData ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <SportsAsset
              label={selectedPlayerData.label}
              imageUrl={selectedPlayerData.imageUrl}
              type="player"
              className="h-8 w-8 shrink-0"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900">
                {selectedPlayerData.label}
              </div>
              {selectedPlayerData.description ? (
                <div className="truncate text-xs text-gray-500">
                  {selectedPlayerData.description}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {props.map(prop => (
          <div key={prop.id} className="p-3 border rounded-lg">
            <div className="font-medium text-sm mb-2">{prop.display_name}</div>
            <div className="flex gap-2">
              {prop.selection_options?.map((opt: any) => (
                <Button
                  key={opt.value}
                  variant={
                    selectedProp?.id === prop.id && selection.includes(opt.label)
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  className="flex-1"
                  onClick={() => handlePropSelectionChange(prop.id, opt.value)}
                >
                  {opt.label} ({opt.odds > 0 ? '+' : ''}
                  {opt.odds})
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedProp && selection && (
        <Button onClick={handleAddSelection} disabled={!selection || !odds} className="w-full">
          Add Selection
        </Button>
      )}
    </div>
  );
}

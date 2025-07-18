'use client';
import { useState, useRef, useEffect } from "react";
import { BetType, Game, Player, Sport, STAT_TYPES_BY_SPORT, TicketLeg } from "../types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LegCardProps {
  leg: TicketLeg;
  index: number;
  sport: Sport;
  onUpdate: (index: number, updates: Partial<TicketLeg>) => void;
  onRemove: (index: number) => void;
  onSearch: (index: number, query: string) => void;
  searchResults: {
    props?: Player[];
    games?: Game[];
  };
  onSelectPlayer: (index: number, player: Player) => void;
  onSelectGame: (index: number, game: Game) => void;
  isPrimary: boolean;
  onLegTypeChange: (index: number, value: BetType) => void;
}

export function LegCard({
  leg,
  index,
  sport,
  onUpdate,
  onRemove,
  onSearch,
  searchResults,
  onSelectPlayer,
  onSelectGame,
  isPrimary,
  onLegTypeChange
}: LegCardProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const hasSearchResults = searchResults &&
    ((searchResults.props && searchResults.props.length > 0) ||
     (searchResults.games && searchResults.games.length > 0));

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle player selection
  const handlePlayerSelect = (player: Player) => {
    onSelectPlayer(index, player);
    setIsSearching(false);
    setSearchQuery(player.player_name); // Update the input field with selected player name
  };

  // Handle game selection
  const handleGameSelect = (game: Game) => {
    onSelectGame(index, game);
    setIsSearching(false);
    setSearchQuery(game.matchup); // Update the input field with selected game matchup
  };

  return (
    <Card className="p-4 space-y-4 dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-md font-semibold dark:text-white text-gray-900">
            {isPrimary ? "🎯 Primary Leg" : `Leg ${index + 1}`}
          </h3>
          {leg.risk_level && (
            <Badge variant={
              leg.risk_level === "Low" ? "success" :
              leg.risk_level === "Medium" ? "warning" : "destructive"
            }>
              {leg.risk_level} Risk
            </Badge>
          )}
          {leg.edge && (
            <Badge variant="secondary">
              {leg.edge > 0 ? "+" : ""}{leg.edge}% Edge
            </Badge>
          )}
        </div>
        {!isPrimary && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-400"
          >
            ❌ Remove
          </button>
        )}
      </div>

      <Select
        value={leg.bet_type}
        onValueChange={(value: BetType) => onLegTypeChange(index, value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select Bet Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Player Prop">Player Prop</SelectItem>
          <SelectItem value="Moneyline">Moneyline</SelectItem>
          <SelectItem value="Spread">Spread</SelectItem>
          <SelectItem value="Total">Total</SelectItem>
          <SelectItem value="Team Total">Team Total</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative" ref={searchRef}>
        <Input
          type="text"
          placeholder={leg.bet_type === "Player Prop" ? "Search player" : "Search team or matchup"}
          value={searchQuery || leg.player_name || leg.matchup || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setSearchQuery(value);
            setIsSearching(true);
            onSearch(index, value);
          }}
          onClick={() => setIsSearching(true)}
          className="w-full dark:bg-gray-700 dark:text-white dark:border-gray-600"
        />

        {isSearching && hasSearchResults && (
          <div className="absolute z-10 w-full mt-1">
            <Card className="max-h-60 overflow-y-auto divide-y dark:divide-gray-700 divide-gray-200 dark:bg-gray-800 bg-white border dark:border-gray-700 border-gray-200">
              {searchResults.props?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlayerSelect(p)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 dark:text-white text-gray-900"
                >
                  {p.photo_url && (
                    <img src={p.photo_url} alt={p.player_name} className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <div>{p.player_name}</div>
                    <div className="text-sm dark:text-gray-400 text-gray-500">{p.team}</div>
                  </div>
                </button>
              ))}
              {searchResults.games?.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGameSelect(g)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white text-gray-900"
                >
                  {g.matchup}
                </button>
              ))}
            </Card>
          </div>
        )}
      </div>

      {leg.bet_type === "Player Prop" && (
        <div className="grid grid-cols-2 gap-4">
          <Select
            value={leg.stat_type}
            onValueChange={(value) => onUpdate(index, { stat_type: value })}
          >
            <SelectTrigger className="w-full dark:bg-gray-700 dark:text-white dark:border-gray-600">
              <SelectValue placeholder="Select Stat" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
              {STAT_TYPES_BY_SPORT[sport].map((stat) => (
                <SelectItem key={stat} value={stat}>
                  {stat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Line"
            value={leg.line}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, { line: e.target.value })}
            className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Select
          value={leg.outcome}
          onValueChange={(value) => onUpdate(index, { outcome: value as "Over" | "Under" | "" })}
        >
          <SelectTrigger className="w-full dark:bg-gray-700 dark:text-white dark:border-gray-600">
            <SelectValue placeholder="Select Outcome" />
          </SelectTrigger>
          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
            <SelectItem value="Over">Over</SelectItem>
            <SelectItem value="Under">Under</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="text"
          placeholder="Odds (e.g. -115)"
          value={leg.odds}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, { odds: e.target.value })}
          className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
        />
      </div>

      {leg.marketing_tags && leg.marketing_tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {leg.marketing_tags.map((tag, i) => (
            <Badge key={i} variant="outline" className="dark:border-gray-600 dark:text-gray-300">{tag}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
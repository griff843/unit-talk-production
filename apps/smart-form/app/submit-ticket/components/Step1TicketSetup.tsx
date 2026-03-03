'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  SPORTS,
  TICKET_TYPES,
  DISPLAY_LABELS,
  Sport,
  TicketType,
  MarketType,
  BetCategory,
  Capper,
} from '../types';
import { fetchCappers } from '@/lib/api-client';

interface Step1TicketSetupProps {
  data: {
    capper?: string;
    capper_id?: string;
    ticket_type?: TicketType;
    sport?: Sport;
    game_date?: string;
    bet_type?: string;
    market_type?: MarketType;
    unit_size?: number;
    confidence_level?: number;
  };
  onUpdate: (updates: any) => void;
  onNext: () => void;
  errors?: any;
}

// Top 5 sports shown as primary buttons
const PRIMARY_SPORTS: Sport[] = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAB'];
const SECONDARY_SPORTS: Sport[] = SPORTS.filter(s => !PRIMARY_SPORTS.includes(s)) as Sport[];

// Sport color coding
const SPORT_COLORS: Record<string, string> = {
  NFL: 'bg-blue-600',
  NBA: 'bg-orange-500',
  MLB: 'bg-red-600',
  NHL: 'bg-slate-700',
  NCAAB: 'bg-blue-800',
  NCAAF: 'bg-red-800',
  WNBA: 'bg-orange-600',
  'UFC/MMA': 'bg-yellow-600',
  Boxing: 'bg-amber-600',
  Soccer: 'bg-green-600',
  Tennis: 'bg-emerald-600',
  Golf: 'bg-green-700',
  NASCAR: 'bg-red-500',
  F1: 'bg-red-700',
};

// Market type options (3 buttons)
const MARKET_OPTIONS: { value: MarketType; label: string }[] = [
  { value: 'pre_game', label: 'Pre-Game' },
  { value: 'live', label: 'Live' },
  { value: 'futures', label: 'Futures' },
];

export function Step1TicketSetup({ data, onUpdate, onNext, errors }: Step1TicketSetupProps) {
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [isLoadingCappers, setIsLoadingCappers] = useState(true);
  const [showMoreSports, setShowMoreSports] = useState(false);

  // Unit size derived from canonical state
  const unitSize = data.unit_size ?? 2.0;
  const confidence = data.confidence_level ?? 7;

  // Initialize defaults on mount
  const hasInitializedDefaults = useRef(false);
  useEffect(() => {
    if (!hasInitializedDefaults.current) {
      hasInitializedDefaults.current = true;

      const updates: Record<string, any> = {};

      if (data.sport === undefined) updates.sport = 'NBA';
      if (data.game_date === undefined) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        updates.game_date = `${year}-${month}-${day}`;
      }
      if (data.unit_size === undefined) updates.unit_size = 2.0;
      if (data.confidence_level === undefined) updates.confidence_level = 7;
      // Auto parlay defaults to true, hidden from UI
      updates.auto_parlay = true;
      updates.odds_format = 'AMERICAN';

      if (Object.keys(updates).length > 0) {
        onUpdate(updates);
      }
    }
  }, [onUpdate]);

  // Fetch cappers
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadCappers = async () => {
      try {
        setIsLoadingCappers(true);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Capper fetch timeout')), 10000);
        });
        const cappersData = await Promise.race([fetchCappers(), timeoutPromise]);
        if (isMounted) setCappers(cappersData as Capper[]);
      } catch (error) {
        console.error('Error loading cappers:', error);
        if (isMounted) setCappers([]);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setIsLoadingCappers(false);
      }
    };

    loadCappers();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const handleCapperSelect = (capperId: string) => {
    const selectedCapper = cappers.find(c => c.id === capperId);
    onUpdate({ capper: selectedCapper?.name || capperId, capper_id: capperId });
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      onUpdate({ game_date: date.toISOString().split('T')[0] });
    }
  };

  // Filter bet types based on sport
  const getAvailableBetTypes = (): BetCategory[] => {
    const basicTypes: BetCategory[] = ['spread', 'total', 'moneyline'];
    const sportSpecific: BetCategory[] = [];

    if (['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF'].includes(data.sport || '')) {
      // SMART-FORM-UX-MINIMUM-PRO-002: Add team_total alongside player_prop and team_prop
      sportSpecific.push('player_prop', 'team_total' as BetCategory, 'team_prop');
    }
    if (['NBA', 'NFL', 'MLB', 'NHL'].includes(data.sport || '')) {
      sportSpecific.push('futures');
    }

    return [...basicTypes, ...sportSpecific];
  };

  const isValid =
    data.capper &&
    data.ticket_type &&
    data.sport &&
    data.game_date &&
    data.bet_type &&
    data.market_type &&
    data.unit_size &&
    data.confidence_level;

  return (
    <div className="space-y-6">
      {/* Section A: Capper */}
      <section>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Capper <span className="text-red-500">*</span>
        </label>
        {isLoadingCappers ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent" />
            Loading cappers...
          </div>
        ) : cappers.length === 0 ? (
          <p className="text-sm text-red-600">No cappers available. Please refresh.</p>
        ) : (
          <Select
            value={cappers.find(c => c.name === data.capper)?.id || ''}
            onValueChange={handleCapperSelect}
          >
            <SelectTrigger className="bg-background text-foreground">
              <SelectValue placeholder="Choose capper" />
            </SelectTrigger>
            <SelectContent>
              {cappers.map(capper => (
                <SelectItem key={capper.id} value={capper.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{capper.name}</span>
                    {capper.stats?.isLive && (
                      <Badge className="bg-green-500 text-white text-xs">LIVE</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors?.capper && <p className="text-sm text-red-600 mt-1">{errors.capper}</p>}
      </section>

      {/* Section B: Ticket Type */}
      <section>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Ticket Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TICKET_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate({ ticket_type: type })}
              className={`
                px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
                ${
                  data.ticket_type === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-border/80'
                }
              `}
            >
              {DISPLAY_LABELS[type] || type}
            </button>
          ))}
        </div>
        {errors?.ticket_type && <p className="text-sm text-red-600 mt-1">{errors.ticket_type}</p>}
      </section>

      {/* Section C: Sport */}
      <section>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Sport <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PRIMARY_SPORTS.map(sport => (
            <button
              key={sport}
              type="button"
              onClick={() => onUpdate({ sport })}
              className={`
                px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                ${
                  data.sport === sport
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-border/80'
                }
              `}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1.5 ${SPORT_COLORS[sport] || 'bg-muted-foreground'}`}
              />
              {sport}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreSports(prev => !prev)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:border-border/80 transition-colors"
          >
            {showMoreSports ? 'Less' : 'More...'}
          </button>
        </div>
        {showMoreSports && (
          <div className="flex flex-wrap gap-2 mt-2">
            {SECONDARY_SPORTS.map(sport => (
              <button
                key={sport}
                type="button"
                onClick={() => onUpdate({ sport })}
                className={`
                  px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${
                    data.sport === sport
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-border/80'
                  }
                `}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-1.5 ${SPORT_COLORS[sport] || 'bg-muted-foreground'}`}
                />
                {sport}
              </button>
            ))}
          </div>
        )}
        {errors?.sport && <p className="text-sm text-red-600 mt-1">{errors.sport}</p>}
      </section>

      {/* Section D: Game Date */}
      <section>
        <label className="block text-sm font-semibold text-foreground mb-2">Game Date</label>
        <div className="relative">
          <DatePicker
            selected={data.game_date ? new Date(data.game_date + 'T00:00:00') : new Date()}
            onChange={handleDateChange}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            dateFormat="MMMM d, yyyy"
            placeholderText="Select game date"
          />
          <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground pointer-events-none" />
        </div>
        {errors?.game_date && <p className="text-sm text-red-600 mt-1">{errors.game_date}</p>}
      </section>

      {/* Section E: Bet Type */}
      <section>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Bet Type {data.sport ? `(${data.sport})` : ''} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {getAvailableBetTypes().map(betType => (
            <button
              key={betType}
              type="button"
              onClick={() => onUpdate({ bet_type: betType })}
              className={`
                px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
                ${
                  data.bet_type === betType
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-border/80'
                }
              `}
            >
              {DISPLAY_LABELS[betType] || betType}
            </button>
          ))}
        </div>
        {errors?.bet_type && <p className="text-sm text-red-600 mt-1">{errors.bet_type}</p>}
      </section>

      {/* Section F: Market Type */}
      <section>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Market Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {MARKET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ market_type: opt.value })}
              className={`
                px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
                ${
                  data.market_type === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:border-border/80'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {errors?.market_type && <p className="text-sm text-red-600 mt-1">{errors.market_type}</p>}
      </section>

      {/* Section G: Units & Confidence (side by side) */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Units */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Units: {unitSize}
            </label>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={unitSize}
              onChange={e => onUpdate({ unit_size: parseFloat(e.target.value) })}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.5</span>
              <span>2.5</span>
              <span>5.0</span>
            </div>
            {errors?.unit_size && <p className="text-sm text-red-600 mt-1">{errors.unit_size}</p>}
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Confidence: {confidence}/10
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onUpdate({ confidence_level: level })}
                  className={`
                    flex-1 h-8 rounded text-xs font-semibold transition-colors
                    ${
                      level <= confidence
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Lock</span>
            </div>
            {errors?.confidence_level && (
              <p className="text-sm text-red-600 mt-1">{errors.confidence_level}</p>
            )}
          </div>
        </div>
      </section>

      {/* Continue Button */}
      <div className="pt-2">
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="w-full py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

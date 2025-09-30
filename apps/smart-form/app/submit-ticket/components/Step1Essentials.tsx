'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
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
import { SPORTS, TICKET_TYPES, Sport, TicketType, UserTier, Capper } from '../types';
import { fetchCappers, fetchGames } from '@/lib/api-client';

interface Step1EssentialsProps {
  data: {
    capper?: string;
    ticket_type?: TicketType;
    sport?: Sport;
    game_date?: string;
    user_tier?: UserTier;
  };
  onUpdate: (updates: any) => void;
  onNext: () => void;
  errors?: any;
}

// Sport configuration with OFFICIAL professional sports logos from reliable GitHub CDN
const SPORT_CONFIG = {
  NBA: {
    logo: (
      <img
        src="https://cdn.jsdelivr.net/gh/alexanderthebadatcoding/Sports-Logos@main/NBA/NBA.png"
        alt="NBA Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Keep the original if it fails
          e.currentTarget.style.display = 'none';
        }}
      />
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'NBA Basketball',
    textColor: 'text-blue-700',
  },
  WNBA: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/WNBA-Logo.png"
        alt="WNBA Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to simpler logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/WNBA-Logo.png";
        }}
      />
    ),
    color: 'border-orange-400 hover:border-orange-500 hover:shadow-lg',
    name: 'WNBA Basketball',
    textColor: 'text-orange-700',
  },
  NFL: {
    logo: (
      <img
        src="https://cdn.jsdelivr.net/gh/alexanderthebadatcoding/Sports-Logos@main/NFL/NFL.png"
        alt="NFL Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Keep the original if it fails
          e.currentTarget.style.display = 'none';
        }}
      />
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'NFL Football',
    textColor: 'text-blue-700',
  },
  MLB: {
    logo: (
      <img
        src="https://cdn.jsdelivr.net/gh/alexanderthebadatcoding/Sports-Logos@main/MLB/MLB.png"
        alt="MLB Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Keep the original if it fails
          e.currentTarget.style.display = 'none';
        }}
      />
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'MLB Baseball',
    textColor: 'text-blue-700',
  },
  NHL: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/NHL-Logo.png"
        alt="NHL Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to alternate NHL logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/NHL-Logo.png";
        }}
      />
    ),
    color: 'border-orange-400 hover:border-orange-500 hover:shadow-lg',
    name: 'NHL Hockey',
    textColor: 'text-orange-700',
  },
  NCAAB: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/NCAA-Logo.png"
        alt="NCAA Basketball Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to reliable NCAA logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/NCAA-Logo.png";
        }}
      />
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'College Basketball',
    textColor: 'text-blue-700',
  },
  NCAAF: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/NCAA-Logo.png"
        alt="NCAA Football Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to reliable NCAA logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/NCAA-Logo.png";
        }}
      />
    ),
    color: 'border-orange-400 hover:border-orange-500 hover:shadow-lg',
    name: 'College Football',
    textColor: 'text-orange-700',
  },
  'UFC/MMA': {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/UFC-Logo.png"
        alt="UFC Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to alternate UFC logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/UFC-Logo.png";
        }}
      />
    ),
    color: 'border-yellow-400 hover:border-yellow-500 hover:shadow-lg',
    name: 'UFC/MMA',
    textColor: 'text-yellow-600',
  },
  Boxing: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/WBC-Logo.png"
        alt="WBC Boxing Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to general boxing logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/WBC-Logo.png";
        }}
      />
    ),
    color: 'border-yellow-300 hover:border-yellow-400 hover:shadow-md',
    name: 'Boxing',
    textColor: 'text-yellow-700',
  },
  Soccer: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/FIFA-Logo.png"
        alt="FIFA Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to reliable FIFA logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/FIFA-Logo.png";
        }}
      />
    ),
    color: 'border-blue-300 hover:border-blue-400 hover:shadow-md',
    name: 'Soccer',
    textColor: 'text-blue-600',
  },
  Tennis: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/ATP-Logo.png"
        alt="ATP Tennis Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to WTA logo
          e.currentTarget.src = "https://logos-world.net/wp-content/uploads/2020/06/WTA-Logo.png";
        }}
      />
    ),
    color: 'border-green-300 hover:border-green-400 hover:shadow-md',
    name: 'Tennis',
    textColor: 'text-green-600',
  },
  Golf: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/PGA-Tour-Logo.png"
        alt="PGA Tour Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to general PGA logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/PGA-Logo.png";
        }}
      />
    ),
    color: 'border-green-300 hover:border-green-400 hover:shadow-md',
    name: 'Golf',
    textColor: 'text-green-700',
  },
  NASCAR: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/NASCAR-Logo.png"
        alt="NASCAR Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to reliable NASCAR logo
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/NASCAR-Logo.png";
        }}
      />
    ),
    color: 'border-yellow-300 hover:border-yellow-400 hover:shadow-md',
    name: 'NASCAR',
    textColor: 'text-yellow-700',
  },
  F1: {
    logo: (
      <img
        src="https://logos-world.net/wp-content/uploads/2020/06/Formula-1-Logo.png"
        alt="Formula 1 Official Logo"
        className="w-12 h-12 object-contain"
        onError={(e) => {
          e.currentTarget.src = "https://1000logos.net/wp-content/uploads/2017/05/Formula-1-Logo.png";
        }}
      />
    ),
    color: 'border-red-300 hover:border-red-400 hover:shadow-md',
    name: 'Formula 1',
    textColor: 'text-red-700',
  },
} as const;

export function Step1Essentials({ data, onUpdate, onNext, errors }: Step1EssentialsProps) {
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [isLoadingCappers, setIsLoadingCappers] = useState(true);
  const [availableGames, setAvailableGames] = useState(0);

  // Set defaults immediately if not set
  useEffect(() => {
    // Set defaults for production readiness
    const updates: any = {};
    if (!data.sport) {
      updates.sport = 'MLB';
    }
    if (!data.game_date) {
      // Set default to today in local timezone YYYY-MM-DD format
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      updates.game_date = `${year}-${month}-${day}`;
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
  }, []); // Run immediately on mount

  // Fetch cappers on mount
  useEffect(() => {
    const loadCappers = async () => {
      try {
        setIsLoadingCappers(true);
        const cappersData = await fetchCappers();

        // Production: Use real data from database without mock stats
        setCappers(cappersData);
      } catch (error) {
        console.error('Error loading cappers:', error);
        // Production: Show empty state when database is unavailable
        setCappers([]);
      } finally {
        setIsLoadingCappers(false);
      }
    };

    loadCappers();
  }, []);

  // Fetch real available games count based on sport and date
  useEffect(() => {
    const loadAvailableGames = async () => {
      if (data.sport && data.game_date) {
        try {
          console.log('🎯 Step1: Loading games for sport:', data.sport, 'date:', data.game_date);
          const games = await fetchGames(data.sport, data.game_date, data.game_date);
          console.log('🎯 Step1: Received games count:', games?.length || 0);
          setAvailableGames(games?.length || 0);
        } catch (error) {
          console.error('Error fetching games:', error);
          setAvailableGames(0);
        }
      }
    };

    loadAvailableGames();
  }, [data.sport, data.game_date]);

  const handleCapperSelect = (capperId: string) => {
    const selectedCapper = cappers.find(c => c.id === capperId);
    onUpdate({ capper: selectedCapper?.name || capperId });
  };

  const handleTicketTypeSelect = (type: TicketType) => {
    onUpdate({ ticket_type: type });
  };

  const handleSportSelect = (sport: Sport) => {
    onUpdate({ sport });
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      onUpdate({ game_date: date.toISOString().split('T')[0] });
    }
  };

  // Enhanced validation logic to handle state sync issues
  const isValid = data.capper && data.ticket_type && data.sport && data.game_date;

  // Debug: Log current data state for troubleshooting
  console.log('🐛 Step1 Validation Debug:', {
    capper: data.capper,
    ticket_type: data.ticket_type,
    sport: data.sport,
    game_date: data.game_date,
    isValid,
    timestamp: new Date().toISOString(),
  });

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/25">
          <span className="text-2xl">🎯</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
          Ticket Essentials
        </h2>
        <p className="text-gray-600 text-lg font-medium max-w-lg mx-auto leading-relaxed">
          Let's start with the fundamentals for your premium betting experience
        </p>
      </div>

      {/* Premium Capper Selection */}
      <Card className="p-8 bg-gradient-to-br from-white to-blue-50/30 border-0 ring-1 ring-gray-200/50 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white text-lg">👤</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">Select Your Capper</h3>
              <p className="text-sm text-gray-600 font-medium">
                Choose your trusted betting expert
              </p>
            </div>
            {isLoadingCappers && (
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent" />
            )}
          </div>

          <Select
            value={cappers.find(c => c.name === data.capper)?.id || ''}
            onValueChange={handleCapperSelect}
            disabled={isLoadingCappers}
          >
            <SelectTrigger className="bg-white">
              <SelectValue
                placeholder={isLoadingCappers ? 'Loading cappers...' : 'Choose your capper'}
              />
            </SelectTrigger>
            <SelectContent>
              {cappers.map(capper => (
                <SelectItem key={capper.id} value={capper.id}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{capper.name}</span>
                      {capper.stats?.isLive && (
                        <Badge className="bg-green-500 text-white text-xs">LIVE</Badge>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Capper Stats */}
          {data.capper && cappers.find(c => c.name === data.capper)?.stats && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="text-sm text-blue-900 font-medium">
                💡 <strong>{data.capper}</strong>:{' '}
                {cappers.find(c => c.name === data.capper)?.stats?.winRate}% Win Rate • +
                {cappers.find(c => c.name === data.capper)?.stats?.roi}% ROI
                <br />
                Last pick: {cappers.find(c => c.name === data.capper)?.stats?.lastPick}
              </div>
            </div>
          )}

          {errors?.capper && <p className="text-sm text-red-600">{errors.capper}</p>}
        </div>
      </Card>

      {/* Premium Ticket Type & Sport */}
      <Card className="p-8 bg-gradient-to-br from-white to-green-50/30 border-0 ring-1 ring-gray-200/50 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
        <div className="space-y-8">
          {/* Premium Ticket Type */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <span className="text-white text-lg">🎯</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Ticket Type</h3>
                <p className="text-sm text-gray-600 font-medium">Choose your betting strategy</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TICKET_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => handleTicketTypeSelect(type)}
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-200 text-center
                    ${
                      data.ticket_type === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <div className="font-semibold capitalize text-gray-900">{type}</div>
                  <div className="text-xs text-gray-700 mt-1 font-medium">
                    {type === 'single'
                      ? 'One pick'
                      : type === 'parlay'
                        ? 'Multiple picks'
                        : type === 'teaser'
                          ? 'Adjusted lines'
                          : 'Multiple parlays'}
                  </div>
                </button>
              ))}
            </div>
            {errors?.ticket_type && <p className="text-sm text-red-600">{errors.ticket_type}</p>}
          </div>

          {/* Premium Sport Selection */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                <span className="text-white text-lg">🏀</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Sport Selection</h3>
                <p className="text-sm text-gray-600 font-medium">Pick your favorite sport</p>
              </div>
            </div>
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-4">
              {SPORTS.map(sport => {
                const config = SPORT_CONFIG[sport as keyof typeof SPORT_CONFIG];
                return (
                  <button
                    key={sport}
                    onClick={() => handleSportSelect(sport)}
                    title={`${sport} - ${config?.name || sport}`}
                    className={`
                      w-16 h-16 rounded-xl border-2 transition-all duration-200 hover:scale-110 hover:shadow-lg
                      flex items-center justify-center bg-white
                      ${
                        data.sport === sport
                          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/25 scale-105'
                          : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {config?.logo || (
                      <div className="bg-gray-100 p-2 rounded-full">
                        <div className="w-8 h-8 text-gray-600 flex items-center justify-center">🏆</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {errors?.sport && <p className="text-sm text-red-600">{errors.sport}</p>}
          </div>
        </div>
      </Card>

      {/* Premium Date & Tier */}
      <Card className="p-8 bg-gradient-to-br from-white to-purple-50/30 border-0 ring-1 ring-gray-200/50 shadow-xl rounded-2xl hover:shadow-2xl transition-all duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Premium Game Date */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <span className="text-white text-lg">📅</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Game Date</h3>
                <p className="text-sm text-gray-600 font-medium">Select your betting date</p>
              </div>
            </div>
            <div className="relative">
              <DatePicker
                selected={data.game_date ? new Date(data.game_date + 'T00:00:00') : new Date()}
                onChange={handleDateChange}
                className="w-full h-12 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                dateFormat="MMMM d, yyyy"
                placeholderText="Select game date"
              />
              <Calendar className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
            {data.sport && data.game_date && (
              <div className="text-sm text-green-700 font-semibold bg-green-50 border border-green-200 p-2 rounded">
                🎯 {availableGames} {data.sport} games available on {data.game_date}
                {/* Show LIVE indicator for current date games */}
                {data.game_date === new Date().toISOString().split('T')[0] && (
                  <span className="ml-2 text-red-600 font-bold animate-pulse">🔴 LIVE</span>
                )}
                {/* Show past date indicator */}
                {new Date(data.game_date) < new Date(new Date().toISOString().split('T')[0]) && (
                  <span className="ml-2 text-orange-600 font-medium">📅 Past Games</span>
                )}
              </div>
            )}
            {errors?.game_date && <p className="text-sm text-red-600">{errors.game_date}</p>}
          </div>

          {/* Premium User Tier */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/25">
                <span className="text-white text-lg">👑</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">User Tier</h3>
                <p className="text-sm text-gray-600 font-medium">Your membership level</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/25">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-lg font-bold backdrop-blur-sm">
                  VIP+ 🔥
                </Badge>
                <div className="text-right">
                  <div className="text-xs opacity-75">Status</div>
                  <div className="font-bold">Active</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎁</span>
                  <span>Premium features unlocked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <span>Advanced analytics dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <span>Priority customer support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Premium Continue Button */}
      <div className="flex justify-center">
        <div className="relative group">
          <Button
            onClick={onNext}
            disabled={!isValid}
            className={`
              px-12 py-4 text-xl font-bold rounded-2xl shadow-2xl border-0 transition-all duration-300 transform
              ${
                isValid
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white hover:scale-105 hover:-translate-y-1 shadow-blue-500/25'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isValid ? (
              <div className="flex items-center gap-3">
                <span>Continue to Next Step</span>
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-sm">→</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span>Complete Required Fields</span>
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-sm">!</span>
                </div>
              </div>
            )}
          </Button>

          {/* Glow Effect for Valid State */}
          {isValid && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl opacity-20 animate-pulse -z-10 blur-xl" />
          )}
        </div>
      </div>
    </div>
  );
}

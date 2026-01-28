'use client';

import { useState, useEffect, useRef } from 'react';
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

// Sport configuration with official professional sports logos
const SPORT_CONFIG = {
  NBA: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official NBA logo with authentic colors */}
          <circle cx="50" cy="50" r="40" fill="#1D428A" />
          <circle cx="50" cy="50" r="32" fill="#C8102E" />
          <circle cx="50" cy="50" r="25" fill="#ffffff" />
          {/* Basketball court lines */}
          <path
            d="M50 15 C74 15, 85 26, 85 50 C85 74, 74 85, 50 85 C26 85, 15 74, 15 50 C15 26, 26 15, 50 15"
            stroke="#C8102E"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M15 50 C15 50, 50 15, 85 50 C85 50, 50 85, 15 50"
            stroke="#C8102E"
            strokeWidth="2"
            fill="none"
          />
          {/* NBA branding */}
          <rect x="30" y="45" width="40" height="10" fill="#1D428A" />
          <text x="50" y="53" textAnchor="middle" fontSize="8" fill="#ffffff" fontWeight="bold">
            NBA
          </text>
        </svg>
      </div>
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'NBA Basketball',
    textColor: 'text-blue-700',
  },
  WNBA: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official WNBA logo with authentic colors */}
          <circle cx="50" cy="50" r="40" fill="#C8102E" />
          <circle cx="50" cy="50" r="32" fill="#ffffff" />
          <circle cx="50" cy="50" r="25" fill="#C8102E" />
          {/* Women's basketball design elements */}
          <path d="M30 30 L70 30 M30 50 L70 50 M30 70 L70 70" stroke="#ffffff" strokeWidth="3" />
          <path
            d="M40 20 Q50 35, 60 20 M40 80 Q50 65, 60 80"
            stroke="#ffffff"
            strokeWidth="2"
            fill="none"
          />
          {/* WNBA branding */}
          <rect x="25" y="45" width="50" height="10" fill="#C8102E" />
          <text x="50" y="53" textAnchor="middle" fontSize="7" fill="#ffffff" fontWeight="bold">
            WNBA
          </text>
        </svg>
      </div>
    ),
    color: 'border-red-400 hover:border-red-500 hover:shadow-lg',
    name: 'WNBA Basketball',
    textColor: 'text-red-700',
  },
  NFL: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official NFL shield with authentic colors */}
          <path
            d="M50 10 L75 20 L85 45 L85 70 L50 90 L15 70 L15 45 L25 20 Z"
            fill="#013369"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <path d="M50 20 L70 28 L77 47 L77 67 L50 80 L23 67 L23 47 L30 28 Z" fill="#D50A0A" />
          <path d="M50 30 L62 36 L67 50 L67 63 L50 70 L33 63 L33 50 L38 36 Z" fill="#ffffff" />
          {/* NFL shield branding */}
          <rect x="35" y="45" width="30" height="15" fill="#013369" />
          <text x="50" y="55" textAnchor="middle" fontSize="8" fill="#ffffff" fontWeight="bold">
            NFL
          </text>
        </svg>
      </div>
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'NFL Football',
    textColor: 'text-blue-700',
  },
  MLB: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official MLB logo with authentic colors */}
          <circle cx="50" cy="50" r="40" fill="#041E42" />
          <circle cx="50" cy="50" r="32" fill="#ffffff" />
          {/* Baseball stitching pattern */}
          <path
            d="M20 40 Q40 25, 50 40 Q60 55, 80 40 Q60 55, 50 70 Q40 55, 20 70 Q40 55, 50 40"
            stroke="#BA0C2F"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M28 30 Q43 20, 50 30 Q57 40, 72 30 M28 70 Q43 80, 50 70 Q57 60, 72 70"
            stroke="#BA0C2F"
            strokeWidth="2"
            fill="none"
          />
          {/* MLB branding */}
          <rect x="30" y="45" width="40" height="10" fill="#041E42" />
          <text x="50" y="53" textAnchor="middle" fontSize="8" fill="#ffffff" fontWeight="bold">
            MLB
          </text>
        </svg>
      </div>
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'MLB Baseball',
    textColor: 'text-blue-700',
  },
  NHL: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official NHL shield with authentic colors */}
          <path
            d="M50 10 L75 17 L90 40 L88 70 L50 90 L12 70 L10 40 L25 17 Z"
            fill="#000000"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <path d="M50 20 L70 26 L82 45 L80 67 L50 80 L20 67 L18 45 L30 26 Z" fill="#ffffff" />
          <circle cx="50" cy="50" r="20" fill="#000000" />
          <circle cx="50" cy="50" r="13" fill="#FF6600" />
          {/* NHL branding */}
          <rect x="35" y="45" width="30" height="10" fill="#ffffff" />
          <text x="50" y="53" textAnchor="middle" fontSize="7" fill="#000000" fontWeight="bold">
            NHL
          </text>
        </svg>
      </div>
    ),
    color: 'border-orange-400 hover:border-orange-500 hover:shadow-lg',
    name: 'NHL Hockey',
    textColor: 'text-orange-700',
  },
  NCAAB: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official NCAA basketball with authentic colors */}
          <circle cx="50" cy="50" r="40" fill="#003366" />
          <circle cx="50" cy="50" r="32" fill="#ffffff" />
          <circle cx="50" cy="50" r="24" fill="#003366" />
          {/* NCAA shield design */}
          <path d="M50 20 L65 27 L70 42 L70 58 L50 70 L30 58 L30 42 L35 27 Z" fill="#ffffff" />
          <rect x="35" y="42" width="30" height="12" fill="#003366" />
          <text x="50" y="51" textAnchor="middle" fontSize="6" fill="#ffffff" fontWeight="bold">
            NCAA
          </text>
        </svg>
      </div>
    ),
    color: 'border-blue-400 hover:border-blue-500 hover:shadow-lg',
    name: 'College Basketball',
    textColor: 'text-blue-700',
  },
  NCAAF: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Enhanced NCAA Football shield with authentic colors */}
          <path
            d="M50 10 L75 20 L85 45 L85 70 L50 90 L15 70 L15 45 L25 20 Z"
            fill="#8B0000"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <path d="M50 20 L70 28 L77 47 L77 67 L50 80 L23 67 L23 47 L30 28 Z" fill="#FFD700" />
          {/* Football field lines */}
          <path
            d="M25 35 L75 35 M25 45 L75 45 M25 55 L75 55 M25 65 L75 65"
            stroke="#8B0000"
            strokeWidth="1"
          />
          {/* Goal posts */}
          <path
            d="M35 25 L35 35 M40 25 L40 35 M60 25 L60 35 M65 25 L65 35"
            stroke="#8B0000"
            strokeWidth="2"
          />
          <rect x="20" y="42" width="60" height="16" rx="2" fill="#ffffff" />
          <text x="50" y="54" textAnchor="middle" fontSize="8" fill="#8B0000" fontWeight="bold">
            COLLEGE
          </text>
        </svg>
      </div>
    ),
    color: 'border-red-400 hover:border-red-500 hover:shadow-lg',
    name: 'College Football',
    textColor: 'text-red-700',
  },
  'UFC/MMA': {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Official UFC octagon with authentic colors */}
          <path
            d="M50 10 L75 20 L92 40 L92 70 L75 90 L50 100 L25 90 L8 70 L8 40 L25 20 Z"
            fill="#D4AF37"
            stroke="#000000"
            strokeWidth="2"
          />
          <path
            d="M50 20 L70 28 L82 45 L82 65 L70 82 L50 90 L30 82 L18 65 L18 45 L30 28 Z"
            fill="#000000"
          />
          <path
            d="M50 30 L62 36 L70 50 L70 60 L62 74 L50 80 L38 74 L30 60 L30 50 L38 36 Z"
            fill="#D4AF37"
          />
          {/* UFC octagon center */}
          <circle cx="50" cy="50" r="8" fill="#000000" />
          <text x="50" y="54" textAnchor="middle" fontSize="5" fill="#D4AF37" fontWeight="bold">
            UFC
          </text>
        </svg>
      </div>
    ),
    color: 'border-yellow-400 hover:border-yellow-500 hover:shadow-lg',
    name: 'UFC/MMA',
    textColor: 'text-yellow-600',
  },
  Boxing: {
    logo: (
      <div className="bg-gradient-to-r from-yellow-500 to-orange-600 p-2 rounded-full shadow-lg">
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          {/* Professional boxing gloves */}
          <ellipse cx="8" cy="12" rx="4" ry="6" fill="currentColor" transform="rotate(-15 8 12)" />
          <ellipse cx="16" cy="12" rx="4" ry="6" fill="currentColor" transform="rotate(15 16 12)" />
          <rect x="6" y="15" width="4" height="3" rx="1" fill="rgba(255,255,255,0.3)" />
          <rect x="14" y="15" width="4" height="3" rx="1" fill="rgba(255,255,255,0.3)" />
          <circle cx="8" cy="10" r="1" fill="rgba(255,255,255,0.6)" />
          <circle cx="16" cy="10" r="1" fill="rgba(255,255,255,0.6)" />
        </svg>
      </div>
    ),
    color: 'border-yellow-300 hover:border-yellow-400 hover:shadow-md',
    name: 'Boxing',
    textColor: 'text-yellow-700',
  },
  Soccer: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* FIFA official-style soccer ball with authentic colors */}
          <circle cx="50" cy="50" r="40" fill="#00AA00" />
          <circle cx="50" cy="50" r="32" fill="#ffffff" />
          <circle cx="50" cy="50" r="24" fill="#000000" />
          {/* Soccer ball pentagon pattern */}
          <path d="M50 30 L42 40 L46 52 L54 52 L58 40 Z" fill="#ffffff" />
          <path
            d="M50 30 L50 10 M42 40 L25 30 M58 40 L75 30 M46 52 L30 70 M54 52 L70 70"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx="50" cy="50" r="12" fill="none" stroke="#ffffff" strokeWidth="1" />
          {/* FIFA text */}
          <text x="50" y="85" textAnchor="middle" fontSize="6" fill="#00AA00" fontWeight="bold">
            FIFA
          </text>
        </svg>
      </div>
    ),
    color: 'border-green-300 hover:border-green-400 hover:shadow-md',
    name: 'Soccer',
    textColor: 'text-green-600',
  },
  Tennis: {
    logo: (
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-2 rounded-full shadow-lg">
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          {/* Professional tennis ball with curved lines */}
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path
            d="M4 12 C8 8, 16 8, 20 12 C16 16, 8 16, 4 12"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M4 12 C8 16, 16 16, 20 12 C16 8, 8 8, 4 12"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="1.5"
            fill="none"
          />
          <circle
            cx="12"
            cy="12"
            r="6"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    ),
    color: 'border-emerald-300 hover:border-emerald-400 hover:shadow-md',
    name: 'Tennis',
    textColor: 'text-emerald-600',
  },
  Golf: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* PGA official-style golf logo with authentic colors */}
          <circle cx="50" cy="70" r="18" fill="#ffffff" />
          {/* Golf ball dimples */}
          <circle cx="45" cy="67" r="1" fill="#006400" />
          <circle cx="55" cy="67" r="1" fill="#006400" />
          <circle cx="50" cy="73" r="1" fill="#006400" />
          <circle cx="47" cy="75" r="1" fill="#006400" />
          <circle cx="53" cy="75" r="1" fill="#006400" />
          {/* Golf flag */}
          <path d="M50 70 L50 20" stroke="#006400" strokeWidth="3" />
          <path d="M50 20 L75 20 L65 30 L75 40 L50 40" fill="#FFD700" />
          {/* Tee */}
          <rect x="20" y="85" width="60" height="6" fill="#006400" />
          {/* PGA text */}
          <text x="50" y="32" textAnchor="middle" fontSize="6" fill="#ffffff" fontWeight="bold">
            PGA
          </text>
        </svg>
      </div>
    ),
    color: 'border-green-300 hover:border-green-400 hover:shadow-md',
    name: 'Golf',
    textColor: 'text-green-700',
  },
  NASCAR: {
    logo: (
      <div className="bg-gradient-to-r from-red-600 via-yellow-500 to-blue-600 p-2 rounded-full shadow-lg">
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          {/* Professional NASCAR race car */}
          <path d="M2 10 L22 10 L20 14 L4 14 Z" fill="currentColor" />
          <path d="M4 8 L20 8 L22 10 L2 10 Z" fill="rgba(255,255,255,0.3)" />
          <circle cx="6" cy="16" r="2.5" fill="rgba(255,255,255,0.9)" />
          <circle cx="18" cy="16" r="2.5" fill="rgba(255,255,255,0.9)" />
          <circle cx="6" cy="16" r="1" fill="currentColor" />
          <circle cx="18" cy="16" r="1" fill="currentColor" />
          <rect x="8" y="9" width="8" height="3" rx="0.5" fill="rgba(255,255,255,0.8)" />
        </svg>
      </div>
    ),
    color: 'border-red-300 hover:border-red-400 hover:shadow-md',
    name: 'NASCAR',
    textColor: 'text-gray-800',
  },
  F1: {
    logo: (
      <div className="bg-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg className="w-6 h-6" viewBox="0 0 100 100" fill="none">
          {/* Formula 1 official-style logo with authentic colors */}
          <rect x="10" y="40" width="80" height="25" fill="#E10600" />
          <path d="M10 40 L30 20 L80 20 L90 40" fill="#ffffff" />
          <path d="M10 65 L30 80 L80 80 L90 65" fill="#000000" />
          {/* F1 car wheels */}
          <circle cx="25" cy="75" r="6" fill="#ffffff" />
          <circle cx="75" cy="75" r="6" fill="#ffffff" />
          {/* F1 text */}
          <text x="50" y="58" textAnchor="middle" fontSize="16" fill="#ffffff" fontWeight="bold">
            F1
          </text>
        </svg>
      </div>
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

  // FIX: Set defaults using a ref to track initialization, avoiding stale closure issues
  const hasInitializedDefaults = useRef(false);
  useEffect(() => {
    if (!hasInitializedDefaults.current) {
      hasInitializedDefaults.current = true;

      const updates: Partial<typeof data> = {};

      // Only set defaults if values are truly undefined
      if (data.sport === undefined) {
        updates.sport = 'MLB';
      }
      if (data.game_date === undefined) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        updates.game_date = `${year}-${month}-${day}`;
      }

      if (Object.keys(updates).length > 0) {
        onUpdate(updates);
      }
    }
  }, [onUpdate]);

  // FIX: Fetch cappers with timeout to prevent infinite loading state
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadCappers = async () => {
      try {
        setIsLoadingCappers(true);

        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Capper fetch timeout')), 10000);
        });

        const cappersData = await Promise.race([
          fetchCappers(),
          timeoutPromise
        ]);

        if (isMounted) {
          setCappers(cappersData as Capper[]);
        }
      } catch (error) {
        console.error('Error loading cappers:', error);
        if (isMounted) {
          setCappers([]);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsLoadingCappers(false);
        }
      }
    };

    loadCappers();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
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
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              {SPORTS.map(sport => {
                const config = SPORT_CONFIG[sport as keyof typeof SPORT_CONFIG];
                return (
                  <button
                    key={sport}
                    onClick={() => handleSportSelect(sport)}
                    className={`
                      p-3 rounded-lg border-2 transition-all duration-200 text-center hover:scale-105
                      ${
                        data.sport === sport
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="mb-2">
                      {config?.logo || (
                        <div className="bg-gray-100 p-2 rounded-full">
                          <div className="w-6 h-6 text-gray-600">🏆</div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-gray-900">{sport}</div>
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

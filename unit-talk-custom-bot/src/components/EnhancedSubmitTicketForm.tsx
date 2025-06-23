import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { AlertCircle, Clock, User, Tag, FileText, Send, Plus, X } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

import { useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  EnhancedTicketFormData,
  EnhancedTicketLeg,
  enhancedTicketFormSchema,
  Sport,
  BetType,
  SportConfig,
  PlayerSearchResult,
  GameSearchResult,
  ValidationError,
  SubmissionResult
} from "../types";

// Enhanced sport configurations with dynamic field requirements
const ENHANCED_SPORT_CONFIGS: Record<Sport, SportConfig> = {
  NFL: {
    name: 'NFL',
    logo: '🏈',
    color: '#013369',
    betTypes: ['Spread', 'Moneyline', 'Total', 'Player Props', 'Team Props', 'Touchdown Props', 'Quarter Props'],
    playerProps: ['Passing Yards', 'Rushing Yards', 'Receiving Yards', 'Touchdowns', 'Receptions', 'Completions'],
    teamProps: ['Total Points', 'First Half Points', 'Turnovers', 'Penalties'],
    dynamicFields: {
      'Touchdown Props': ['player', 'touchdown_type', 'anytime_td', 'first_td', 'last_td'],
      'Player Props': ['player', 'stat_type', 'line', 'over_under', 'game_context'],
      'Team Props': ['team', 'stat_type', 'line', 'over_under', 'half_context']
    },
    validation: {
      minOdds: -10000,
      maxOdds: 10000,
      maxParlay: 12,
      requiredFields: ['team', 'opponent', 'line', 'odds']
    },
    imageAssets: {
      logoPath: '/assets/logos/nfl/',
      playerPath: '/assets/players/nfl/',
      teamPath: '/assets/teams/nfl/'
    }
  },
  NBA: {
    name: 'NBA',
    logo: '🏀',
    color: '#C8102E',
    betTypes: ['Spread', 'Moneyline', 'Total', 'Player Props', 'Team Props', 'Quarter Props'],
    playerProps: ['Points', 'Rebounds', 'Assists', 'Steals', 'Blocks', 'Three-Pointers', 'Minutes'],
    teamProps: ['Total Points', 'First Half Points', 'Three-Pointers Made', 'Rebounds'],
    dynamicFields: {
      'Player Props': ['player', 'stat_type', 'line', 'over_under', 'game_context'],
      'Team Props': ['team', 'stat_type', 'line', 'over_under', 'quarter_context']
    },
    validation: {
      minOdds: -5000,
      maxOdds: 5000,
      maxParlay: 10,
      requiredFields: ['team', 'opponent', 'line', 'odds']
    },
    imageAssets: {
      logoPath: '/assets/logos/nba/',
      playerPath: '/assets/players/nba/',
      teamPath: '/assets/teams/nba/'
    }
  },
  MLB: {
    name: 'MLB',
    logo: '⚾',
    color: '#041E42',
    betTypes: ['Moneyline', 'Run Line', 'Total', 'Player Props', 'Team Props', 'Inning Props'],
    playerProps: ['Hits', 'RBIs', 'Home Runs', 'Strikeouts', 'Walks', 'Stolen Bases'],
    teamProps: ['Total Runs', 'First 5 Innings', 'Hits', 'Errors'],
    dynamicFields: {
      'Player Props': ['player', 'stat_type', 'line', 'over_under', 'inning_context'],
      'Team Props': ['team', 'stat_type', 'line', 'over_under', 'inning_context']
    },
    validation: {
      minOdds: -2000,
      maxOdds: 2000,
      maxParlay: 8,
      requiredFields: ['team', 'opponent', 'line', 'odds']
    },
    imageAssets: {
      logoPath: '/assets/logos/mlb/',
      playerPath: '/assets/players/mlb/',
      teamPath: '/assets/teams/mlb/'
    }
  }
};

interface EnhancedSubmitTicketFormProps {
  userTier: 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin';
  userId: string;
  onSubmissionSuccess?: (result: SubmissionResult) => void;
  onSubmissionError?: (error: ValidationError[]) => void;
}

export function EnhancedSubmitTicketForm({ 
  userTier, 
  userId, 
  onSubmissionSuccess, 
  onSubmissionError 
}: EnhancedSubmitTicketFormProps) {
  const [searchResults, setSearchResults] = useState<Record<number, { players: PlayerSearchResult[], games: GameSearchResult[] }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [edgeScores, setEdgeScores] = useState<Record<number, number>>({});
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const form = useForm<EnhancedTicketFormData>({
    resolver: zodResolver(enhancedTicketFormSchema),
    defaultValues: {
      capper: 'Unit Talk Pro',
      ticket_type: "Single",
      unit_size: 1,
      auto_parlay: true,
      sport: "NFL",
      game_date: dayjs().format("YYYY-MM-DD"),
      confidence_level: 5,
      user_tier: userTier,
      legs: [createEnhancedLeg(true)]
    },
    mode: 'onChange'
  });

  const { fields: legs, append, remove, update } = useFieldArray({
    control: form.control,
    name: "legs"
  });

  const watchedSport = form.watch("sport");
  const watchedTicketType = form.watch("ticket_type");
  const watchedLegs = form.watch("legs");

  // Memoized sport configuration
  const currentSportConfig = useMemo(() => 
    ENHANCED_SPORT_CONFIGS[watchedSport], 
    [watchedSport]
  );

  // Dynamic field visibility based on sport and bet type
  const getVisibleFields = useCallback((legIndex: number, betType: BetType) => {
    const config = currentSportConfig;
    const dynamicFields = config.dynamicFields[betType] || [];
    
    return {
      showPlayer: dynamicFields.includes('player'),
      showStatType: dynamicFields.includes('stat_type'),
      showLine: dynamicFields.includes('line'),
      showOverUnder: dynamicFields.includes('over_under'),
      showGameContext: dynamicFields.includes('game_context'),
      showTouchdownType: dynamicFields.includes('touchdown_type'),
      showAnytimeTD: dynamicFields.includes('anytime_td'),
      showFirstTD: dynamicFields.includes('first_td'),
      showLastTD: dynamicFields.includes('last_td'),
      showHalfContext: dynamicFields.includes('half_context'),
      showQuarterContext: dynamicFields.includes('quarter_context'),
      showInningContext: dynamicFields.includes('inning_context')
    };
  }, [currentSportConfig]);

  function createEnhancedLeg(isPrimary = false): EnhancedTicketLeg {
    return {
      id: uuidv4(),
      bet_type: "Player Props",
      stat_type: "",
      player_name: "",
      player_image: "",
      team: "",
      team_logo: "",
      opponent: "",
      opponent_logo: "",
      line: "",
      odds: "",
      outcome: "",
      matchup: "",
      game_context: "",
      confidence: 5,
      edge_score: 0,
      ai_analysis: null,
      is_primary: isPrimary,
      validation_status: 'pending',
      created_at: new Date().toISOString(),
      // Enhanced fields
      touchdown_type: "",
      anytime_td: false,
      first_td: false,
      last_td: false,
      over_under: "Over",
      half_context: "",
      quarter_context: "",
      inning_context: "",
      market_data: null,
      injury_alerts: [],
      weather_impact: null
    };
  }

  // Enhanced search with autocomplete and image loading
  const handleEnhancedSearch = useCallback(async (legIndex: number, query: string, searchType: 'player' | 'game') => {
    if (!query || query.length < 2) {
      setSearchResults(prev => ({ ...prev, [legIndex]: { players: [], games: [] } }));
      return;
    }

    setIsLoadingAssets(true);

    try {
      if (searchType === 'player') {
        const { data: players } = await supabase
          .from("enhanced_players")
          .select(`
            *,
            team_info:teams(name, logo_url, primary_color),
            season_stats(*),
            injury_status(*)
          `)
          .ilike("player_name", `%${query}%`)
          .eq("sport", watchedSport)
          .eq("active", true)
          .limit(10);

        const enhancedPlayers: PlayerSearchResult[] = (players || []).map(player => ({
          ...player,
          image_url: `${currentSportConfig.imageAssets.playerPath}${player.player_id}.jpg`,
          team_logo: player.team_info?.logo_url,
          recent_performance: player.season_stats?.[0] || null,
          injury_status: player.injury_status?.[0] || null
        }));

        setSearchResults(prev => ({
          ...prev,
          [legIndex]: { ...prev[legIndex], players: enhancedPlayers, games: prev[legIndex]?.games || [] }
        }));
      } else {
        const { data: games } = await supabase
          .from("enhanced_games")
          .select(`
            *,
            home_team_info:teams!home_team_id(name, logo_url, primary_color),
            away_team_info:teams!away_team_id(name, logo_url, primary_color),
            weather_data(*),
            betting_lines(*)
          `)
          .or(`home_team_info.name.ilike.%${query}%,away_team_info.name.ilike.%${query}%,matchup.ilike.%${query}%`)
          .eq("sport", watchedSport)
          .gte("game_date", dayjs().format("YYYY-MM-DD"))
          .limit(10);

        const enhancedGames: GameSearchResult[] = (games || []).map(game => ({
          ...game,
          home_logo: game.home_team_info?.logo_url,
          away_logo: game.away_team_info?.logo_url,
          weather: game.weather_data?.[0] || null,
          lines: game.betting_lines || []
        }));

        setSearchResults(prev => ({
          ...prev,
          [legIndex]: { ...prev[legIndex], games: enhancedGames, players: prev[legIndex]?.players || [] }
        }));
      }
    } catch (error) {
      console.error('Enhanced search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsLoadingAssets(false);
    }
  }, [watchedSport, currentSportConfig]);

  // AI-powered pick analysis for VIP+ users
  const analyzePickWithAI = useCallback(async (legIndex: number) => {
    if (userTier !== 'vip_plus') return;

    const leg = watchedLegs[legIndex];
    if (!leg.player_name || !leg.stat_type || !leg.line) return;

    try {
      const { data: analysis } = await supabase.functions.invoke('analyze-pick', {
        body: {
          player: leg.player_name,
          stat_type: leg.stat_type,
          line: leg.line,
          sport: watchedSport,
          game_context: leg.game_context
        }
      });

      if (analysis) {
        const updatedLeg = {
          ...leg,
          ai_analysis: analysis,
          edge_score: analysis.edge_score || 0
        };
        
        update(legIndex, updatedLeg);
        setEdgeScores(prev => ({ ...prev, [legIndex]: analysis.edge_score || 0 }));
        
        if (analysis.edge_score >= 7) {
          toast.success(`🔥 High-edge pick detected! Edge score: ${analysis.edge_score}/10`);
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    }
  }, [userTier, watchedLegs, watchedSport, update]);

  // Enhanced validation with real-time feedback
  const validateLegInRealTime = useCallback(async (legIndex: number) => {
    const leg = watchedLegs[legIndex];
    const config = currentSportConfig;
    const errors: ValidationError[] = [];

    // Required field validation
    config.validation.requiredFields.forEach(field => {
      if (!leg[field as keyof EnhancedTicketLeg]) {
        errors.push({
          field: field,
          message: `${field.replace('_', ' ')} is required`,
          legIndex
        });
      }
    });

    // Odds validation
    const odds = parseFloat(leg.odds);
    if (odds < config.validation.minOdds || odds > config.validation.maxOdds) {
      errors.push({
        field: 'odds',
        message: `Odds must be between ${config.validation.minOdds} and ${config.validation.maxOdds}`,
        legIndex
      });
    }

    // Sport-specific validation
    if (watchedSport === 'NFL' && leg.bet_type === 'Touchdown Props') {
      if (!leg.touchdown_type) {
        errors.push({
          field: 'touchdown_type',
          message: 'Touchdown type is required for TD props',
          legIndex
        });
      }
    }

    // Update leg validation status
    const updatedLeg = {
      ...leg,
      validation_status: errors.length === 0 ? 'valid' : 'invalid'
    };
    
    update(legIndex, updatedLeg);
    
    // Update global validation errors
    setValidationErrors(prev => [
      ...prev.filter(e => e.legIndex !== legIndex),
      ...errors
    ]);

    return errors.length === 0;
  }, [watchedLegs, currentSportConfig, watchedSport, update]);

  // Enhanced player selection with image loading
  const handleSelectPlayer = useCallback(async (legIndex: number, player: PlayerSearchResult) => {
    const leg = watchedLegs[legIndex];
    const updatedLeg = {
      ...leg,
      player_name: player.player_name,
      player_image: player.image_url,
      team: player.team,
      team_logo: player.team_logo,
      odds: player.recent_performance?.suggested_odds || leg.odds,
      injury_alerts: player.injury_status ? [player.injury_status] : []
    };

    update(legIndex, updatedLeg);
    clearSearch(legIndex);

    // Auto-populate stat suggestions for VIP+ users
    if (userTier === 'vip_plus') {
      await analyzePickWithAI(legIndex);
    }

    // Show injury alert if applicable
    if (player.injury_status && player.injury_status.status !== 'healthy') {
      toast.warning(`⚠️ ${player.player_name} has injury status: ${player.injury_status.status}`);
    }
  }, [watchedLegs, update, userTier, analyzePickWithAI]);

  // Enhanced game selection with weather and line data
  const handleSelectGame = useCallback((legIndex: number, game: GameSearchResult) => {
    const leg = watchedLegs[legIndex];
    const updatedLeg = {
      ...leg,
      matchup: game.matchup || `${game.away_team} @ ${game.home_team}`,
      team: game.home_team,
      team_logo: game.home_logo,
      opponent: game.away_team,
      opponent_logo: game.away_logo,
      game_context: `${game.game_date} - ${game.game_time}`,
      weather_impact: game.weather,
      market_data: game.lines
    };

    update(legIndex, updatedLeg);
    clearSearch(legIndex);

    // Show weather alert for outdoor sports
    if (game.weather && ['NFL', 'MLB'].includes(watchedSport)) {
      if (game.weather.conditions.includes('rain') || game.weather.wind_speed > 15) {
        toast.info(`🌤️ Weather alert: ${game.weather.conditions}, Wind: ${game.weather.wind_speed}mph`);
      }
    }
  }, [watchedLegs, update, watchedSport]);

  const clearSearch = useCallback((legIndex: number) => {
    setSearchResults(prev => ({
      ...prev,
      [legIndex]: { players: [], games: [] }
    }));
  }, []);

  // Enhanced parlay optimization for VIP+ users
  const optimizeParlay = useCallback(async () => {
    if (userTier !== 'vip_plus' || watchedTicketType !== 'Parlay') return;

    try {
      const { data: optimization } = await supabase.functions.invoke('optimize-parlay', {
        body: {
          legs: watchedLegs,
          sport: watchedSport,
          max_legs: currentSportConfig.validation.maxParlay
        }
      });

      if (optimization?.suggestions) {
        setAiSuggestions(optimization.suggestions);
        toast.success('🤖 AI parlay optimization complete! Check suggestions below.');
      }
    } catch (error) {
      console.error('Parlay optimization error:', error);
      toast.error('Failed to optimize parlay. Please try again.');
    }
  }, [userTier, watchedTicketType, watchedLegs, watchedSport, currentSportConfig]);

  // Enhanced form submission with comprehensive validation
  const onSubmit = async (data: EnhancedTicketFormData) => {
    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not properly configured. Please check your environment variables.');
      }

      // Final validation
      const allErrors: ValidationError[] = [];
      for (let i = 0; i < data.legs.length; i++) {
        const isValid = await validateLegInRealTime(i);
        if (!isValid) {
          allErrors.push(...validationErrors.filter(e => e.legIndex === i));
        }
      }

      if (allErrors.length > 0) {
        setValidationErrors(allErrors);
        onSubmissionError?.(allErrors);
        toast.error(`Please fix ${allErrors.length} validation error(s) before submitting.`);
        return;
      }

      // Enhanced submission data
      const enhancedSubmissionData = {
        ...data,
        user_id: userId,
        submission_timestamp: new Date().toISOString(),
        sport_config: currentSportConfig,
        total_edge_score: Object.values(edgeScores).reduce((sum, score) => sum + score, 0) / Object.keys(edgeScores).length,
        ai_suggestions: aiSuggestions,
        validation_passed: true,
        submission_source: 'enhanced_smart_form',
        user_tier: userTier
      };

      // Submit to Supabase
      const { data: result, error } = await supabase
        .from('enhanced_tickets')
        .insert(enhancedSubmissionData)
        .select()
        .single();

      if (error) throw error;

      // Success handling
      const submissionResult: SubmissionResult = {
        success: true,
        ticket_id: result.id,
        edge_scores: edgeScores,
        ai_analysis: aiSuggestions,
        tier_benefits_used: userTier !== 'member'
      };

      onSubmissionSuccess?.(submissionResult);
      
      toast.success('🎉 Ticket submitted successfully!', {
        description: `Ticket ID: ${result.id}${userTier === 'vip_plus' ? ' | AI analysis included' : ''}`
      });

      // Reset form
      form.reset();
      setSearchResults({});
      setEdgeScores({});
      setAiSuggestions([]);

    } catch (error) {
      console.error('Submission error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast.error('Failed to submit ticket', {
        description: errorMessage
      });
      
      onSubmissionError?.([{
        field: 'general',
        message: errorMessage,
        legIndex: -1
      }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-save draft functionality
  useEffect(() => {
    const saveDraft = () => {
      const draftData = form.getValues();
      localStorage.setItem(`ticket_draft_${userId}`, JSON.stringify(draftData));
    };

    const interval = setInterval(saveDraft, 30000); // Save every 30 seconds
    return () => clearInterval(interval);
  }, [form, userId]);

  // Load draft on component mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(`ticket_draft_${userId}`);
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        form.reset(draftData);
        toast.info('📝 Draft loaded from previous session');
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [form, userId]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header with sport selection and tier indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-4xl">{currentSportConfig.logo}</div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Enhanced Pick Submission
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {currentSportConfig.name} • {userTier.toUpperCase()} Tier
            </p>
          </div>
        </div>
        
        {/* Tier benefits indicator */}
        <div className="flex items-center space-x-2">
          {userTier === 'vip_plus' && (
            <div className="flex items-center space-x-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              <span>👑</span>
              <span>AI Powered</span>
            </div>
          )}
          {userTier === 'vip' && (
            <div className="flex items-center space-x-1 bg-gradient-to-r from-green-400 to-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              <span>⭐</span>
              <span>VIP Features</span>
            </div>
          )}
        </div>
      </div>

      {/* Form implementation continues... */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Sport and ticket type selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sport selection with visual cards */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sport
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ENHANCED_SPORT_CONFIGS).map(([sport, config]) => (
                <button
                  key={sport}
                  type="button"
                  onClick={() => form.setValue('sport', sport as Sport)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    watchedSport === sport
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{config.logo}</div>
                  <div className="text-xs font-medium">{config.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Ticket type selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ticket Type
            </label>
            <select
              {...form.register('ticket_type')}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="Single">🎯 Single Pick</option>
              <option value="Parlay">🔗 Parlay</option>
              <option value="Round Robin">🔄 Round Robin</option>
              {userTier === 'vip_plus' && (
                <option value="AI Optimized">🤖 AI Optimized</option>
              )}
            </select>
          </div>

          {/* Unit size and confidence */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Unit Size
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                {...form.register('unit_size', { valueAsNumber: true })}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confidence (1-10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                {...form.register('confidence_level', { valueAsNumber: true })}
                className="w-full"
              />
              <div className="text-center text-sm text-gray-600">
                {form.watch('confidence_level')}/10
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic legs section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pick Details
            </h2>
            
            {/* VIP+ parlay optimization */}
            {userTier === 'vip_plus' && watchedTicketType === 'Parlay' && legs.length > 1 && (
              <button
                type="button"
                onClick={optimizeParlay}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all"
              >
                <span>🤖</span>
                <span>Optimize Parlay</span>
              </button>
            )}
          </div>

          <AnimatePresence>
            {legs.map((leg, index) => (
              <motion.div
                key={leg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6"
              >
                {/* Leg header with validation status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      Leg {index + 1}
                    </div>
                    
                    {/* Validation status indicator */}
                    <div className={`w-3 h-3 rounded-full ${
                      leg.validation_status === 'valid' ? 'bg-green-500' :
                      leg.validation_status === 'invalid' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    
                    {/* Edge score for VIP+ users */}
                    {userTier === 'vip_plus' && edgeScores[index] && (
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        edgeScores[index] >= 7 ? 'bg-green-100 text-green-800' :
                        edgeScores[index] >= 5 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Edge: {edgeScores[index]}/10
                      </div>
                    )}
                  </div>

                  {/* Remove leg button */}
                  {legs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* Dynamic form fields based on sport and bet type */}
                <EnhancedLegForm
                  legIndex={index}
                  leg={leg}
                  sportConfig={currentSportConfig}
                  visibleFields={getVisibleFields(index, leg.bet_type)}
                  searchResults={searchResults[index] || { players: [], games: [] }}
                  onSearch={handleEnhancedSearch}
                  onSelectPlayer={handleSelectPlayer}
                  onSelectGame={handleSelectGame}
                  onFieldChange={(field, value) => {
                    const updatedLeg = { ...leg, [field]: value };
                    update(index, updatedLeg);
                    validateLegInRealTime(index);
                  }}
                  userTier={userTier}
                  isLoadingAssets={isLoadingAssets}
                />

                {/* AI analysis display for VIP+ users */}
                {userTier === 'vip_plus' && leg.ai_analysis && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                      🤖 AI Analysis
                    </h4>
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <p><strong>Recommendation:</strong> {leg.ai_analysis.recommendation}</p>
                      <p><strong>Key Factors:</strong> {leg.ai_analysis.key_factors?.join(', ')}</p>
                      <p><strong>Confidence:</strong> {leg.ai_analysis.confidence}%</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add leg button */}
          {(watchedTicketType !== 'Single' || legs.length === 0) && 
           legs.length < currentSportConfig.validation.maxParlay && (
            <button
              type="button"
              onClick={() => append(createEnhancedLeg(false))}
              className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-all"
            >
              + Add Another Leg
            </button>
          )}
        </div>

        {/* AI suggestions for VIP+ users */}
        {userTier === 'vip_plus' && aiSuggestions.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🤖 AI Suggestions
            </h3>
            <div className="space-y-3">
              {aiSuggestions.map((suggestion, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {suggestion.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {suggestion.description}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-sm font-medium text-green-600">
                      Expected Value: +{suggestion.expected_value}%
                    </div>
                    <button
                      type="button"
                      onClick={() => {/* Apply suggestion logic */}}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation errors display */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              ❌ Please fix the following errors:
            </h3>
            <ul className="space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-sm text-red-700 dark:text-red-300">
                  Leg {error.legIndex + 1}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit button with loading state */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              👁️ Preview Ticket
            </button>
            
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(`ticket_draft_${userId}`);
                form.reset();
                toast.success('Draft cleared');
              }}
              className="px-6 py-3 text-gray-500 hover:text-gray-700 transition-all"
            >
              🗑️ Clear Draft
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || validationErrors.length > 0}
            className={`px-8 py-3 rounded-lg font-medium transition-all ${
              isSubmitting || validationErrors.length > 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Submitting...</span>
              </div>
            ) : (
              '🚀 Submit Ticket'
            )}
          </button>
        </div>
      </form>

      {/* Preview modal */}
      {previewMode && (
        <TicketPreviewModal
          formData={form.getValues()}
          sportConfig={currentSportConfig}
          onClose={() => setPreviewMode(false)}
          onSubmit={() => {
            setPreviewMode(false);
            form.handleSubmit(onSubmit)();
          }}
        />
      )}
    </div>
  );
}

// Enhanced Leg Form Component (would be implemented separately)
function EnhancedLegForm({ 
  legIndex, 
  leg, 
  sportConfig, 
  visibleFields, 
  searchResults, 
  onSearch, 
  onSelectPlayer, 
  onSelectGame, 
  onFieldChange, 
  userTier, 
  isLoadingAssets 
}: any) {
  // Implementation for the enhanced leg form with dynamic fields
  return (
    <div className="space-y-4">
      {/* Bet type selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Bet Type
        </label>
        <select
          value={leg.bet_type}
          onChange={(e) => onFieldChange('bet_type', e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          {sportConfig.betTypes.map((type: string) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Dynamic fields based on bet type */}
      {visibleFields.showPlayer && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Player
          </label>
          <div className="relative">
            <input
              type="text"
              value={leg.player_name}
              onChange={(e) => {
                onFieldChange('player_name', e.target.value);
                onSearch(legIndex, e.target.value, 'player');
              }}
              placeholder="Search for player..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
            
            {/* Player search results */}
            {searchResults.players.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.players.map((player: PlayerSearchResult) => (
                  <button
                    key={player.player_id}
                    type="button"
                    onClick={() => onSelectPlayer(legIndex, player)}
                    className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                  >
                    {player.image_url && (
                      <img
                        src={player.image_url}
                        alt={player.player_name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="font-medium">{player.player_name}</div>
                      <div className="text-sm text-gray-500">{player.team}</div>
                    </div>
                    {player.injury_status && player.injury_status.status !== 'healthy' && (
                      <div className="ml-auto">
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          {player.injury_status.status}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional dynamic fields would be implemented here */}
      {/* ... */}
    </div>
  );
}

// Ticket Preview Modal Component (would be implemented separately)
function TicketPreviewModal({ formData, sportConfig, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Ticket Preview
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>
        
        {/* Preview content */}
        <div className="space-y-4">
          {/* Implementation for ticket preview */}
        </div>
        
        <div className="flex items-center justify-end space-x-4 mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Edit Ticket
          </button>
          <button
            onClick={onSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Confirm & Submit
          </button>
        </div>
      </div>
    </div>
  );
}
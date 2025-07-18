// Rename EnhancedSubmitTicketForm.tsx to SmartForm.tsx and update imports
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PlayerHeadshot } from "@/components/ui/PlayerHeadshot";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { CapperSelect, CapperName } from "@/components/ui/CapperSelect";
import { TicketSummaryCard } from "@/components/ui/TicketSummaryCard";
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
  SubmissionResult,
  TicketLeg
} from "../types";

// Keep existing ENHANCED_SPORT_CONFIGS...

const ENHANCED_SPORT_CONFIGS: Record<Sport, SportConfig> = {
  NFL: {
    name: "NFL Football",
    betTypes: ["Player Prop", "Moneyline", "Spread", "Total"],
    color: "#013369",
    logo: "🏈",
    playerProps: ["Rush Yds", "Rec Yds", "Pass Yds", "Pass TDs", "INT"],
    validation: {
      maxParlay: 10,
      minOdds: -200,
      maxOdds: 500
    }
  },
  NBA: {
    name: "NBA Basketball",
    betTypes: ["Player Prop", "Moneyline", "Spread", "Total"],
    color: "#1D428A",
    logo: "🏀",
    playerProps: ["PTS", "AST", "REB", "3PM", "BLK", "STL", "PRA"],
    validation: {
      maxParlay: 8,
      minOdds: -200,
      maxOdds: 400
    }
  },
  MLB: {
    name: "MLB Baseball",
    betTypes: ["Player Prop", "Moneyline", "Spread", "Total"],
    color: "#002D72",
    logo: "⚾",
    playerProps: ["TB", "H", "R", "RBI", "BB", "K", "SB", "HR"],
    validation: {
      maxParlay: 6,
      minOdds: -180,
      maxOdds: 350
    }
  }
};

function createEnhancedLeg(isPrimary: boolean = false): TicketLeg {
  return {
    id: uuidv4(),
    bet_type: "Player Prop",
    stat_type: "",
    player_name: "",
    team: "",
    line: "",
    odds: "",
    outcome: "",
    matchup: "",
    is_primary: isPrimary,
    created_at: new Date().toISOString(),
    risk_level: "Low",
    edge: 0,
    marketing_tags: []
  };
}

interface SmartFormProps {
  userTier: 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin';
  userId: string;
  onSubmissionSuccess?: (result: SubmissionResult) => void;
  onSubmissionError?: (error: ValidationError[]) => void;
}

export function SmartForm({ 
  userTier, 
  userId, 
  onSubmissionSuccess, 
  onSubmissionError 
}: SmartFormProps) {
  // Form initialization
  const form = useForm<EnhancedTicketFormData>({
    resolver: zodResolver(enhancedTicketFormSchema),
    defaultValues: {
      capper: 'Griff',
      ticket_type: "Single",
      unit_size: 1,
      auto_parlay: true,
      sport: "NFL",
      game_date: dayjs().format("YYYY-MM-DD"),
      legs: [createEnhancedLeg(true)],
      confidence_level: 5,
      user_tier: userTier,
      imageAttachments: [],
      betType: "Player Prop"
    },
    mode: 'onChange'
  });

  const watchedSport = form.watch('sport');
  const currentSportConfig = ENHANCED_SPORT_CONFIGS[watchedSport];
  const watchedTicketType = form.watch('ticket_type');

  const { fields: legs, append, remove } = useFieldArray({
    control: form.control,
    name: 'legs'
  });

  const [aiSuggestions, setAiSuggestions] = useState<{
    id: string;
    type: string;
    description: string;
    confidence: number;
    reasoning: string;
  }[]>([]);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userTier === 'vip_plus') {
      // In a real app, this would be an API call
      const fetchAiSuggestions = async () => {
        try {
          const response = await fetch('/api/ai-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form.getValues())
          });
          const data = await response.json();
          setAiSuggestions(data.suggestions);
        } catch (error) {
          console.error('Error fetching AI suggestions:', error);
        }
      };

      fetchAiSuggestions();
    }
  }, [userTier, form.watch(['sport', 'ticket_type', 'legs'])]);

  const onSubmit = async (data: EnhancedTicketFormData) => {
    try {
      setIsSubmitting(true);
      // Clear previous validation errors
      setValidationErrors([]);

      // In a real app, this would be an API call
      const response = await fetch('/api/submit-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId })
      });

      const result = await response.json();

      if (result.success) {
        onSubmissionSuccess?.(result);
        toast.success('Ticket submitted successfully!');
        form.reset();
      } else {
        const errors = result.errors || [];
        setValidationErrors(errors);
        onSubmissionError?.(errors);
        toast.error('Failed to submit ticket. Please check the errors.');
      }
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const optimizeParlay = async () => {
    if (userTier !== 'vip_plus') {
      toast.error('Parlay optimization is only available for VIP+ members');
      return;
    }

    try {
      // In a real app, this would be an API call
      const response = await fetch('/api/optimize-parlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.getValues())
      });

      const result = await response.json();

      if (result.success) {
        form.setValue('legs', result.optimizedLegs);
        toast.success('Parlay optimized successfully!');
      } else {
        toast.error('Failed to optimize parlay. Please try again.');
      }
    } catch (error) {
      console.error('Error optimizing parlay:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  // Add keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      form.handleSubmit(onSubmit)();
    }
  };

  // Add focus management
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (validationErrors.length > 0) {
      (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus();
    }
  }, [validationErrors]);

  // Add announcements for screen readers
  const [announcement, setAnnouncement] = useState('');
  
  useEffect(() => {
    if (announcement) {
      const timeout = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timeout);
    }
  }, [announcement]);

  // Keep existing field array and watch hooks...

  // Update the JSX to use new components and add tooltips
  return (
    <div 
      className="max-w-4xl mx-auto p-6 space-y-8"
      onKeyDown={handleKeyDown}
      role="main"
      aria-label="Ticket submission form"
    >
      {/* Header with sport selection and tier indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-4xl" role="img" aria-label={currentSportConfig.name}>
            {currentSportConfig.logo}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Smart Pick Submission
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {currentSportConfig.name} • {userTier.toUpperCase()} Tier
            </p>
          </div>
        </div>
        
        {/* Tier benefits indicator */}
        <div className="flex items-center space-x-2" role="status">
          {userTier === 'vip_plus' && (
            <Tooltip content="Access to AI analysis and advanced features">
              <div 
                className="flex items-center space-x-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium"
                role="status"
                aria-label="VIP Plus member with AI features"
              >
                <span role="img" aria-hidden="true">👑</span>
                <span>AI Powered</span>
              </div>
            </Tooltip>
          )}
          {userTier === 'vip' && (
            <Tooltip content="Access to premium features">
              <div className="flex items-center space-x-1 bg-gradient-to-r from-green-400 to-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                <span>⭐</span>
                <span>VIP Features</span>
              </div>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Form implementation */}
      <form 
        ref={formRef}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8"
        noValidate
      >
        {/* Sport and ticket type selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sport selection with visual cards */}
          <div className="space-y-2">
            <label 
              id="sport-label" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Sport
            </label>
            <div 
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-labelledby="sport-label"
            >
              {Object.entries(ENHANCED_SPORT_CONFIGS).map(([sport, config]) => (
                <Tooltip key={sport} content={`View ${config.name} betting options`}>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('sport', sport as Sport);
                      setAnnouncement(`Selected sport: ${config.name}`);
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      watchedSport === sport
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    role="radio"
                    aria-checked={watchedSport === sport}
                    aria-label={config.name}
                  >
                    <div className="text-2xl mb-1" role="img" aria-hidden="true">
                      {config.logo}
                    </div>
                    <div className="text-xs font-medium">{config.name}</div>
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Capper selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Capper
            </label>
            <CapperSelect
              value={form.watch('capper') as CapperName}
              onChange={(value: CapperName) => form.setValue('capper', value)}
              className="w-full"
            />
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
        </div>

        {/* Unit size and confidence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Tooltip content="1 unit = 1% of your bankroll">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Unit Size
              </label>
            </Tooltip>
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
            <Tooltip content="How confident are you in this pick?">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confidence (1-10)
              </label>
            </Tooltip>
            <input
              type="range"
              min="1"
              max="10"
              {...form.register("confidence_level", { valueAsNumber: true })}
              className="w-full"
            />
            <div className="text-center text-sm text-gray-600">
              {form.watch("confidence_level")}/10
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
              <Tooltip content="Use AI to optimize your parlay selections">
                <button
                  type="button"
                  onClick={optimizeParlay}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all"
                >
                  <span>🤖</span>
                  <span>Optimize Parlay</span>
                </button>
              </Tooltip>
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
                {/* Keep existing leg form implementation... */}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add leg button */}
          {(watchedTicketType !== 'Single' || legs.length === 0) &&
           legs.length < (currentSportConfig?.validation?.maxParlay || 10) && (
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
            <div className="space-y-4">
              {aiSuggestions.map((suggestion, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {suggestion.type}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {suggestion.description}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-sm">
                      <span className="text-blue-600 dark:text-blue-400">
                        {suggestion.confidence}% confidence
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Apply the suggestion
                        toast.success('Suggestion applied!');
                      }}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Apply suggestion
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {suggestion.reasoning}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live region for screen reader announcements */}
        <div 
          aria-live="polite" 
          className="sr-only"
          role="status"
        >
          {announcement}
        </div>

        {/* Validation errors display */}
        {validationErrors.length > 0 && (
          <div 
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            role="alert"
            aria-label="Form validation errors"
          >
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              ❌ Please fix the following errors:
            </h3>
            <ul className="space-y-1">
              {validationErrors.map((error, index) => (
                <li 
                  key={index} 
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  {error.legIndex !== undefined ? `Leg ${error.legIndex + 1}: ` : ''}{error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit button with loading state */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Tooltip content="Preview your ticket before submitting">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode(!previewMode);
                  setAnnouncement(`Preview mode ${previewMode ? 'disabled' : 'enabled'}`);
                }}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                aria-pressed={previewMode}
              >
                👁️ Preview Ticket
              </button>
            </Tooltip>
            
            <Tooltip content="Clear the current draft and start over">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear the current draft?')) {
                    localStorage.removeItem(`ticket_draft_${userId}`);
                    form.reset();
                    toast.success('Draft cleared');
                    setAnnouncement('Form draft cleared');
                    firstInputRef.current?.focus();
                  }
                }}
                className="px-6 py-3 text-gray-500 hover:text-gray-700 transition-all"
                aria-label="Clear draft"
              >
                🗑️ Clear Draft
              </button>
            </Tooltip>
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "✅ Submit Ticket"}
          </button>
        </div>
      </form>

      {/* Preview modal with TicketSummaryCard */}
      {previewMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Ticket Preview
              </h2>
              <button
                onClick={() => setPreviewMode(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            
            <TicketSummaryCard
              ticket={form.getValues()}
              sportConfig={currentSportConfig}
              showDetails={true}
              className="mb-6"
            />
            
            <div className="flex items-center justify-end space-x-4">
              <button
                onClick={() => setPreviewMode(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Edit Ticket
              </button>
              <button
                onClick={() => {
                  setPreviewMode(false);
                  form.handleSubmit(onSubmit as any)();
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
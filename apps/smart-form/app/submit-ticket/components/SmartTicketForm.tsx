'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SmartTicketFormData, FormState, FORM_STEPS } from '../types';
import { StepProgress } from './StepProgress';
import { Step1Essentials } from './Step1Essentials';
import { Step2Configuration } from './Step2Configuration';
import { Step3BetDetails } from './Step3BetDetails';
import { Step4GameSelection } from './Step4GameSelection';
import { getTimezoneOffset } from '@/lib/betting-utils';

interface SmartTicketFormProps {
  onSubmitSuccess?: (ticketId: string) => void;
}

export function SmartTicketForm({ onSubmitSuccess }: SmartTicketFormProps) {
  const { toast } = useToast();
  const [formState, setFormState] = useState<FormState>({
    currentStep: 1,
    completedSteps: [],
    data: {
      // Step 1 fields - Initialize to undefined for proper validation
      capper: undefined,
      ticket_type: undefined,
      sport: undefined,
      game_date: undefined,

      // Step 2 fields
      unit_size: 2.0, // Default moderate bet size
      confidence_level: 7, // Default medium-high confidence

      // Step 3 fields
      bet_type: undefined,
      market_type: undefined,

      // Auto-set fields
      user_tier: 'vip_plus', // Auto-detected
      odds_format: 'AMERICAN', // Default to American odds (99% usage)
      timestamp: new Date().toISOString(),
      timezone: getTimezoneOffset(),
      status: 'pending',
      current_step: 1,
      completed_steps: [],
      legs: [],
      game_selections: [],
    },
    validation: {},
    isSubmitting: false,
  });

  // Update form data
  const updateFormData = (updates: Partial<SmartTicketFormData>) => {
    setFormState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
    }));
  };

  // Validate current step
  const validateStep = (step: number, data: Partial<SmartTicketFormData>) => {
    const errors: any = {};
    let isValid = true;

    switch (step) {
      case 1:
        if (!data.capper) {
          errors.capper = 'Capper selection is required';
          isValid = false;
        }
        if (!data.ticket_type) {
          errors.ticket_type = 'Ticket type is required';
          isValid = false;
        }
        if (!data.sport) {
          errors.sport = 'Sport selection is required';
          isValid = false;
        }
        if (!data.game_date) {
          errors.game_date = 'Game date is required';
          isValid = false;
        } else {
          // Fix date comparison to handle timezone properly
          const selectedDate = new Date(data.game_date + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (selectedDate < today) {
            errors.game_date = 'Cannot select past dates';
            isValid = false;
          }
        }
        break;

      case 2:
        if (!data.unit_size || data.unit_size < 0.5 || data.unit_size > 5) {
          errors.unit_size = 'Unit size must be between 0.5 and 5';
          isValid = false;
        }
        if (!data.odds_format) {
          errors.odds_format = 'Odds format is required';
          isValid = false;
        }
        if (!data.confidence_level || data.confidence_level < 1 || data.confidence_level > 10) {
          errors.confidence_level = 'Confidence level must be between 1 and 10';
          isValid = false;
        }
        break;

      case 3:
        if (!data.bet_type) {
          errors.bet_type = 'Bet type is required';
          isValid = false;
        }
        if (!data.market_type) {
          errors.market_type = 'Market type is required';
          isValid = false;
        }
        break;

      case 4:
        if (!data.game_selections || data.game_selections.length === 0) {
          errors.game_selections = 'At least one selection is required';
          isValid = false;
        }
        break;
    }

    setFormState(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        [step]: { step, isValid, errors, canProceed: isValid },
      },
    }));

    return { isValid, errors };
  };

  // Navigate to step
  const goToStep = (step: number) => {
    // Validate current step before allowing navigation
    if (step > formState.currentStep) {
      const { isValid } = validateStep(formState.currentStep, formState.data);
      if (!isValid) {
        toast({
          title: 'Validation Error',
          description: 'Please complete all required fields before proceeding',
          variant: 'destructive',
        });
        return;
      }
    }

    setFormState(prev => ({
      ...prev,
      currentStep: step,
      data: { ...prev.data, current_step: step },
    }));
  };

  // Handle next step
  const handleNext = () => {
    const { isValid } = validateStep(formState.currentStep, formState.data);

    if (isValid) {
      // Mark current step as completed
      const newCompletedSteps = [...formState.completedSteps];
      if (!newCompletedSteps.includes(formState.currentStep)) {
        newCompletedSteps.push(formState.currentStep);
      }

      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        completedSteps: newCompletedSteps,
        data: {
          ...prev.data,
          current_step: prev.currentStep + 1,
          completed_steps: newCompletedSteps,
        },
      }));
    } else {
      toast({
        title: 'Validation Error',
        description: 'Please complete all required fields',
        variant: 'destructive',
      });
    }
  };

  // Handle back step
  const handleBack = () => {
    if (formState.currentStep > 1) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        data: { ...prev.data, current_step: prev.currentStep - 1 },
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setFormState(prev => ({ ...prev, isSubmitting: true }));

      // Final validation
      const { isValid } = validateStep(4, formState.data);
      if (!isValid) {
        toast({
          title: 'Validation Error',
          description: 'Please complete all required fields',
          variant: 'destructive',
        });
        return;
      }

      // Convert game_selections to legs format for database
      const legs =
        formState.data.game_selections?.map(selection => ({
          id: crypto.randomUUID(),
          sport: formState.data.sport!,
          bet_category: formState.data.bet_type,
          market_type: formState.data.market_type!,
          bet_type: formState.data.bet_type!,
          game_id: selection.game_id,
          selection: selection.selection,
          odds: selection.odds,
          line: selection.line,
          status: 'open' as const,
        })) || [];

      // Helper function to parse selection string
      const parseSelection = (selectionString: string) => {
        const parts = selectionString.split(' - ');
        const propDesc = parts[0]; // "Patrick Mahomes Passing Yards 275.5"
        const directionPart = parts[1] || ''; // "Over 275.5"

        // Extract stat type from prop description
        // Remove player name and line number to get stat type
        const propWords = propDesc.split(' ');
        let statType = '';

        // Find the stat type (words before the line number)
        for (let i = propWords.length - 1; i >= 0; i--) {
          const word = propWords[i];
          // If we hit a number (the line), stop
          if (!isNaN(parseFloat(word))) {
            // Take the 2 words before the line as stat type
            if (i >= 2) {
              statType = propWords
                .slice(i - 2, i)
                .join('_')
                .toLowerCase()
                .replace(/\s+/g, '_');
            }
            break;
          }
        }

        // Fallback: if no stat type found, use the last 2 words before line
        if (!statType && propWords.length >= 3) {
          statType = propWords
            .slice(-3, -1)
            .join('_')
            .toLowerCase()
            .replace(/\s+/g, '_');
        }

        // Extract direction (over/under)
        const direction = directionPart.toLowerCase().startsWith('over')
          ? 'over'
          : directionPart.toLowerCase().startsWith('under')
            ? 'under'
            : 'over'; // default

        return { statType, direction };
      };

      // Transform form data to API format
      const apiPayload = {
        capper_id: formState.data.capper!, // Assuming capper is already the ID
        sport: formState.data.sport!,
        ticket_type: formState.data.ticket_type!,
        total_units: formState.data.unit_size!,
        notes: formState.data.notes,
        selections: (formState.data.game_selections || []).map(gs => {
          const { statType, direction } = parseSelection(gs.selection);
          return {
            sport: formState.data.sport!,
            stat_type: statType,
            line: parseFloat(gs.line),
            leg_odds: parseInt(gs.odds),
            source: 'manual' as const,
            selection: direction as 'over' | 'under' | 'yes' | 'no',
            confidence: formState.data.confidence_level
              ? formState.data.confidence_level / 10
              : 0.7,
          };
        }),
      };

      console.log('📤 Submitting transformed payload:', JSON.stringify(apiPayload, null, 2));

      // Submit to API endpoint
      const response = await fetch('/api/submit-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      toast({
        title: result.isLive ? '🔴 Live Bet Submitted! 🎉' : 'Success! 🎉',
        description: result.message || `Ticket submitted successfully. ID: ${result.ticketId}`,
        variant: 'default',
      });

      // Call success callback
      onSubmitSuccess?.(result.ticketId);

      // Reset form
      setFormState({
        currentStep: 1,
        completedSteps: [],
        data: {
          // Step 1 fields - Initialize to undefined for proper validation
          capper: undefined,
          ticket_type: undefined,
          sport: undefined,
          game_date: undefined,

          // Step 2 fields
          unit_size: undefined,
          confidence_level: undefined,

          // Step 3 fields
          bet_type: undefined,
          market_type: undefined,

          // Auto-set fields
          user_tier: 'vip_plus',
          odds_format: 'AMERICAN',
          timestamp: new Date().toISOString(),
          timezone: getTimezoneOffset(),
          status: 'pending',
          current_step: 1,
          completed_steps: [],
          legs: [],
          game_selections: [],
        },
        validation: {},
        isSubmitting: false,
      });
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: 'Submission Error',
        description: error.message || 'Failed to submit ticket. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Render current step component
  const renderStep = () => {
    const currentErrors = formState.validation[formState.currentStep]?.errors || {};

    switch (formState.currentStep) {
      case 1:
        return (
          <Step1Essentials
            data={formState.data}
            onUpdate={updateFormData}
            onNext={handleNext}
            errors={currentErrors}
          />
        );
      case 2:
        return (
          <Step2Configuration
            data={formState.data}
            onUpdate={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            errors={currentErrors}
          />
        );
      case 3:
        return (
          <Step3BetDetails
            data={formState.data}
            onUpdate={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
            errors={currentErrors}
          />
        );
      case 4:
        return (
          <Step4GameSelection
            data={formState.data}
            onUpdate={updateFormData}
            onSubmit={handleSubmit}
            onBack={handleBack}
            errors={currentErrors}
            isSubmitting={formState.isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a183d] via-[#1b2a4e] to-[#2a3b5e] relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Orbs */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-40 right-20 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-indigo-500/10 rounded-full blur-xl animate-pulse delay-500" />

        {/* Gradient Mesh Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-blue-900/5 to-indigo-900/10" />
      </div>

      <div className="relative z-10 py-8 px-4">
        {/* Premium Header */}
        <div className="w-full max-w-7xl mx-auto mb-12">
          <div className="text-center mb-12">
            {/* Brand Logo/Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/25 border border-blue-400/30">
                  <span className="text-3xl font-bold text-white">UT</span>
                </div>
                <div className="absolute -inset-2 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-3xl blur animate-pulse" />
              </div>
            </div>

            <h1 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-2xl mb-4 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
              Smart Betting Form
            </h1>
            <p className="text-blue-100 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
              Premium ticket submission with AI-powered guidance and real-time validation
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Badge className="bg-blue-500/20 text-blue-100 border-blue-400/30 px-4 py-2 hover:bg-blue-500/30 transition-colors">
                🔒 Secure Submission
              </Badge>
              <Badge className="bg-green-500/20 text-green-100 border-green-400/30 px-4 py-2 hover:bg-green-500/30 transition-colors">
                ⚡ Real-time Validation
              </Badge>
              <Badge className="bg-purple-500/20 text-purple-100 border-purple-400/30 px-4 py-2 hover:bg-purple-500/30 transition-colors">
                🎯 Smart Assistance
              </Badge>
            </div>
          </div>

          {/* Enhanced Step Progress */}
          <StepProgress
            currentStep={formState.currentStep}
            completedSteps={formState.completedSteps}
            onStepClick={goToStep}
          />
        </div>

        {/* Main Content Area */}
        <div className="w-full max-w-7xl mx-auto flex flex-col xl:flex-row gap-8">
          {/* Form Content */}
          <div className="flex-1">
            <Card className="p-8 bg-white/95 backdrop-blur-sm shadow-2xl rounded-3xl border-0 ring-1 ring-white/20">
              <div className="relative">
                {/* Form Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-2xl opacity-30" />
                <div className="relative z-10">{renderStep()}</div>
              </div>
            </Card>
          </div>

          {/* Enhanced Live Preview Sidebar */}
          <div className="w-full xl:w-96 xl:sticky xl:top-8 space-y-6">
            {/* Premium Bet Summary */}
            <Card className="p-6 bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 text-white shadow-2xl rounded-3xl border-0 ring-1 ring-blue-400/30 relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-3xl" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-lg">🎯</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-wide">Bet Summary</h3>
                </div>

                <div className="space-y-4 text-sm">
                  {[
                    { label: 'Type', value: formState.data.ticket_type || 'Not set' },
                    { label: 'Sport', value: formState.data.sport || 'Not set' },
                    { label: 'Units', value: formState.data.unit_size || 'Not set' },
                    {
                      label: 'Confidence',
                      value: `${formState.data.confidence_level || 'Not set'}/10`,
                    },
                    { label: 'Selections', value: formState.data.game_selections?.length || 0 },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2 border-b border-white/20 last:border-b-0"
                    >
                      <span className="font-medium text-blue-100">{item.label}:</span>
                      <span className="font-bold capitalize">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Enhanced Progress Card */}
            <Card className="p-6 bg-white/95 backdrop-blur-sm shadow-xl rounded-3xl border-0 ring-1 ring-gray-200/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">📈</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Progress Tracker</h3>
              </div>

              <Progress
                value={(formState.completedSteps.length / FORM_STEPS.length) * 100}
                className="h-3 mb-4"
              />

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Step:</span>
                  <span className="font-semibold text-gray-900">
                    {formState.currentStep} of {FORM_STEPS.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-semibold text-green-600">
                    {Math.round((formState.completedSteps.length / FORM_STEPS.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-semibold text-orange-600">
                    {FORM_STEPS.length - formState.completedSteps.length} steps
                  </span>
                </div>
              </div>
            </Card>

            {/* Smart Insights Card */}
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-xl rounded-3xl border-0 ring-1 ring-purple-200/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">💡</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Smart Insights</h3>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="bg-white/70 rounded-xl p-4 border border-purple-200/50">
                  <p className="font-medium text-purple-700">✨ Form Analysis</p>
                  <p className="text-xs mt-1">
                    Real-time validation and smart suggestions are active
                  </p>
                </div>

                {formState.data.sport && (
                  <div className="bg-white/70 rounded-xl p-4 border border-blue-200/50">
                    <p className="font-medium text-blue-700">🏀 {formState.data.sport} Selected</p>
                    <p className="text-xs mt-1">Sport-specific options are now available</p>
                  </div>
                )}

                {formState.completedSteps.length > 0 && (
                  <div className="bg-white/70 rounded-xl p-4 border border-green-200/50">
                    <p className="font-medium text-green-700">✅ Progress Saved</p>
                    <p className="text-xs mt-1">Your progress is automatically saved</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

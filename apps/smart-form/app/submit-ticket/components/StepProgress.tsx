'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { FORM_STEPS, FormStep } from '../types';

interface StepProgressProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

export function StepProgress({ currentStep, completedSteps, onStepClick }: StepProgressProps) {
  const getStepStatus = (stepNumber: number) => {
    if (completedSteps.includes(stepNumber)) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'pending';
  };

  const getStepStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          circle:
            'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-500 shadow-lg shadow-green-500/25',
          label: 'text-green-600',
          icon: CheckCircle2,
        };
      case 'current':
        return {
          circle:
            'bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-600 ring-4 ring-blue-300/30 shadow-xl shadow-blue-500/30',
          label: 'text-blue-600',
          icon: Clock,
        };
      case 'pending':
        return {
          circle: 'bg-white text-gray-400 border-gray-300 shadow-sm hover:bg-gray-50',
          label: 'text-gray-400',
          icon: Circle,
        };
      default:
        return {
          circle: 'bg-white text-gray-400 border-gray-300 shadow-sm',
          label: 'text-gray-400',
          icon: Circle,
        };
    }
  };

  const progressPercentage = (completedSteps.length / FORM_STEPS.length) * 100;

  return (
    <div className="w-full">
      {/* Premium Step Indicators */}
      <div className="relative">
        {/* Background Connection Line */}
        <div className="absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 -z-10" />

        {/* Animated Progress Line */}
        <div
          className="absolute top-8 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 transition-all duration-700 ease-out -z-10 shadow-sm"
          style={{
            width: `${Math.max(0, ((currentStep - 1) / (FORM_STEPS.length - 1)) * 100)}%`,
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)',
          }}
        />

        <div className="flex items-start justify-between max-w-5xl mx-auto px-4">
          {FORM_STEPS.map((step, index) => {
            const status = getStepStatus(step.id);
            const styles = getStepStyles(status);
            const isClickable = completedSteps.includes(step.id) || step.id === currentStep;
            const IconComponent = styles.icon;

            return (
              <div key={step.id} className="flex flex-col items-center relative group">
                {/* Premium Step Circle with Animations */}
                <button
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={`
                    relative w-16 h-16 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300 ease-out transform
                    ${styles.circle}
                    ${isClickable ? 'cursor-pointer hover:scale-110 hover:-translate-y-1' : 'cursor-not-allowed'}
                    ${status === 'current' ? 'animate-pulse' : ''}
                  `}
                >
                  {/* Glow Effect for Current Step */}
                  {status === 'current' && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-600 opacity-20 animate-ping" />
                  )}

                  {/* Step Content */}
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-7 h-7 drop-shadow-sm" />
                  ) : status === 'current' ? (
                    <div className="flex flex-col items-center">
                      <span className="text-2xl mb-1">{step.icon}</span>
                    </div>
                  ) : (
                    <span className="text-xl opacity-60">{step.icon}</span>
                  )}

                  {/* Step Number Badge */}
                  <Badge
                    variant={
                      status === 'completed'
                        ? 'default'
                        : status === 'current'
                          ? 'secondary'
                          : 'outline'
                    }
                    className={`
                      absolute -top-1 -right-1 w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs font-bold
                      ${
                        status === 'completed'
                          ? 'bg-green-500 text-white border-green-400'
                          : status === 'current'
                            ? 'bg-blue-500 text-white border-blue-400'
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                      }
                    `}
                  >
                    {step.id}
                  </Badge>
                </button>

                {/* Enhanced Step Label */}
                <div className="mt-4 text-center min-w-[120px]">
                  <div
                    className={`text-sm font-bold tracking-wide ${styles.label} transition-colors duration-200`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-medium">
                    {status === 'completed' && '✓ Complete'}
                    {status === 'current' && '⏳ In Progress'}
                    {status === 'pending' && '⏸️ Pending'}
                  </div>
                </div>

                {/* Hover Tooltip Effect */}
                {isClickable && (
                  <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                      Click to go to {step.title}
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Premium Progress Section */}
      <div className="mt-12 max-w-5xl mx-auto px-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">Form Progress</span>
            </div>
            <Badge variant="outline" className="font-bold text-sm px-3 py-1">
              {Math.round(progressPercentage)}% Complete
            </Badge>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="relative">
            <Progress
              value={progressPercentage}
              className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full overflow-hidden"
            />
            {/* Animated Shimmer Effect */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Progress Details */}
          <div className="flex justify-between items-center mt-4 text-xs">
            <div className="flex items-center gap-2 text-gray-600">
              <Circle className="w-3 h-3" />
              <span>Started</span>
            </div>
            <div className="flex items-center gap-4 text-gray-500">
              <span>
                {completedSteps.length} of {FORM_STEPS.length} steps completed
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-green-600 font-medium">
                {FORM_STEPS.length - completedSteps.length} remaining
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CheckCircle2 className="w-3 h-3" />
              <span>Submit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

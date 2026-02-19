'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, Circle, Loader2 } from 'lucide-react';

export interface Step {
  id: number;
  name: string;
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  className,
}: StepperProps) {
  const isStepCompleted = (stepId: number) => completedSteps.includes(stepId);
  const isStepCurrent = (stepId: number) => currentStep === stepId;
  const isStepClickable = (stepId: number) =>
    isStepCompleted(stepId) || stepId === currentStep || stepId === currentStep + 1;

  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol role="list" className="flex items-center justify-between">
        {steps.map((step, stepIdx) => {
          const completed = isStepCompleted(step.id);
          const current = isStepCurrent(step.id);
          const clickable = isStepClickable(step.id);

          return (
            <li
              key={step.name}
              className={cn(
                'relative flex-1',
                stepIdx !== steps.length - 1 && 'pr-8 sm:pr-12'
              )}
            >
              {/* Connector line */}
              {stepIdx !== steps.length - 1 && (
                <div
                  className="absolute top-4 left-0 -ml-px mt-0.5 w-full h-0.5 hidden sm:block"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'h-full',
                      completed ? 'bg-blue-600' : 'bg-gray-200'
                    )}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => clickable && onStepClick?.(step.id)}
                disabled={!clickable}
                className={cn(
                  'group relative flex flex-col items-center w-full',
                  clickable ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
              >
                {/* Step indicator */}
                <span className="flex items-center">
                  <span
                    className={cn(
                      'relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                      completed && 'bg-blue-600',
                      current && !completed && 'border-2 border-blue-600 bg-white',
                      !completed && !current && 'border-2 border-gray-300 bg-white'
                    )}
                  >
                    {completed ? (
                      <Check className="h-5 w-5 text-white" aria-hidden="true" />
                    ) : current ? (
                      <Circle className="h-3 w-3 text-blue-600 fill-blue-600" aria-hidden="true" />
                    ) : (
                      <span className="text-sm text-gray-500">{step.id}</span>
                    )}
                  </span>
                </span>

                {/* Step label */}
                <span className="mt-2 flex flex-col items-center">
                  <span
                    className={cn(
                      'text-xs font-medium transition-colors',
                      completed && 'text-blue-600',
                      current && 'text-blue-600',
                      !completed && !current && 'text-gray-500'
                    )}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="text-xs text-gray-400 hidden md:block">
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Compact horizontal stepper variant
interface StepperCompactProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  className?: string;
}

export function StepperCompact({
  steps,
  currentStep,
  completedSteps,
  className,
}: StepperCompactProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {steps.map((step, idx) => {
        const completed = completedSteps.includes(step.id);
        const current = currentStep === step.id;

        return (
          <React.Fragment key={step.id}>
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                completed && 'bg-blue-100 text-blue-700',
                current && !completed && 'bg-blue-600 text-white',
                !completed && !current && 'bg-gray-100 text-gray-500'
              )}
            >
              {completed ? (
                <Check className="h-3 w-3" />
              ) : current ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>{step.id}</span>
              )}
              <span className="hidden sm:inline">{step.title}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-4',
                  completed ? 'bg-blue-600' : 'bg-gray-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

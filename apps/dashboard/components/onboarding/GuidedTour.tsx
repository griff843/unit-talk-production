'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, BarChart3, Brain, Trophy, Target } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight: string;
}

const tourSteps: TourStep[] = [
  {
    title: 'Welcome to Unit Talk',
    description:
      "Your elite sports analytics dashboard. Let's take a quick tour of the key features.",
    icon: <Trophy className="h-8 w-8 text-purple-500" />,
    highlight: 'header',
  },
  {
    title: 'Performance Analytics',
    description:
      'Track your win rate, ROI, and performance trends with advanced analytics and AI insights.',
    icon: <BarChart3 className="h-8 w-8 text-blue-500" />,
    highlight: 'performance-section',
  },
  {
    title: 'AI-Powered Insights',
    description: 'Get real-time recommendations and market analysis from our advanced AI system.',
    icon: <Brain className="h-8 w-8 text-green-500" />,
    highlight: 'ai-insights',
  },
  {
    title: 'Pick Management',
    description:
      'Manage your picks with our intuitive interface and get alerts for optimal opportunities.',
    icon: <Target className="h-8 w-8 text-red-500" />,
    highlight: 'picks-section',
  },
];

export function GuidedTour() {
  const [isVisible, setIsVisible] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    const tourSeen = localStorage.getItem('unitTalk_tourSeen');
    if (tourSeen) {
      setHasSeenTour(true);
      setIsVisible(false);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem('unitTalk_tourSeen', 'true');
    setHasSeenTour(true);
    setIsVisible(false);
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isVisible || hasSeenTour) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-xl border border-purple-500/20 p-6 max-w-lg w-full shadow-2xl">
            <div className="absolute top-4 right-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={completeTour}
                className="hover:bg-white/10"
              >
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <div className="p-3 rounded-lg bg-white/10">{tourSteps[currentStep].icon}</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {tourSteps[currentStep].title}
                </h3>
                <p className="text-gray-300">{tourSteps[currentStep].description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <div className="flex space-x-2">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-8 rounded-full transition-colors duration-200 ${
                      index === currentStep ? 'bg-purple-500' : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <div className="flex space-x-2">
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    className="text-white border-white/20 hover:bg-white/10"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  className="bg-purple-500 hover:bg-purple-600 text-white"
                >
                  {currentStep === tourSteps.length - 1 ? (
                    'Get Started'
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

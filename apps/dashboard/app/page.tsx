'use client';

import React from 'react';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Users, Star, ArrowRight, BarChart3, Brain } from 'lucide-react';

export default function HomePage() {
  const stats = {
    totalPicks: '125K+',
    winRate: '67.3%',
    totalCappers: '1.2K+',
    avgROI: '+8.7%',
  };

  const topCappers = [
    { name: 'ProTrader2024', wins: 839, roi: '+15.4%' },
    { name: 'BetWizard', wins: 721, roi: '+12.8%' },
    { name: 'SportsMaster', wins: 654, roi: '+11.2%' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/20 backdrop-blur-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Trophy className="h-8 w-8 text-purple-500" />
              <span className="text-xl font-bold text-white">Unit Talk</span>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              <Button asChild>
                <Link href="/dashboard">
                  Launch Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main>
        <section className="py-20 px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Elite Sports Analytics Platform
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Join the most sophisticated sports betting community powered by AI and expert cappers.
          </p>
          <Button size="lg" asChild className="animate-fade-in">
            <Link href="/dashboard">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </section>

        {/* Stats Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <BarChart3 className="h-5 w-5 mr-2 text-purple-500" />
                  Total Picks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats.totalPicks}</p>
              </CardContent>
            </Card>
            <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                  Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats.winRate}</p>
              </CardContent>
            </Card>
            <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Users className="h-5 w-5 mr-2 text-blue-500" />
                  Active Cappers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats.totalCappers}</p>
              </CardContent>
            </Card>
            <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Brain className="h-5 w-5 mr-2 text-orange-500" />
                  Average ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{stats.avgROI}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Top Cappers */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
            Top Performing Cappers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topCappers.map((capper, index) => (
              <Card key={index} className="bg-black/20 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center">
                      <Star className="h-5 w-5 mr-2 text-yellow-500" />
                      {capper.name}
                    </span>
                    <span className="text-green-500">{capper.roi}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">Total Wins: {capper.wins}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black/20 backdrop-blur-sm py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-400">© 2024 Unit Talk. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-gray-400 hover:text-white">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white">
                Privacy
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

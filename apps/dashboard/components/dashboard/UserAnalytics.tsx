'use client';
/* eslint-disable max-lines-per-function -- Dashboard component with rich UI, refactor TBD */

import {
  User as UserIcon,
  Calendar,
  Clock,
  Crown,
  Star,
  Award,
  TrendingUp,
  Zap,
  Shield,
  Rocket,
  Target,
  Trophy,
  Settings,
} from 'lucide-react';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical UsersRow
interface DashboardUser {
  id: string;
  username: string;
  tier: 'MEMBER' | 'VIP' | 'VIP_PLUS' | 'BLACK_LABEL' | 'CAPPER' | 'ADMIN';
  avatar: string;
  joinDate: string;
  lastActive: string;
}

interface UserAnalyticsProps {
  user: DashboardUser;
}

const TIER_COLORS = {
  MEMBER: '#6b7280',
  VIP: '#f59e0b',
  VIP_PLUS: '#8b5cf6',
  BLACK_LABEL: '#000000',
  CAPPER: '#dc2626',
  ADMIN: '#059669',
};

const TIER_NAMES = {
  MEMBER: 'Member',
  VIP: 'VIP',
  VIP_PLUS: 'VIP+',
  BLACK_LABEL: 'Black Label',
  CAPPER: 'Capper',
  ADMIN: 'Admin',
};

const TIER_FEATURES = {
  MEMBER: ['Basic pick submission', 'Community access', 'Help support'],
  VIP: ['Enhanced analytics', 'Premium content', 'Priority support', 'Advanced pick tools'],
  VIP_PLUS: ['AI coaching', 'Heat signals', 'Edge tracking', 'Advanced notifications'],
  BLACK_LABEL: [
    'Portfolio management',
    'Market intelligence',
    'Professional tools',
    'Exclusive insights',
  ],
  CAPPER: ['Capper profile', 'Revenue sharing', 'Analytics platform', 'Community promotion'],
  ADMIN: ['Full system access', 'User management', 'System monitoring', 'Configuration control'],
};

export function UserAnalytics({ user }: UserAnalyticsProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'BLACK_LABEL':
        return <Crown className="h-4 w-4 text-black" />;
      case 'CAPPER':
        return <Trophy className="h-4 w-4 text-red-500" />;
      case 'VIP_PLUS':
        return <Rocket className="h-4 w-4 text-purple-500" />;
      case 'VIP':
        return <Star className="h-4 w-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="h-4 w-4 text-green-500" />;
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <UserIcon className="h-5 w-5 text-blue-500" />
          <span>User Profile</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Account information and tier status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Profile */}
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="text-lg font-bold">
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{user.username}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {getTierIcon(user.tier)}
              <Badge
                variant="outline"
                className="border-purple-500 text-purple-400"
                style={{ backgroundColor: TIER_COLORS[user.tier] + '20' }}
              >
                {TIER_NAMES[user.tier]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Account Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Calendar className="h-3 w-3 text-blue-400" />
              <span className="text-xs text-gray-400">Joined</span>
            </div>
            <div className="text-sm font-semibold text-white">{formatDate(user.joinDate)}</div>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Clock className="h-3 w-3 text-green-400" />
              <span className="text-xs text-gray-400">Last Active</span>
            </div>
            <div className="text-sm font-semibold text-white">{formatTimeAgo(user.lastActive)}</div>
          </div>
        </div>

        {/* Tier Features */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Award className="h-4 w-4 text-yellow-500" />
            <span>Tier Features</span>
          </h4>
          <div className="space-y-2">
            {TIER_FEATURES[user.tier].map((feature, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Options */}
        {user.tier !== 'BLACK_LABEL' && user.tier !== 'ADMIN' && (
          <div className="p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-800">
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <span>Upgrade Your Experience</span>
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              Unlock premium features and advanced analytics
            </p>
            <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700">
              <Zap className="h-3 w-3 mr-2" />
              View Upgrade Options
            </Button>
          </div>
        )}

        {/* Account Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Settings className="h-3 w-3 mr-2" />
            Account Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Target className="h-3 w-3 mr-2" />
            View Profile
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-400">Active</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-gray-400">Verified</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span className="text-gray-400">Premium</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

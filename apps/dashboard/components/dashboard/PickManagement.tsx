'use client';

import { Target, Plus } from 'lucide-react';
import React from 'react';

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

interface PickManagementProps {
  user: DashboardUser;
}

// eslint-disable-next-line no-unused-vars -- user prop reserved for future personalization
export function PickManagement({ user: _user }: PickManagementProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Target className="h-5 w-5 text-blue-500" />
            <span>Pick Management</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Submit, track, and manage your picks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Target className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Pick Management</h3>
              <p className="text-gray-400 mb-4">Advanced pick management features coming soon</p>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Submit New Pick
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

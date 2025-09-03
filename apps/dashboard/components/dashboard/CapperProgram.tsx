'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Users } from 'lucide-react';

interface User {
  id: string;
  username: string;
  tier: 'MEMBER' | 'VIP' | 'VIP_PLUS' | 'BLACK_LABEL' | 'CAPPER' | 'ADMIN';
  avatar: string;
  joinDate: string;
  lastActive: string;
}

interface CapperProgramProps {
  user: User;
}

export function CapperProgram({ user }: CapperProgramProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Capper Program</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Professional capper tools and community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Users className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Capper Program</h3>
              <p className="text-gray-400 mb-4">
                Professional capper tools and community features coming soon
              </p>
              <Button className="bg-yellow-600 hover:bg-yellow-700">
                <Star className="h-4 w-4 mr-2" />
                Join Capper Program
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

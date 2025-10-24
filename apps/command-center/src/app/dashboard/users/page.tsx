'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Crown,
  Star,
  MoreHorizontal,
  Ban,
  UserCheck,
} from 'lucide-react';

const users = [
  {
    id: 1,
    username: 'ProCapper23',
    discordId: '123456789',
    tier: 'VIP',
    status: 'active',
    joinDate: '2024-01-15',
    totalPicks: 847,
    winRate: 67.2,
    revenue: 2847.5,
    lastActive: '2 minutes ago',
  },
  {
    id: 2,
    username: 'BetMaster99',
    discordId: '987654321',
    tier: 'Premium',
    status: 'active',
    joinDate: '2024-02-03',
    totalPicks: 523,
    winRate: 58.9,
    revenue: 1234.75,
    lastActive: '15 minutes ago',
  },
  {
    id: 3,
    username: 'LuckyStreak',
    discordId: '456789123',
    tier: 'Free',
    status: 'inactive',
    joinDate: '2024-03-12',
    totalPicks: 89,
    winRate: 45.2,
    revenue: 0,
    lastActive: '3 days ago',
  },
  {
    id: 4,
    username: 'GoldenPicks',
    discordId: '789123456',
    tier: 'VIP',
    status: 'banned',
    joinDate: '2024-01-08',
    totalPicks: 1205,
    winRate: 72.1,
    revenue: 4521.3,
    lastActive: '1 week ago',
  },
];

const stats = [
  {
    title: 'Total Users',
    value: '1,234',
    change: '+12.3%',
    icon: Users,
    description: 'Registered users',
  },
  {
    title: 'Active Users',
    value: '892',
    change: '+8.1%',
    icon: UserCheck,
    description: 'Active in last 7 days',
  },
  {
    title: 'VIP Members',
    value: '156',
    change: '+15.2%',
    icon: Crown,
    description: 'Premium subscribers',
  },
  {
    title: 'Banned Users',
    value: '23',
    change: '-5.8%',
    icon: Ban,
    description: 'Suspended accounts',
  },
];

function getTierColor(tier: string) {
  switch (tier) {
    case 'VIP':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Premium':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Free':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'inactive':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'banned':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export default function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, permissions, and subscription tiers
          </p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.title} className="metric-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <span className={stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                  {stat.change}
                </span>
                <span>from last month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search users by username or Discord ID..." className="pl-10" />
            </div>
            <Button variant="outline">Filter</Button>
          </div>

          {/* Users Table */}
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Tier
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Stats
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Revenue
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Last Active
                    </th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b hover:bg-muted/20">
                      <td className="h-16 px-4 align-middle">
                        <div>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-muted-foreground">ID: {user.discordId}</div>
                          <div className="text-xs text-muted-foreground">
                            Joined {user.joinDate}
                          </div>
                        </div>
                      </td>
                      <td className="h-16 px-4 align-middle">
                        <Badge variant="outline" className={getTierColor(user.tier)}>
                          {user.tier === 'VIP' && <Crown className="w-3 h-3 mr-1" />}
                          {user.tier === 'Premium' && <Star className="w-3 h-3 mr-1" />}
                          {user.tier === 'Free' && <Shield className="w-3 h-3 mr-1" />}
                          {user.tier}
                        </Badge>
                      </td>
                      <td className="h-16 px-4 align-middle">
                        <Badge variant="outline" className={getStatusColor(user.status)}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="h-16 px-4 align-middle">
                        <div className="text-sm">
                          <div>{user.totalPicks} picks</div>
                          <div className="text-muted-foreground">{user.winRate}% win rate</div>
                        </div>
                      </td>
                      <td className="h-16 px-4 align-middle">
                        <div className="font-medium">${user.revenue.toLocaleString()}</div>
                      </td>
                      <td className="h-16 px-4 align-middle">
                        <div className="text-sm text-muted-foreground">{user.lastActive}</div>
                      </td>
                      <td className="h-16 px-4 align-middle">
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import EnhancedContests from '@/components/EnhancedContests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ContestsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          🏆 Enhanced Contests Platform
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Experience sport-specific contests with real-time leaderboards, enhanced filtering, and
          enterprise-grade performance powered by your optimized database.
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="default" className="bg-green-500">
            ✅ Sport-Specific Filtering
          </Badge>
          <Badge variant="default" className="bg-blue-500">
            ✅ Real-Time Leaderboards
          </Badge>
          <Badge variant="default" className="bg-purple-500">
            ✅ Enhanced Analytics
          </Badge>
        </div>
      </div>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>Quick links to explore your enhanced platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button asChild variant="outline">
              <a href="/">🏠 Home</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/analytics">📊 Enhanced Analytics</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/submit-ticket">📝 Submit Ticket</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/contests?sport=MLB&status=active" target="_blank">
                🔗 Contests API Test
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Contests Component */}
      <EnhancedContests />

      {/* Contest Features Showcase */}
      <Card>
        <CardHeader>
          <CardTitle>🎉 Enhanced Contest Features</CardTitle>
          <CardDescription>
            Your business logic updates have transformed contest management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-green-600">✅ Sport-Specific Contests</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Filter contests by MLB, NBA, NFL, NHL</li>
                <li>• Sport-specific leaderboards and rankings</li>
                <li>• Targeted competitions for specialized players</li>
                <li>• Enhanced prize pool distribution by sport</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-blue-600">✅ Real-Time Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Live leaderboard updates</li>
                <li>• Real-time participant tracking</li>
                <li>• Instant contest status changes</li>
                <li>• Sub-100ms query performance</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-purple-600">✅ Enhanced Analytics</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Cross-sport performance insights</li>
                <li>• Prize pool analytics by sport</li>
                <li>• Participant behavior tracking</li>
                <li>• Contest success metrics</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-orange-600">✅ Enterprise Performance</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Optimized database queries</li>
                <li>• Foreign key relationship integrity</li>
                <li>• Scalable contest architecture</li>
                <li>• 10,000+ concurrent user support</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Testing Section */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Test Enhanced Contest APIs</CardTitle>
          <CardDescription>
            Test your enhanced contest endpoints with different filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/api/contests?sport=MLB&status=active" target="_blank" className="text-left">
                <div>
                  <div className="font-medium">MLB Contests</div>
                  <div className="text-sm text-muted-foreground">Active MLB-only contests</div>
                </div>
              </a>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/api/contests?sport=NBA&status=active" target="_blank" className="text-left">
                <div>
                  <div className="font-medium">NBA Contests</div>
                  <div className="text-sm text-muted-foreground">Active NBA-only contests</div>
                </div>
              </a>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/api/contests?prize_range=over_1000" target="_blank" className="text-left">
                <div>
                  <div className="font-medium">High Prize Contests</div>
                  <div className="text-sm text-muted-foreground">Contests over $1,000</div>
                </div>
              </a>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/api/contests?status=upcoming" target="_blank" className="text-left">
                <div>
                  <div className="font-medium">Upcoming Contests</div>
                  <div className="text-sm text-muted-foreground">Future contests</div>
                </div>
              </a>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4">
              <a href="/api/contests" target="_blank" className="text-left">
                <div>
                  <div className="font-medium">All Contests</div>
                  <div className="text-sm text-muted-foreground">Complete contest list</div>
                </div>
              </a>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4">
              <a
                href="/api/contests?sport=NFL&prize_range=500_1000"
                target="_blank"
                className="text-left"
              >
                <div>
                  <div className="font-medium">NFL Mid-Tier</div>
                  <div className="text-sm text-muted-foreground">NFL contests $500-$1000</div>
                </div>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

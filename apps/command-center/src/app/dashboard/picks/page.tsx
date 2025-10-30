'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Filter,
  Search,
  Download,
  Eye,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Layers,
  PieChart,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { CLVChart } from '@/components/charts/CLVChart';
import { ComboPlayBuilder } from '@/components/charts/ComboPlayBuilder';
import { PickDetailsModal } from '@/components/PickDetailsModal';
import { RealtimePickFeed } from '@/components/picks/RealtimePickFeed';
import { getTierColor, formatCurrency, formatPercentage } from '@/lib/utils';
import { usePicks, Pick } from '@/hooks/usePicks';
import { toast } from 'sonner';

export default function PicksHQPage() {
  const { picks, stats, loading, error, approvePick, rejectPick, refreshPicks } = usePicks();
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const filteredPicks = picks.filter(pick => {
    if (selectedTab !== 'all' && pick.status !== selectedTab) return false;
    if (selectedSport !== 'all' && pick.sport !== selectedSport) return false;
    if (selectedTier !== 'all' && pick.tier !== selectedTier) return false;
    if (selectedStatus !== 'all' && pick.status !== selectedStatus) return false;
    if (
      searchTerm &&
      !(pick.player_name || pick.line || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      !pick.capper.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  const handleApprovePick = async (pickId: string) => {
    setActionLoading(pickId);
    const result = await approvePick(pickId);
    if (result.success) {
      toast.success('Pick approved successfully', {
        description: 'The pick has been approved and is now live.',
        icon: <CheckCircle className="w-4 h-4" />,
      });
    } else {
      toast.error('Failed to approve pick', {
        description: (result as any).error?.message || 'Please try again or contact support.',
      });
    }
    setActionLoading(null);
    return result.success;
  };

  const handleRejectPick = async (pickId: string) => {
    setActionLoading(pickId);
    const result = await rejectPick(pickId);
    if (result.success) {
      toast.success('Pick rejected successfully', {
        description: 'The pick has been rejected and removed from active picks.',
        icon: <XCircle className="w-4 h-4" />,
      });
    } else {
      toast.error('Failed to reject pick', {
        description: (result as any).error?.message || 'Please try again or contact support.',
      });
    }
    setActionLoading(null);
    return result.success;
  };

  const handleShowPickDetails = (pick: Pick) => {
    setSelectedPick(pick);
    setIsDetailsModalOpen(true);
  };

  const handleModalApprove = async (pickId: string) => {
    const result = await handleApprovePick(pickId);
    if (result) {
      setIsDetailsModalOpen(false);
    }
    return result;
  };

  const handleModalReject = async (pickId: string) => {
    const result = await handleRejectPick(pickId);
    if (result) {
      setIsDetailsModalOpen(false);
    }
    return result;
  };

  const handleExportData = () => {
    const csvContent = [
      'Capper,Sport,Player,Line,Odds,Tier,EV Score,Confidence,Status,ROI,Submitted',
      ...filteredPicks.map(
        pick =>
          `${pick.capper},${pick.sport},${pick.player_name || pick.line},${pick.line},${pick.odds},${pick.tier},${pick.ev_score},${pick.confidence}%,${pick.status},${pick.roi || ''},${new Date(pick.submitted_at).toLocaleDateString()}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `picks-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const dynamicStats = [
    {
      title: 'Total Picks',
      value: loading ? '...' : stats.totalPicks.toLocaleString(),
      change: '+12.5%',
      icon: Target,
    },
    {
      title: 'Pending Review',
      value: loading ? '...' : stats.pendingReview.toString(),
      change: '-8.3%',
      icon: Clock,
    },
    {
      title: 'Avg EV Score',
      value: loading ? '...' : stats.avgEvScore.toFixed(1),
      change: '+1.1',
      icon: TrendingUp,
    },
    {
      title: 'Total ROI',
      value: loading ? '...' : formatCurrency(stats.totalRoi),
      change: '+18.9%',
      icon: DollarSign,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertCircle className="w-8 h-8 mr-2" />
        Error loading picks: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">PicksHQ</h1>
          <p className="text-muted-foreground">
            Advanced pick filtering, analytics, and approval workflow
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={refreshPicks}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dynamicStats.map(stat => (
          <Card key={stat.title} className="metric-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500">{stat.change}</span>
                <span>from last week</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Advanced Filtering</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search picks, cappers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sport Filter */}
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger>
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="MLB">MLB</SelectItem>
                <SelectItem value="NBA">NBA</SelectItem>
                <SelectItem value="NFL">NFL</SelectItem>
                <SelectItem value="NHL">NHL</SelectItem>
                <SelectItem value="NCAAF">NCAAF</SelectItem>
              </SelectContent>
            </Select>

            {/* Tier Filter */}
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger>
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="S">S Tier</SelectItem>
                <SelectItem value="A">A Tier</SelectItem>
                <SelectItem value="B">B Tier</SelectItem>
                <SelectItem value="C">C Tier</SelectItem>
                <SelectItem value="D">D Tier</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedSport('all');
                setSelectedTier('all');
                setSelectedStatus('all');
                setSelectedTab('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Picks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pick Management</CardTitle>
          <CardDescription>
            Review, approve, and analyze betting picks with advanced filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="all">All Picks ({picks.length})</TabsTrigger>
              <TabsTrigger value="realtime">
                <RefreshCw className="w-4 h-4 mr-1" />
                Live Feed
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({picks.filter(p => p.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({picks.filter(p => p.status === 'approved').length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({picks.filter(p => p.status === 'rejected').length})
              </TabsTrigger>
              <TabsTrigger value="clv">
                <BarChart3 className="w-4 h-4 mr-1" />
                CLV Analysis
              </TabsTrigger>
              <TabsTrigger value="combo">
                <Layers className="w-4 h-4 mr-1" />
                Combo Builder
              </TabsTrigger>
            </TabsList>

            {/* Realtime Feed Tab - Charter v3.0 Canonical Integration */}
            <TabsContent value="realtime" className="mt-6">
              <RealtimePickFeed />
            </TabsContent>

            {/* Pick Management Tabs */}
            {(selectedTab === 'all' ||
              selectedTab === 'pending' ||
              selectedTab === 'approved' ||
              selectedTab === 'rejected') && (
              <TabsContent value={selectedTab} className="mt-6">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capper</TableHead>
                        <TableHead>Sport</TableHead>
                        <TableHead>Pick Details</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>EV Score</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>ROI</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPicks.map(pick => (
                        <TableRow key={pick.id}>
                          <TableCell className="font-medium">{pick.capper}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{pick.sport}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pick.player_name || pick.line}</p>
                              <p className="text-sm text-muted-foreground">
                                {pick.line} ({pick.odds > 0 ? '+' : ''}
                                {pick.odds})
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTierColor(pick.tier || 'C')}>
                              {pick.tier || 'C'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">{pick.ev_score?.toFixed(1) || '0.0'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono">{pick.confidence || 50}%</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                pick.status === 'approved'
                                  ? 'default'
                                  : pick.status === 'pending'
                                    ? 'secondary'
                                    : pick.status === 'rejected'
                                      ? 'destructive'
                                      : 'outline'
                              }
                            >
                              {pick.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pick.roi ? (
                              <span
                                className={`font-mono ${pick.roi > 0 ? 'text-green-600' : 'text-red-600'}`}
                              >
                                {formatPercentage(pick.roi)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleShowPickDetails(pick)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {pick.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleApprovePick(pick.id)}
                                    disabled={actionLoading === pick.id}
                                  >
                                    {actionLoading === pick.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <ThumbsUp className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleRejectPick(pick.id)}
                                    disabled={actionLoading === pick.id}
                                  >
                                    {actionLoading === pick.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <ThumbsDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredPicks.length === 0 && (
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No picks found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your filters or search terms
                    </p>
                  </div>
                )}
              </TabsContent>
            )}

            {/* CLV Analysis Tab */}
            <TabsContent value="clv" className="mt-6">
              <CLVChart picks={picks} />
            </TabsContent>

            {/* Combo Builder Tab */}
            <TabsContent value="combo" className="mt-6">
              <ComboPlayBuilder
                picks={picks}
                onComboCreate={combo => {
                  toast.success(`${combo.type} combo created with ${combo.picks.length} picks`);
                  console.log('Combo created:', combo);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pick Details Modal */}
      <PickDetailsModal
        pick={selectedPick}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedPick(null);
        }}
        onApprove={handleModalApprove}
        onReject={handleModalReject}
      />
    </div>
  );
}

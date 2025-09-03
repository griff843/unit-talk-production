// @ts-nocheck
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientTime } from '@/components/ui/client-time'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  FileCheck, 
  Eye, 
  ThumbsUp, 
  ThumbsDown, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  Tag,
  MessageSquare
} from 'lucide-react'
import { getTierColor, getStatusColor, timeAgo, formatPercentage } from '@/lib/utils'

// Mock SmartForm submission data
const submissions = [
  {
    id: 'sf_001',
    submittedAt: new Date(Date.now() - 300000),
    capper: 'ProCapper23',
    sport: 'MLB',
    player: 'Shohei Ohtani',
    market: 'Total Bases',
    line: 'Over 1.5',
    odds: -110,
    book: 'DraftKings',
    confidence: 92,
    reasoning: 'Ohtani has hit over 1.5 total bases in 8 of his last 10 games. Facing a struggling pitcher with a 5.40 ERA.',
    aiSuggestedTier: 'S',
    validationFlags: ['high_confidence', 'strong_reasoning'],
    status: 'pending',
    evScore: 8.7
  },
  {
    id: 'sf_002',
    submittedAt: new Date(Date.now() - 600000),
    capper: 'AnalyticsMaster',
    sport: 'NBA',
    player: 'LeBron James',
    market: 'Points',
    line: 'Over 25.5',
    odds: -105,
    book: 'FanDuel',
    confidence: 78,
    reasoning: 'LeBron averaging 27.8 PPG in last 5 games. Lakers need this win for playoff positioning.',
    aiSuggestedTier: 'B',
    validationFlags: ['moderate_confidence'],
    status: 'approved',
    evScore: 4.2
  },
  {
    id: 'sf_003',
    submittedAt: new Date(Date.now() - 1200000),
    capper: 'SharpBettor',
    sport: 'NFL',
    player: 'Josh Allen',
    market: 'Passing Yards',
    line: 'Over 275.5',
    odds: +110,
    book: 'Caesars',
    confidence: 65,
    reasoning: 'Weather conditions favorable, Bills need to throw to keep up.',
    aiSuggestedTier: 'C',
    validationFlags: ['weather_dependent', 'low_sample_size'],
    status: 'needs_review',
    evScore: 2.1
  },
  {
    id: 'sf_004',
    submittedAt: new Date(Date.now() - 1800000),
    capper: 'DataDriven',
    sport: 'NHL',
    player: 'Connor McDavid',
    market: 'Points',
    line: 'Over 1.5',
    odds: -120,
    book: 'BetMGM',
    confidence: 85,
    reasoning: 'McDavid has recorded multiple points in 12 of last 15 games. Oilers in must-win situation.',
    aiSuggestedTier: 'A',
    validationFlags: ['high_confidence', 'strong_trend'],
    status: 'rejected',
    evScore: 1.8,
    rejectionReason: 'Insufficient edge value for tier assignment'
  }
]

const stats = [
  { title: 'Pending Review', value: '12', change: '+3', icon: Clock },
  { title: 'Approved Today', value: '47', change: '+8', icon: CheckCircle },
  { title: 'Rejected Today', value: '6', change: '-2', icon: XCircle },
  { title: 'Avg Review Time', value: '4.2m', change: '-0.8m', icon: FileCheck }
]

const validationFlagDescriptions: Record<string, { label: string; color: string; description: string }> = {
  'high_confidence': { label: 'High Confidence', color: 'bg-green-500/20 text-green-400', description: 'Capper confidence >= 85%' },
  'strong_reasoning': { label: 'Strong Reasoning', color: 'bg-blue-500/20 text-blue-400', description: 'Detailed analysis provided' },
  'moderate_confidence': { label: 'Moderate Confidence', color: 'bg-yellow-500/20 text-yellow-400', description: 'Capper confidence 70-84%' },
  'weather_dependent': { label: 'Weather Risk', color: 'bg-orange-500/20 text-orange-400', description: 'Weather may impact outcome' },
  'low_sample_size': { label: 'Small Sample', color: 'bg-purple-500/20 text-purple-400', description: 'Limited historical data' },
  'strong_trend': { label: 'Strong Trend', color: 'bg-emerald-500/20 text-emerald-400', description: 'Clear statistical trend identified' }
}

export default function SmartFormReviewPage() {
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('pending')

  const filteredSubmissions = submissions.filter(sub => {
    if (selectedTab === 'pending') return sub.status === 'pending' || sub.status === 'needs_review'
    if (selectedTab === 'approved') return sub.status === 'approved'
    if (selectedTab === 'rejected') return sub.status === 'rejected'
    return true
  })

  const handleApprove = (submissionId: string) => {
    console.log('Approving submission:', submissionId)
    // In production: API call to approve submission
  }

  const handleReject = (submissionId: string) => {
    console.log('Rejecting submission:', submissionId)
    // In production: API call to reject submission
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">SmartForm Review</h1>
          <p className="text-muted-foreground">
            Dynamic submission validation, tier assignment, and approval workflows
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Reviews
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="metric-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <span className="text-green-500">{stat.change}</span>
                <span>from yesterday</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Queue</CardTitle>
          <CardDescription>
            Review pending submissions with AI-powered validation and tier suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">
                Pending ({submissions.filter(s => s.status === 'pending' || s.status === 'needs_review').length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({submissions.filter(s => s.status === 'approved').length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({submissions.filter(s => s.status === 'rejected').length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({submissions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Capper</TableHead>
                      <TableHead>Pick Details</TableHead>
                      <TableHead>AI Tier</TableHead>
                      <TableHead>EV Score</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Validation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{timeAgo(submission.submittedAt)}</p>
                            <p className="text-muted-foreground text-xs">
                              <ClientTime date={submission.submittedAt} format="date" />
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {submission.capper}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{submission.player}</p>
                            <p className="text-sm text-muted-foreground">
                              {submission.sport} • {submission.market} {submission.line}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {submission.odds > 0 ? '+' : ''}{submission.odds} @ {submission.book}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTierColor(submission.aiSuggestedTier)}>
                            {submission.aiSuggestedTier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{submission.evScore}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{submission.confidence}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {submission.validationFlags.slice(0, 2).map((flag) => (
                              <Badge
                                key={flag}
                                variant="outline"
                                className={`text-xs ${validationFlagDescriptions[flag]?.color || 'bg-gray-500/20 text-gray-400'}`}
                              >
                                {validationFlagDescriptions[flag]?.label || flag}
                              </Badge>
                            ))}
                            {submission.validationFlags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{submission.validationFlags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            submission.status === 'approved' ? 'default' :
                            submission.status === 'pending' ? 'secondary' :
                            submission.status === 'needs_review' ? 'destructive' :
                            submission.status === 'rejected' ? 'outline' : 'outline'
                          }>
                            {submission.status === 'needs_review' ? 'needs review' : submission.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Submission Review</DialogTitle>
                                  <DialogDescription>
                                    Detailed analysis and validation for {submission.player} pick
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-medium mb-2">Pick Details</h4>
                                      <div className="space-y-1 text-sm">
                                        <p><span className="text-muted-foreground">Player:</span> {submission.player}</p>
                                        <p><span className="text-muted-foreground">Market:</span> {submission.market} {submission.line}</p>
                                        <p><span className="text-muted-foreground">Odds:</span> {submission.odds > 0 ? '+' : ''}{submission.odds}</p>
                                        <p><span className="text-muted-foreground">Book:</span> {submission.book}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-medium mb-2">AI Analysis</h4>
                                      <div className="space-y-1 text-sm">
                                        <p><span className="text-muted-foreground">Suggested Tier:</span> 
                                          <Badge className={`ml-2 ${getTierColor(submission.aiSuggestedTier)}`}>
                                            {submission.aiSuggestedTier}
                                          </Badge>
                                        </p>
                                        <p><span className="text-muted-foreground">EV Score:</span> {submission.evScore}</p>
                                        <p><span className="text-muted-foreground">Confidence:</span> {submission.confidence}%</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="font-medium mb-2">Capper Reasoning</h4>
                                    <p className="text-sm bg-muted p-3 rounded-md">
                                      {submission.reasoning}
                                    </p>
                                  </div>

                                  <div>
                                    <h4 className="font-medium mb-2">Validation Flags</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {submission.validationFlags.map((flag) => (
                                        <Badge
                                          key={flag}
                                          variant="outline"
                                          className={validationFlagDescriptions[flag]?.color || 'bg-gray-500/20 text-gray-400'}
                                          title={validationFlagDescriptions[flag]?.description}
                                        >
                                          {validationFlagDescriptions[flag]?.label || flag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>

                                  {submission.status === 'rejected' && submission.rejectionReason && (
                                    <div>
                                      <h4 className="font-medium mb-2 text-red-600">Rejection Reason</h4>
                                      <p className="text-sm bg-red-50 dark:bg-red-950 p-3 rounded-md">
                                        {submission.rejectionReason}
                                      </p>
                                    </div>
                                  )}

                                  {(submission.status === 'pending' || submission.status === 'needs_review') && (
                                    <div className="flex justify-end space-x-2 pt-4 border-t">
                                      <Button
                                        variant="outline"
                                        onClick={() => handleReject(submission.id)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <ThumbsDown className="h-4 w-4 mr-2" />
                                        Reject
                                      </Button>
                                      <Button
                                        onClick={() => handleApprove(submission.id)}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <ThumbsUp className="h-4 w-4 mr-2" />
                                        Approve
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                            
                            {(submission.status === 'pending' || submission.status === 'needs_review') && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => handleApprove(submission.id)}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleReject(submission.id)}
                                >
                                  <ThumbsDown className="h-4 w-4" />
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

              {filteredSubmissions.length === 0 && (
                <div className="text-center py-12">
                  <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No submissions found</h3>
                  <p className="text-muted-foreground">
                    {selectedTab === 'pending' 
                      ? 'All caught up! No pending submissions to review.'
                      : `No ${selectedTab} submissions at this time.`
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Operations</CardTitle>
          <CardDescription>
            Perform batch operations on multiple submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve All High Confidence
            </Button>
            <Button variant="outline" size="sm">
              <Tag className="h-4 w-4 mr-2" />
              Auto-Assign Tiers
            </Button>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Request More Info
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Apply Validation Rules
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
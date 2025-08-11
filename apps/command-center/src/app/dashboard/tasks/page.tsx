'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Zap, 
  Plus, 
  Play, 
  Pause, 
  Eye, 
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bot,
  FileText,
  Target,
  Brain,
  Settings
} from 'lucide-react'
import { getStatusColor, timeAgo } from '@/lib/utils'

// Mock task data
const tasks = [
  {
    id: 'task_001',
    title: 'Review MLB Picks for Tonight',
    description: 'Analyze and grade pending MLB picks for tonight\'s games, focusing on player prop accuracy',
    assignedAgent: 'GradingAgent',
    priority: 'high',
    status: 'running',
    createdAt: new Date(Date.now() - 1800000),
    estimatedDuration: '15-20 minutes',
    progress: 65,
    taskType: 'grading_review'
  },
  {
    id: 'task_002',
    title: 'Generate Weekly Performance SOP',
    description: 'Create standard operating procedure document for weekly capper performance analysis',
    assignedAgent: 'AnalyticsAgent',
    priority: 'medium',
    status: 'completed',
    createdAt: new Date(Date.now() - 7200000),
    completedAt: new Date(Date.now() - 3600000),
    estimatedDuration: '30-45 minutes',
    progress: 100,
    taskType: 'sop_generation'
  },
  {
    id: 'task_003',
    title: 'Audit Discord Alert Format',
    description: 'Review and standardize Discord alert formatting across all sports and tiers',
    assignedAgent: 'AlertAgent',
    priority: 'low',
    status: 'pending',
    createdAt: new Date(Date.now() - 1200000),
    estimatedDuration: '10-15 minutes',
    progress: 0,
    taskType: 'quality_audit'
  },
  {
    id: 'task_004',
    title: 'Process Capper Applications',
    description: 'Review and validate new capper application submissions with background analysis',
    assignedAgent: 'UserManagementAgent',
    priority: 'high',
    status: 'failed',
    createdAt: new Date(Date.now() - 900000),
    failedAt: new Date(Date.now() - 600000),
    estimatedDuration: '20-30 minutes',
    progress: 25,
    taskType: 'user_validation',
    errorMessage: 'Database connection timeout during background check API call'
  }
]

const agents = [
  'GradingAgent',
  'AnalyticsAgent', 
  'AlertAgent',
  'RecapAgent',
  'NotificationAgent',
  'UserManagementAgent',
  'AuditAgent'
]

const taskTypes = [
  { value: 'grading_review', label: 'Grading Review' },
  { value: 'sop_generation', label: 'SOP Generation' },
  { value: 'quality_audit', label: 'Quality Audit' },
  { value: 'user_validation', label: 'User Validation' },
  { value: 'content_generation', label: 'Content Generation' },
  { value: 'data_analysis', label: 'Data Analysis' },
  { value: 'system_maintenance', label: 'System Maintenance' }
]

const stats = [
  { title: 'Active Tasks', value: '8', change: '+2', icon: Play },
  { title: 'Completed Today', value: '23', change: '+5', icon: CheckCircle },
  { title: 'Failed Tasks', value: '2', change: '0', icon: XCircle },
  { title: 'Avg Duration', value: '18m', change: '-3m', icon: Clock }
]

export default function LLMTaskCenterPage() {
  const [selectedTab, setSelectedTab] = useState('active')
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedAgent: '',
    priority: 'medium',
    taskType: '',
    estimatedDuration: ''
  })

  const filteredTasks = tasks.filter(task => {
    if (selectedTab === 'active') return task.status === 'running' || task.status === 'pending'
    if (selectedTab === 'completed') return task.status === 'completed'
    if (selectedTab === 'failed') return task.status === 'failed'
    return true
  })

  const handleCreateTask = () => {
    console.log('Creating new task:', newTask)
    // In production: API call to create task
    setNewTaskOpen(false)
    setNewTask({
      title: '',
      description: '',
      assignedAgent: '',
      priority: 'medium',
      taskType: '',
      estimatedDuration: ''
    })
  }

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'grading_review': return Target
      case 'sop_generation': return FileText
      case 'quality_audit': return Settings
      case 'user_validation': return Bot
      case 'content_generation': return Brain
      default: return Zap
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">LLM Task Center</h1>
          <p className="text-muted-foreground">
            AI-powered task assignment, SOP management, and automated workflows
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Assign a new task to an AI agent with specific instructions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      placeholder="Enter task title..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="agent">Assigned Agent</Label>
                    <Select value={newTask.assignedAgent} onValueChange={(value) => setNewTask({...newTask, assignedAgent: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="taskType">Task Type</Label>
                    <Select value={newTask.taskType} onValueChange={(value) => setNewTask({...newTask, taskType: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {taskTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={newTask.priority} onValueChange={(value) => setNewTask({...newTask, priority: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duration">Est. Duration</Label>
                    <Input
                      id="duration"
                      value={newTask.estimatedDuration}
                      onChange={(e) => setNewTask({...newTask, estimatedDuration: e.target.value})}
                      placeholder="e.g., 15-20 minutes"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Task Description</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    placeholder="Provide detailed instructions for the AI agent..."
                    rows={4}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setNewTaskOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTask}>
                    Create Task
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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

      {/* Task Management */}
      <Card>
        <CardHeader>
          <CardTitle>Task Management</CardTitle>
          <CardDescription>
            Monitor and control AI agent task execution with real-time progress tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active">
                Active ({tasks.filter(t => t.status === 'running' || t.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({tasks.filter(t => t.status === 'completed').length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({tasks.filter(t => t.status === 'failed').length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({tasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              <div className="space-y-4">
                {filteredTasks.map((task) => {
                  const TaskIcon = getTaskIcon(task.taskType)
                  
                  return (
                    <Card key={task.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1">
                            <div className={`p-2 rounded-lg ${
                              task.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                              task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              <TaskIcon className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold text-lg">{task.title}</h3>
                                <Badge variant={
                                  task.priority === 'urgent' ? 'destructive' :
                                  task.priority === 'high' ? 'default' :
                                  task.priority === 'medium' ? 'secondary' :
                                  'outline'
                                }>
                                  {task.priority}
                                </Badge>
                                <Badge variant="outline">
                                  {task.assignedAgent}
                                </Badge>
                              </div>
                              
                              <p className="text-muted-foreground mb-3">{task.description}</p>
                              
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                <span>Created {timeAgo(task.createdAt)}</span>
                                <span>•</span>
                                <span>Est. {task.estimatedDuration}</span>
                                {task.completedAt && (
                                  <>
                                    <span>•</span>
                                    <span>Completed {timeAgo(task.completedAt)}</span>
                                  </>
                                )}
                                {task.failedAt && (
                                  <>
                                    <span>•</span>
                                    <span className="text-red-400">Failed {timeAgo(task.failedAt)}</span>
                                  </>
                                )}
                              </div>

                              {task.status === 'running' && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-sm mb-1">
                                    <span>Progress</span>
                                    <span>{task.progress}%</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2">
                                    <div 
                                      className="bg-primary h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${task.progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {task.errorMessage && (
                                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded-md">
                                  <div className="flex items-center space-x-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm font-medium text-red-600">Error Details</span>
                                  </div>
                                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                    {task.errorMessage}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(task.status)}>
                              {task.status}
                            </Badge>
                            
                            <div className="flex items-center space-x-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {task.status === 'running' && (
                                <Button variant="ghost" size="sm">
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {(task.status === 'pending' || task.status === 'failed') && (
                                <Button variant="ghost" size="sm">
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {filteredTasks.length === 0 && (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                  <p className="text-muted-foreground">
                    {selectedTab === 'active' 
                      ? 'No active tasks at the moment. Create a new task to get started.'
                      : `No ${selectedTab} tasks found.`
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Task Templates</CardTitle>
          <CardDescription>
            Pre-configured task templates for common operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Target className="h-5 w-5" />
              <span className="text-sm">Grade Pending Picks</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <FileText className="h-5 w-5" />
              <span className="text-sm">Generate SOP</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Bot className="h-5 w-5" />
              <span className="text-sm">Audit User Activity</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Brain className="h-5 w-5" />
              <span className="text-sm">Content Analysis</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
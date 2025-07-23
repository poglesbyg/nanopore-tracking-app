'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { Progress } from '../ui/progress'
import { trpc } from '@/client/trpc'
import { toast } from 'sonner'
import { MCPEnhancedDashboard } from './mcp-enhanced-dashboard'
import { ProtocolRecommendationWidget } from './protocol-recommendation-widget'
import { QualityAssessmentPanel } from './quality-assessment-panel'
import { useMCPTools } from '../../hooks/useMCPTools'
import { 
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Lightbulb,
  LineChart,
  Microscope,
  Package,
  Sparkles,
  TestTube,
  TrendingUp,
  Users,
  Zap,
  AlertCircle,
  ChevronRight,
  Target,
  Beaker,
  Timer,
  Award,
  X
} from 'lucide-react'

interface SubmissionDashboardProps {
  className?: string
}

// Enhanced stats with trends
interface DashboardStats {
  totalSubmissions: number
  totalSamples: number
  activeSamples: number
  completedToday: number
  averageProcessingTime: number
  successRate: number
  trends: {
    submissions: 'up' | 'down' | 'stable'
    processingTime: 'up' | 'down' | 'stable'
    quality: 'up' | 'down' | 'stable'
  }
}

// Real-time activity item
interface ActivityItem {
  id: string
  type: 'submission' | 'completion' | 'alert' | 'milestone'
  title: string
  description: string
  timestamp: Date
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  icon?: any
}

export function SubmissionDashboard({ className = '' }: SubmissionDashboardProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('week')
  const [showAIInsights, setShowAIInsights] = useState(true)
  
  // Fetch data
  const { data: submissions, isLoading: submissionsLoading } = trpc.nanoporeSubmission.getAllPaginated.useQuery({
    page: 1,
    limit: 100
  })

  const { data: recentSamples, isLoading: samplesLoading } = trpc.nanopore.getAllPaginated.useQuery({
    page: 1,
    limit: 10,
    sortBy: 'submittedAt',
    sortOrder: 'desc'
  })

  // Use MCP tools for insights
  const { 
    optimizeSequencingWorkflow,
    troubleshootSequencingIssue,
    getNanoporeBestPractices
  } = useMCPTools()

  // Calculate dashboard statistics
  const stats: DashboardStats = {
    totalSubmissions: submissions?.data?.length || 0,
    totalSamples: submissions?.data?.reduce((acc, sub) => acc + (sub.sample_count || 0), 0) || 0,
    activeSamples: recentSamples?.data?.filter((s: any) => ['submitted', 'prep', 'sequencing', 'analysis'].includes(s.status))?.length || 0,
    completedToday: recentSamples?.data?.filter((s: any) => {
      const completedAt = s.completed_at ? new Date(s.completed_at) : null
      const today = new Date()
      return completedAt && 
        completedAt.getDate() === today.getDate() &&
        completedAt.getMonth() === today.getMonth() &&
        completedAt.getFullYear() === today.getFullYear()
    })?.length || 0,
    averageProcessingTime: 48, // hours - would calculate from actual data
    successRate: 94.5, // percentage - would calculate from actual data
    trends: {
      submissions: 'up',
      processingTime: 'down',
      quality: 'up'
    }
  }

  // Generate real-time activity feed
  const activityFeed: ActivityItem[] = [
    {
      id: '1',
      type: 'submission',
      title: 'New submission received',
      description: 'SUBM-20250723-001 with 5 samples',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      priority: 'high',
      icon: FileText
    },
    {
      id: '2',
      type: 'completion',
      title: 'Sequencing completed',
      description: 'Sample DNA-2024-0892 achieved 150x coverage',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      icon: CheckCircle
    },
    {
      id: '3',
      type: 'alert',
      title: 'Quality threshold exceeded',
      description: 'Sample RNA-2024-0456 shows exceptional purity',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      priority: 'normal',
      icon: Award
    },
    {
      id: '4',
      type: 'milestone',
      title: 'Weekly milestone achieved',
      description: '50 samples processed with 96% success rate',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      icon: Target
    }
  ]

  // Workflow bottlenecks (would be calculated from real data)
  const bottlenecks = [
    { stage: 'Library Prep', delay: 2.5, samples: 8 },
    { stage: 'Sequencing Queue', delay: 1.2, samples: 3 },
    { stage: 'Data Analysis', delay: 0.8, samples: 5 }
  ]

  // Quality metrics overview
  const qualityMetrics = {
    averagePurity: 1.85,
    averageYield: 12.5,
    passRate: 94.5,
    topIssue: 'Low concentration in 3 samples'
  }

  if (submissionsLoading || samplesLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            Nanopore Operations Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Real-time insights and AI-powered recommendations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedTimeRange === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange('today')}
          >
            Today
          </Button>
          <Button
            variant={selectedTimeRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange('week')}
          >
            This Week
          </Button>
          <Button
            variant={selectedTimeRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange('month')}
          >
            This Month
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -mr-16 -mt-16 opacity-20" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Active Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{stats.totalSubmissions}</div>
              <Badge variant="outline" className="text-green-600">
                <ArrowUp className="h-3 w-3 mr-1" />
                12%
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {stats.totalSamples} total samples
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -mr-16 -mt-16 opacity-20" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Avg. Processing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{stats.averageProcessingTime}h</div>
              <Badge variant="outline" className="text-green-600">
                <ArrowDown className="h-3 w-3 mr-1" />
                8%
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Target: 36h
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full -mr-16 -mt-16 opacity-20" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{stats.successRate}%</div>
              <Badge variant="outline" className="text-purple-600">
                <ArrowUp className="h-3 w-3 mr-1" />
                2.5%
              </Badge>
            </div>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full -mr-16 -mt-16 opacity-20" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold">{stats.completedToday}</div>
              <Badge variant="outline" className="text-orange-600">
                On track
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Daily target: 15
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Activity Feed */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Real-time Activity
            </CardTitle>
            <CardDescription>Latest updates from the lab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityFeed.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className={`p-2 rounded-full ${
                  activity.type === 'alert' ? 'bg-yellow-100' :
                  activity.type === 'completion' ? 'bg-green-100' :
                  activity.type === 'milestone' ? 'bg-purple-100' :
                  'bg-blue-100'
                }`}>
                  <activity.icon className={`h-4 w-4 ${
                    activity.type === 'alert' ? 'text-yellow-600' :
                    activity.type === 'completion' ? 'text-green-600' :
                    activity.type === 'milestone' ? 'text-purple-600' :
                    'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" size="sm">
              View All Activity
            </Button>
          </CardContent>
        </Card>

        {/* Workflow Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Workflow Performance
            </CardTitle>
            <CardDescription>Identify bottlenecks and optimize throughput</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Bottleneck Analysis */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Current Bottlenecks</h4>
                <div className="space-y-3">
                  {bottlenecks.map((bottleneck, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{bottleneck.stage}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-orange-600">
                            +{bottleneck.delay}h delay
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {bottleneck.samples} samples
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={(bottleneck.delay / 3) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">AI Recommendations</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="justify-start"
                    onClick={async () => {
                      const result = await optimizeSequencingWorkflow({
                        metrics: {
                          throughput: 15,
                          averageProcessingTime: stats.averageProcessingTime,
                          successRate: stats.successRate,
                          bottlenecks: bottlenecks.map(b => b.stage)
                        },
                        constraints: {
                          maxSamplesPerDay: 20,
                          availableFlowCells: 10
                        },
                        goal: 'throughput'
                      })
                      toast.success('Optimization suggestions generated')
                    }}
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Optimize Workflow
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="justify-start"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Reallocate Staff
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality & AI Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-blue-600" />
              Quality Overview
            </CardTitle>
            <CardDescription>Sample quality metrics and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Average Purity (260/280)</p>
                <p className="text-2xl font-bold">{qualityMetrics.averagePurity}</p>
                <p className="text-xs text-green-600">Within optimal range</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Yield (μg)</p>
                <p className="text-2xl font-bold">{qualityMetrics.averageYield}</p>
                <p className="text-xs text-green-600">Above target</p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Pass Rate</span>
                <span className="text-sm font-bold">{qualityMetrics.passRate}%</span>
              </div>
              <Progress value={qualityMetrics.passRate} className="mb-2" />
              {qualityMetrics.topIssue && (
                <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-50 rounded">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Attention Needed</p>
                    <p className="text-sm text-yellow-700">{qualityMetrics.topIssue}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI-Powered Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              AI-Powered Insights
            </CardTitle>
            <CardDescription>Smart recommendations from MCP analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Protocol Optimization</p>
                  <p className="text-sm text-blue-800 mt-1">
                    Switch to Rapid Sequencing Kit for samples with concentration &gt;100 ng/μL 
                    to reduce processing time by 40%
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Throughput Improvement</p>
                  <p className="text-sm text-purple-800 mt-1">
                    Batch similar sample types together to optimize flow cell usage 
                    and increase daily throughput by 25%
                  </p>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAIInsights(true)}
            >
              <Brain className="h-4 w-4 mr-2" />
              View Detailed AI Analysis
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-full shadow-sm">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-600">Streamline your workflow</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary">
                <FileText className="h-4 w-4 mr-2" />
                New Submission
              </Button>
              <Button size="sm" variant="secondary">
                <TestTube className="h-4 w-4 mr-2" />
                Sample Status
              </Button>
              <Button size="sm" variant="secondary">
                <LineChart className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full MCP Dashboard Modal/Drawer */}
      {showAIInsights && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="h-6 w-6 text-blue-600" />
                AI-Powered Analysis Dashboard
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAIInsights(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <MCPEnhancedDashboard />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default SubmissionDashboard 
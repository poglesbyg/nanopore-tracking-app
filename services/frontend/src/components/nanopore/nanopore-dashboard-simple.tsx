import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  Plus, 
  Search, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User,
  TestTube,
  Zap,
  TrendingUp,
  Activity,
  Calendar,
  Settings,
  LogOut,
  ChevronDown,
  Archive,
  Trash2,
  X,
  Users
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { microserviceClient, type NanoporeSample } from '@/lib/microservice-client'
import PDFUpload from './pdf-upload'
import { ExportModal } from './export-modal'

interface DashboardStats {
  total: number
  submitted: number
  inProgress: number
  completed: number
  urgent: number
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock },
    prep: { color: 'bg-yellow-100 text-yellow-800', icon: TestTube },
    sequencing: { color: 'bg-purple-100 text-purple-800', icon: Zap },
    analysis: { color: 'bg-orange-100 text-orange-800', icon: Activity },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    failed: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.submitted
  const Icon = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const priorityConfig = {
    low: { color: 'bg-gray-100 text-gray-800', icon: TrendingUp },
    medium: { color: 'bg-blue-100 text-blue-800', icon: TrendingUp },
    high: { color: 'bg-orange-100 text-orange-800', icon: TrendingUp },
    urgent: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
  }

  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.low
  const Icon = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {priority}
    </Badge>
  )
}

export default function NanoporeDashboard() {
  const [samples, setSamples] = useState<NanoporeSample[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState<NanoporeSample | null>(null)
  
  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    submitted: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0
  })

  // Load samples
  useEffect(() => {
    loadSamples()
  }, [])

  const loadSamples = async () => {
    try {
      setLoading(true)
      const data = await microserviceClient.getSamples()
      setSamples(data)
      updateStats(data)
    } catch (error) {
      console.error('Failed to load samples:', error)
      toast.error('Failed to load samples')
    } finally {
      setLoading(false)
    }
  }

  const updateStats = (samples: NanoporeSample[]) => {
    const stats = {
      total: samples.length,
      submitted: samples.filter(s => s.status === 'submitted').length,
      inProgress: samples.filter(s => ['prep', 'sequencing', 'analysis'].includes(s.status)).length,
      completed: samples.filter(s => s.status === 'completed').length,
      urgent: samples.filter(s => s.priority === 'urgent').length
    }
    setStats(stats)
  }

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = sample.sampleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sample.submitterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sample.labName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || sample.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || sample.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleCreateSample = async (sampleData: Omit<NanoporeSample, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await microserviceClient.createSample(sampleData)
      await loadSamples()
      setShowCreateModal(false)
      toast.success('Sample created successfully')
    } catch (error) {
      console.error('Failed to create sample:', error)
      toast.error('Failed to create sample')
    }
  }

  const handleUpdateSample = async (id: string, updates: Partial<NanoporeSample>) => {
    try {
      await microserviceClient.updateSample(id, updates)
      await loadSamples()
      toast.success('Sample updated successfully')
    } catch (error) {
      console.error('Failed to update sample:', error)
      toast.error('Failed to update sample')
    }
  }

  const handleDeleteSample = async (id: string) => {
    try {
      await microserviceClient.deleteSample(id)
      await loadSamples()
      toast.success('Sample deleted successfully')
    } catch (error) {
      console.error('Failed to delete sample:', error)
      toast.error('Failed to delete sample')
    }
  }

  const handlePDFDataExtracted = async (data: any, file: File) => {
    try {
      const sampleData = {
        sampleName: data.sampleName || file.name.replace('.pdf', ''),
        submitterName: data.submitterName || '',
        submitterEmail: data.submitterEmail || '',
        labName: data.labName || '',
        priority: data.priority || 'medium' as const,
        status: 'submitted' as const,
        concentration: data.concentration,
        volume: data.volume,
        notes: data.notes || `Extracted from ${file.name}`,
      }
      
      await handleCreateSample(sampleData)
    } catch (error) {
      console.error('Failed to create sample from PDF data:', error)
      toast.error('Failed to create sample from PDF data')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading samples...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Nanopore Sequencing Dashboard</h1>
          <p className="text-muted-foreground">Manage and track your nanopore sequencing samples</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowExportModal(true)} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Sample
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="samples" className="w-full">
        <TabsList>
          <TabsTrigger value="samples">Samples</TabsTrigger>
          <TabsTrigger value="upload">Upload PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="samples" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search samples..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="prep">Prep</SelectItem>
                <SelectItem value="sequencing">Sequencing</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Samples Table */}
          <Card>
            <CardHeader>
              <CardTitle>Samples ({filteredSamples.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSamples.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No samples found matching your criteria
                  </div>
                ) : (
                  filteredSamples.map((sample) => (
                    <div key={sample.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{sample.sampleName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {sample.submitterName} • {sample.labName}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <StatusBadge status={sample.status} />
                          <PriorityBadge priority={sample.priority} />
                        </div>
                      </div>
                      {sample.notes && (
                        <p className="text-sm text-muted-foreground">{sample.notes}</p>
                      )}
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(sample.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSample(sample)}
                          >
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleDeleteSample(sample.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <PDFUpload
            onDataExtracted={handlePDFDataExtracted}
            onFileUploaded={(file) => {
              toast.success(`File ${file.name} uploaded successfully`)
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  )
} 
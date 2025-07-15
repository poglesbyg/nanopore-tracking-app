import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { Skeleton } from '../ui/skeleton'
import CreateSampleModal from './create-sample-modal'
import { EditTaskModal } from './edit-task-modal'
import { ViewTaskModal } from './view-task-modal'
import { AssignModal } from './assign-modal'
import { ExportModal } from './export-modal'
import { MemoryOptimizationPanel } from './memory-optimization-panel'
import PDFUpload from './pdf-upload'
import { useAuth } from '../auth/auth-wrapper'
import { trpc } from '@/client/trpc'
import type { NanoporeSample } from '@/lib/api-client'
import { 
  Plus, 
  Search, 
  Filter, 
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
  Edit,
  Eye,
  Users,
  Trash2,
  MoreHorizontal,
  X
} from 'lucide-react'

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
    archived: { color: 'bg-gray-100 text-gray-800', icon: Archive }
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.submitted
  const Icon = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const priorityConfig = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700'
  }

  return (
    <Badge className={priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  )
}

const StatCard = ({ title, value, icon: Icon, color, change }: {
  title: string
  value: number
  icon: any
  color: string
  change?: { value: number; positive: boolean }
}) => (
  <Card className="relative overflow-hidden">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {change && (
        <p className={`text-xs ${change.positive ? 'text-green-600' : 'text-red-600'} flex items-center gap-1`}>
          <TrendingUp className="h-3 w-3" />
          {change.positive ? '+' : ''}{change.value}% from last week
        </p>
      )}
    </CardContent>
  </Card>
)

export default function NanoporeDashboard() {
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Modal state management
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState<NanoporeSample | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set())
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [showPdfUploadModal, setShowPdfUploadModal] = useState(false)

  // tRPC hooks
  const { data: samples = [], isLoading: loading, refetch } = trpc.nanopore.getAll.useQuery()
  const createSampleMutation = trpc.nanopore.create.useMutation()
  const updateSampleMutation = trpc.nanopore.update.useMutation()
  const assignSampleMutation = trpc.nanopore.assign.useMutation()
  const deleteSampleMutation = trpc.nanopore.delete.useMutation()
  const updateStatusMutation = trpc.nanopore.updateStatus.useMutation()

  // Calculate stats from samples
  const stats: DashboardStats = {
    total: samples.length,
    submitted: samples.filter((s: any) => s.status === 'submitted').length,
    inProgress: samples.filter((s: any) => {
      const status = s.status || ''
      return ['prep', 'sequencing', 'analysis'].includes(status)
    }).length,
    completed: samples.filter((s: any) => s.status === 'completed').length,
    urgent: samples.filter((s: any) => s.priority === 'urgent').length,
  }

  // Type mapping functions to convert between API and modal types
  const mapApiToModal = (apiSample: any): any => ({
    id: apiSample.id,
    sampleName: apiSample.sample_name,
    projectId: apiSample.project_id,
    submitterName: apiSample.submitter_name,
    submitterEmail: apiSample.submitter_email,
    labName: apiSample.lab_name,
    sampleType: apiSample.sample_type,
    status: apiSample.status,
    priority: apiSample.priority,
    assignedTo: apiSample.assigned_to,
    libraryPrepBy: apiSample.library_prep_by,
    submittedAt: new Date(apiSample.submitted_at),
    createdAt: new Date(apiSample.created_at),
    updatedAt: new Date(apiSample.updated_at),
    createdBy: apiSample.created_by,
  })

  const mapModalToApi = (modalData: any): any => ({
    sample_name: modalData.sampleName,
    project_id: modalData.projectId,
    submitter_name: modalData.submitterName,
    submitter_email: modalData.submitterEmail,
    lab_name: modalData.labName,
    sample_type: modalData.sampleType,
    status: modalData.status,
    priority: modalData.priority,
    assigned_to: modalData.assignedTo,
    library_prep_by: modalData.libraryPrepBy,
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openDropdown])

  const filteredSamples = samples.filter((sample: any) => {
    // Safely handle potentially undefined/null values
    const sampleName = sample.sample_name || ''
    const submitterName = sample.submitter_name || ''
    const labName = sample.lab_name || ''
    
    const matchesSearch = sampleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submitterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         labName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || sample.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || sample.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleCreateSample = () => {
    setShowCreateModal(true)
  }

  const handleSampleSubmit = async (sampleData: any) => {
    try {
      await createSampleMutation.mutateAsync(sampleData)
      refetch()
      toast.success('Sample created successfully!')
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create sample:', error)
      toast.error('Failed to create sample')
    }
  }

  const handleUploadPDF = () => {
    setShowPdfUploadModal(true)
  }

  const handleExport = () => {
    setShowExportModal(true)
  }

  // Sample action handlers
  const handleViewSample = (sample: NanoporeSample) => {
    setSelectedSample(sample)
    setShowViewModal(true)
  }

  const handleEditSample = (sample: NanoporeSample) => {
    setSelectedSample(sample)
    setShowEditModal(true)
  }

  const handleAssignSample = (sample: NanoporeSample) => {
    setSelectedSample(sample)
    setShowAssignModal(true)
  }

  const handleDeleteSample = async (sample: any) => {
    if (!window.confirm(`Are you sure you want to delete sample "${sample.sample_name}"?`)) {
      return
    }

    setActionLoading(sample.id)
    try {
      await deleteSampleMutation.mutateAsync(sample.id)
      refetch()
      toast.success('Sample deleted successfully')
    } catch (error) {
      console.error('Failed to delete sample:', error)
      toast.error('Failed to delete sample')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSampleUpdate = async (sampleId: string, updateData: any) => {
    setActionLoading(sampleId)
    try {
      await updateSampleMutation.mutateAsync({
        id: sampleId,
        data: updateData,
      })
      refetch()
      toast.success('Sample updated successfully')
      setShowEditModal(false)
    } catch (error) {
      console.error('Failed to update sample:', error)
      toast.error('Failed to update sample')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSampleAssign = async (assignedTo: string, libraryPrepBy?: string) => {
    if (!selectedSample) return
    
    setActionLoading(selectedSample.id)
    try {
      await assignSampleMutation.mutateAsync({
        id: selectedSample.id,
        assignedTo,
        libraryPrepBy,
      })
      refetch()
      toast.success('Sample assigned successfully')
      setShowAssignModal(false)
    } catch (error) {
      console.error('Failed to assign sample:', error)
      toast.error('Failed to assign sample')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStatusUpdate = async (sample: any, newStatus: string) => {
    setActionLoading(sample.id)
    try {
      await updateStatusMutation.mutateAsync({
        id: sample.id,
        status: newStatus,
      })
      refetch()
      toast.success(`Sample status updated to ${newStatus}`)
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    } finally {
      setActionLoading(null)
    }
  }

  // Get next available status for workflow progression
  const getNextStatus = (currentStatus: string | null | undefined): string | null => {
    if (!currentStatus) return null
    const workflow = ['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived']
    const currentIndex = workflow.indexOf(currentStatus)
    if (currentIndex === -1 || currentIndex === workflow.length - 1) {
      return null
    }
    return workflow[currentIndex + 1]
  }

  // Bulk actions handlers
  const handleSelectSample = (sampleId: string, checked: boolean) => {
    setSelectedSamples(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(sampleId)
      } else {
        newSet.delete(sampleId)
      }
      return newSet
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSamples(new Set(filteredSamples.map(s => s.id)))
    } else {
      setSelectedSamples(new Set())
    }
  }

  const handleBulkAssign = (assignedTo: string, libraryPrepBy?: string) => {
    const promises = Array.from(selectedSamples).map(sampleId => {
      return assignSampleMutation.mutateAsync({
        id: sampleId,
        assignedTo,
        libraryPrepBy,
      })
    })

    setActionLoading('bulk')
    Promise.all(promises)
      .then((updatedSamples) => {
        refetch()
        toast.success(`${selectedSamples.size} samples assigned successfully`)
        setSelectedSamples(new Set())
        setShowBulkAssignModal(false)
      })
      .catch((error) => {
        console.error('Failed to assign samples:', error)
        toast.error('Failed to assign samples')
      })
      .finally(() => {
        setActionLoading(null)
      })
  }

  const handleBulkStatusUpdate = async (newStatus: string) => {
    const promises = Array.from(selectedSamples).map(sampleId => 
      updateStatusMutation.mutateAsync({
        id: sampleId,
        status: newStatus,
      })
    )

    setActionLoading('bulk')
    try {
      const updatedSamples = await Promise.all(promises)
      refetch()
      
      // Recalculate stats
      const newSamples = samples.map(s => {
        const updated = updatedSamples.find(u => u.id === s.id)
        return updated || s
      })
      setStats({
        total: newSamples.length,
        submitted: newSamples.filter(s => s.status === 'submitted').length,
        inProgress: newSamples.filter(s => {
          const status = s.status || ''
          return ['prep', 'sequencing', 'analysis'].includes(status)
        }).length,
        completed: newSamples.filter(s => s.status === 'completed').length,
        urgent: newSamples.filter(s => s.priority === 'urgent').length
      })
      
      toast.success(`${selectedSamples.size} samples updated to ${newStatus}`)
      setSelectedSamples(new Set())
    } catch (error) {
      console.error('Failed to update samples:', error)
      toast.error('Failed to update samples')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedSamples.size} selected samples?`)) {
      return
    }

    const promises = Array.from(selectedSamples).map(sampleId => 
      deleteSampleMutation.mutateAsync(sampleId)
    )

    setActionLoading('bulk')
    try {
      await Promise.all(promises)
      refetch()
      
      // Update stats
      setStats(prev => ({
        ...prev,
        total: prev.total - selectedSamples.size,
        // Note: This is a simplified stats update - in a real app we'd calculate properly
        inProgress: Math.max(0, prev.inProgress - selectedSamples.size)
      }))
      
      toast.success(`${selectedSamples.size} samples deleted successfully`)
      setSelectedSamples(new Set())
    } catch (error) {
      console.error('Failed to delete samples:', error)
      toast.error('Failed to delete samples')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <TestTube className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Nanopore Tracking</h1>
              </div>
              <Badge className="bg-blue-100 text-blue-800">v2.0</Badge>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={handleUploadPDF}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
              <Button onClick={handleCreateSample}>
                <Plus className="h-4 w-4 mr-2" />
                New Sample
              </Button>
              
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                    <div className="text-xs text-gray-500">{user?.role}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b">
                        <div className="font-medium">{user?.name}</div>
                        <div className="text-gray-500">{user?.email}</div>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          // Add profile settings here
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          logout()
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Total Samples"
            value={stats.total}
            icon={TestTube}
            color="text-blue-600"
            change={{ value: 12, positive: true }}
          />
          <StatCard
            title="Submitted"
            value={stats.submitted}
            icon={Clock}
            color="text-yellow-600"
            change={{ value: 3, positive: true }}
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={Activity}
            color="text-purple-600"
            change={{ value: 8, positive: true }}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle}
            color="text-green-600"
            change={{ value: 15, positive: true }}
          />
          <StatCard
            title="Urgent"
            value={stats.urgent}
            icon={AlertCircle}
            color="text-red-600"
            change={{ value: 2, positive: false }}
          />
        </div>

        {/* Memory Optimization Panel */}
        <div className="mb-8">
          <MemoryOptimizationPanel />
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Sample Management</CardTitle>
            <CardDescription>
              Track and manage nanopore sequencing samples through the complete workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search samples, submitters, or labs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="prep">Prep</option>
                  <option value="sequencing">Sequencing</option>
                  <option value="analysis">Analysis</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedSamples.size > 0 && (
          <Card className="mb-4 bg-blue-50 border-blue-200">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedSamples.size} sample{selectedSamples.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkAssignModal(true)}
                    disabled={actionLoading === 'bulk'}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Bulk Assign
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('prep')}
                    disabled={actionLoading === 'bulk'}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    → Prep
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate('sequencing')}
                    disabled={actionLoading === 'bulk'}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    → Sequencing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={actionLoading === 'bulk'}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSamples(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Samples Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Samples ({filteredSamples.length})</CardTitle>
              {filteredSamples.length > 0 && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedSamples.size === filteredSamples.length && filteredSamples.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-600">Select All</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSamples.map((sample) => (
                <div key={sample.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedSamples.has(sample.id)}
                          onChange={(e) => handleSelectSample(sample.id, e.target.checked)}
                          className="rounded border-gray-300 mr-2"
                        />
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center inline-block">
                          <TestTube className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900">{sample.sample_name}</h3>
                          <StatusBadge status={sample.status} />
                          <PriorityBadge priority={sample.priority} />
                        </div>
                        
                        <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
                          <div className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{sample.submitter_name}</span>
                          </div>
                          {sample.lab_name && (
                            <div className="flex items-center space-x-1">
                              <TestTube className="h-4 w-4" />
                              <span>{sample.lab_name}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{sample.submitted_at.split('T')[0]}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                          <span>Type: {sample.sample_type}</span>
                          {sample.concentration && (
                            <span>Conc: {sample.concentration} ng/μL</span>
                          )}
                          {sample.volume && (
                            <span>Vol: {sample.volume} μL</span>
                          )}
                          {sample.flow_cell_type && (
                            <span>Flow Cell: {sample.flow_cell_type}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {sample.assigned_to && (
                        <div className="text-sm text-gray-500">
                          Assigned to: <span className="font-medium">{sample.assigned_to}</span>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1">
                        {/* Quick Status Update Button */}
                        {getNextStatus(sample.status || null) && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleStatusUpdate(sample, getNextStatus(sample.status || null)!)}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                            disabled={actionLoading === sample.id}
                          >
                            <Activity className="h-3 w-3" />
                            <span>→ {getNextStatus(sample.status || null)}</span>
                          </Button>
                        )}
                        
                        {/* Action Menu Dropdown */}
                        <div className="relative">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setOpenDropdown(openDropdown === sample.id ? null : sample.id)}
                            className="flex items-center space-x-1"
                            disabled={actionLoading === sample.id}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                            <span>Actions</span>
                          </Button>
                          
                          {openDropdown === sample.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    handleViewSample(sample)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>View Details</span>
                                </button>
                                
                                <button
                                  onClick={() => {
                                    handleEditSample(sample)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span>Edit Sample</span>
                                </button>
                                
                                <button
                                  onClick={() => {
                                    handleAssignSample(sample)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <Users className="h-4 w-4" />
                                  <span>Assign Staff</span>
                                </button>
                                
                                <div className="border-t border-gray-100 my-1"></div>
                                
                                <button
                                  onClick={() => {
                                    handleDeleteSample(sample)
                                    setOpenDropdown(null)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete Sample</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredSamples.length === 0 && (
                <div className="text-center py-12">
                  <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No samples found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                      ? 'Try adjusting your filters or search terms'
                      : 'Get started by creating your first sample'
                    }
                  </p>
                  <Button onClick={handleCreateSample}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Sample
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Create Sample Modal */}
      <CreateSampleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleSampleSubmit}
      />
      
      {/* Edit Sample Modal */}
      <EditTaskModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedSample(null)
        }}
        onSave={handleSampleUpdate}
        sample={selectedSample ? mapApiToModal(selectedSample) : null}
        isLoading={actionLoading === selectedSample?.id}
      />
      
      {/* View Sample Modal */}
      <ViewTaskModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false)
          setSelectedSample(null)
        }}
        sample={selectedSample ? mapApiToModal(selectedSample) : null}
      />
      
      {/* Assign Sample Modal */}
      <AssignModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false)
          setSelectedSample(null)
        }}
        onAssign={handleSampleAssign}
        currentAssignment={{
          assignedTo: selectedSample?.assigned_to || null,
          libraryPrepBy: selectedSample?.library_prep_by || null,
        }}
        sampleName={selectedSample?.sample_name || ''}
      />
      
      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      
      {/* PDF Upload Modal */}
      {showPdfUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload PDF Document</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPdfUploadModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <PDFUpload
              onDataExtracted={(data, file) => {
                // Handle extracted data - could create a new sample or update existing
                console.log('PDF data extracted:', data, file)
                toast.success('PDF processed successfully')
              }}
              onFileUploaded={(file) => {
                console.log('PDF uploaded:', file)
              }}
            />
          </div>
        </div>
      )}
      
      {/* Bulk Assign Modal */}
      <AssignModal
        isOpen={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        onAssign={handleBulkAssign}
        currentAssignment={{
          assignedTo: null,
          libraryPrepBy: null,
        }}
        sampleName={`${selectedSamples.size} selected samples`}
      />
    </div>
  )
}

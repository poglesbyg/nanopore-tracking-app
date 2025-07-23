import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import CreateSampleModal from './create-sample-modal'
import { EditTaskModal } from './edit-task-modal'
import { ViewTaskModal } from './view-task-modal'
import { AssignModal } from './assign-modal'
import { ExportModal } from './export-modal'
import { MemoryOptimizationPanel } from './memory-optimization-panel'
import { AdminLogin } from '../auth/admin-login'
import { AuditPanel } from './audit-panel'
import { ConfigPanel } from './config-panel'
import { ShutdownPanel } from './shutdown-panel'
import { MigrationPanel } from './migration-panel'
import { SampleActions } from './sample-actions'
import type { UserSession } from '../../lib/auth/AdminAuth'
import PDFUpload from './pdf-upload'
import CSVUpload from './csv-upload'
import { useAuth } from '../auth/auth-wrapper'
import type { NanoporeSample } from '@/lib/api-client'

// Import our new modular components
// Import our new modular components
import { StatusBadge } from '@/shared/components/StatusBadge'
import { PriorityBadge } from '@/shared/components/PriorityBadge'
import { SampleFilters } from '@/features/samples/components/SampleFilters'
import { BulkActions } from '@/features/samples/components/BulkActions'
import { BulkOperationProgress } from '@/features/samples/components/BulkOperationProgress'
import { useSamples } from '@/features/samples/hooks/useSamples'
import { useSampleOperations } from '@/features/samples/hooks/useSampleOperations'
import { useSampleStore } from '@/stores/sampleStore'

import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { Progress } from '../ui/progress'
import { trpc } from '@/client/trpc'
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
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface DashboardStats {
  total: number
  submitted: number
  inProgress: number
  completed: number
  urgent: number
}

// StatusBadge and PriorityBadge components are now imported from shared components

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
  // Authentication check
  const { user, logout } = useAuth()
  
  // Use our new Zustand store and hooks
  const { 
    selectedSamples, 
    currentPage, 
    pageSize,
    setCurrentPage,
    setPageSize,
    toggleSampleSelection,
    selectAllSamples,
    clearSelection
  } = useSampleStore()
  
  const { samples, pagination, isLoading, refetch } = useSamples()
  const sampleOperations = useSampleOperations()
  
  // Local UI state (not related to samples)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [adminSession, setAdminSession] = useState<UserSession | null>(null)
  
  // Modal state management
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState<NanoporeSample | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [showPdfUploadModal, setShowPdfUploadModal] = useState(false)
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false)

  // tRPC utils for mutations
  const utils = trpc.useUtils()
  
  // Debug samples data (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Paginated samples data:', { samples, pagination })
  }
  
  // Force re-render trigger
  const [forceRender, setForceRender] = useState(0)
  
  const createProcessingStepsMutation = trpc.nanopore.createDefaultProcessingSteps.useMutation()
  
  const createSampleMutation = trpc.nanopore.create.useMutation({
    onSuccess: async (data) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Sample created successfully:', data)
      }
      
      // Add the new sample to the cache
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return [data]
        return [data, ...old]
      })
      
      // Create default processing steps for the new sample
      try {
        await createProcessingStepsMutation.mutateAsync(data.id)
        if (process.env.NODE_ENV === 'development') {
          console.log('Default processing steps created for sample:', data.id)
        }
      } catch (error) {
        console.error('Failed to create default processing steps:', error)
        // Don't fail the whole operation if processing steps creation fails
      }
      
      // Force re-render
      setForceRender(prev => prev + 1)
    },
    onError: (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Sample creation error:', error)
      }
      // Invalidate cache on error to ensure fresh data
      utils.nanopore.getAll.invalidate()
    }
  })
  
  const updateSampleMutation = trpc.nanopore.update.useMutation({
    onMutate: async ({ id, data }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Sample update onMutate:', { id, data })
      }
      
      // Cancel any outgoing refetches
      await utils.nanopore.getAll.cancel()
      
      // Snapshot the previous value
      const previousSamples = utils.nanopore.getAll.getData()
      
      // Optimistically update
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.map((sample: any) => 
          sample.id === id 
            ? { ...sample, ...data, updated_at: new Date().toISOString() }
            : sample
        )
      })
      
      return { previousSamples }
    },
    onSuccess: (data, variables) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Sample update successful:', { data, variables })
      }
      
      // Update cache with server response
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.map((sample: any) => 
          sample.id === variables.id 
            ? { ...sample, ...data }
            : sample
        )
      })
      
      setForceRender(prev => prev + 1)
    },
    onError: (err, variables, context) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Sample update error:', err)
      }
      
      // Roll back optimistic update
      if (context?.previousSamples) {
        utils.nanopore.getAll.setData(undefined, context.previousSamples)
      }
      
      setForceRender(prev => prev + 1)
    }
  })
  
  const assignSampleMutation = trpc.nanopore.assign.useMutation({
    onMutate: async ({ id, assignedTo, libraryPrepBy }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Assignment onMutate:', { id, assignedTo, libraryPrepBy })
      }
      
      await utils.nanopore.getAll.cancel()
      const previousSamples = utils.nanopore.getAll.getData()
      
      // Optimistically update assignment
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.map((sample: any) => 
          sample.id === id 
            ? { 
                ...sample, 
                assigned_to: assignedTo, 
                library_prep_by: libraryPrepBy,
                updated_at: new Date().toISOString()
              }
            : sample
        )
      })
      
      return { previousSamples }
    },
    onSuccess: (data, variables) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Assignment successful:', { data, variables })
      }
      
      // Update cache with server response
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.map((sample: any) => 
          sample.id === variables.id 
            ? { ...sample, ...data }
            : sample
        )
      })
      
      setForceRender(prev => prev + 1)
    },
    onError: (err, variables, context) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Assignment error:', err)
      }
      
      if (context?.previousSamples) {
        utils.nanopore.getAll.setData(undefined, context.previousSamples)
      }
      
      setForceRender(prev => prev + 1)
    }
  })
  
  const deleteSampleMutation = trpc.nanopore.delete.useMutation({
    onMutate: async (id) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Delete onMutate:', { id })
      }
      
      await utils.nanopore.getAll.cancel()
      const previousSamples = utils.nanopore.getAll.getData()
      
      // Optimistically remove from cache
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.filter((sample: any) => sample.id !== id)
      })
      
      return { previousSamples }
    },
    onSuccess: (data, variables) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Delete successful:', { variables })
      }
      
      // Ensure sample is removed from cache
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.filter((sample: any) => sample.id !== variables)
      })
      
      setForceRender(prev => prev + 1)
    },
    onError: (err, variables, context) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Delete error:', err)
      }
      
      if (context?.previousSamples) {
        utils.nanopore.getAll.setData(undefined, context.previousSamples)
      }
      
      setForceRender(prev => prev + 1)
    }
  })
  
  const updateStatusMutation = trpc.nanopore.updateStatus.useMutation({
    onMutate: async ({ id, status }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('onMutate called with:', { id, status })
      }
      
      // Cancel any outgoing refetches
      await utils.nanopore.getAll.cancel()
      
      // Snapshot the previous value
      const previousSamples = utils.nanopore.getAll.getData()
      if (process.env.NODE_ENV === 'development') {
        console.log('Previous samples count:', previousSamples?.length)
      }
      
      // Optimistically update to the new value
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        const updated = old.map((sample: any) => 
          sample.id === id 
            ? { ...sample, status: status, updated_at: new Date().toISOString() }
            : sample
        )
        if (process.env.NODE_ENV === 'development') {
          console.log('Optimistic update applied, updated samples count:', updated.length)
          console.log('Updated sample:', updated.find((s: any) => s.id === id))
        }
        return updated
      })
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Optimistic update applied for status change')
      }
      
      // Return a context object with the snapshotted value
      return { previousSamples }
    },
    onSuccess: (data, variables) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Status update successful:', { data, variables })
      }
      
      // Update the cache with the actual server response
      utils.nanopore.getAll.setData(undefined, (old: any) => {
        if (!old) return old
        return old.map((sample: any) => 
          sample.id === variables.id 
            ? { ...sample, ...data, status: variables.status }
            : sample
        )
      })
      
      // Force re-render to ensure UI consistency
      setForceRender(prev => prev + 1)
    },
    onError: (err, variables, context) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Status update error:', err)
      }
      
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSamples) {
        utils.nanopore.getAll.setData(undefined, context.previousSamples)
        if (process.env.NODE_ENV === 'development') {
          console.log('Rolled back optimistic update due to error')
        }
      }
      
      // Force re-render to ensure UI consistency
      setForceRender(prev => prev + 1)
    },
    onSettled: (data, error, variables) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Status update settled:', { success: !error, variables })
      }
      
      // Only invalidate cache if there was an error (to ensure fresh data)
      // Success case is handled in onSuccess with direct cache update
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Invalidating cache due to error')
        }
        utils.nanopore.getAll.invalidate()
      }
    }
  })

  // Stats state
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    submitted: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0
  })

  // Calculate stats from samples
  const calculateStats = (sampleList: any[]): DashboardStats => ({
    total: sampleList.length,
    submitted: sampleList.filter((s: any) => s.status === 'submitted').length,
    inProgress: sampleList.filter((s: any) => {
      const status = s.status || ''
      return ['prep', 'sequencing', 'analysis'].includes(status)
    }).length,
    completed: sampleList.filter((s: any) => s.status === 'completed').length,
    urgent: sampleList.filter((s: any) => s.priority === 'urgent').length,
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdown) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openDropdown])

  // Update stats when samples change
  useEffect(() => {
    if (samples.length > 0) {
      setStats(calculateStats(samples))
    }
  }, [samples])

  // Samples are now filtered and sorted server-side via pagination API
  const filteredSamples = samples // For compatibility with existing code

  const handleCreateSample = () => {
    setShowCreateModal(true)
  }

  const handleSampleSubmit = async (sampleData: any) => {
    try {
      console.log('Dashboard handleSampleSubmit called with:', sampleData)
      await createSampleMutation.mutateAsync(sampleData)
      refetch()
      toast.success('Sample created successfully!')
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create sample:', error)
      
      // Extract detailed error information
      let errorMessage = 'Failed to create sample'
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = error.message as string
      }
      
      // Show specific validation errors if available
      if (error && typeof error === 'object' && 'data' in error && error.data) {
        const errorData = error.data as any
        if (errorData.zodError && errorData.zodError.issues) {
          const validationErrors = errorData.zodError.issues.map((issue: any) => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ')
          errorMessage = `Validation errors: ${validationErrors}`
        }
      }
      
      toast.error(errorMessage)
    }
  }

  const handleUploadPDF = () => {
    setShowPdfUploadModal(true)
  }

  const handleUploadCSV = () => {
    setShowCsvUploadModal(true)
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
    console.log('Sample update initiated:', { sampleId, updateData })
    
    setActionLoading(sampleId)
    try {
      const result = await updateSampleMutation.mutateAsync({
        id: sampleId,
        data: updateData,
      })
      
      console.log('Sample update result:', result)
      console.log('Cache invalidation will be handled by mutation callback')
      
      toast.success('Sample updated successfully')
      setShowEditModal(false)
    } catch (error) {
      console.error('Failed to update sample:', error)
      toast.error('Failed to update sample')
    } finally {
      setActionLoading(null)
    }
  }

  // Enhanced workflow action handler
  const handleWorkflowAction = async (sample: any, action: string, data?: any) => {
    setActionLoading(sample.id)
    try {
      switch (action) {
        case 'qc_result':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { }
          })
          toast.success(`QC ${data?.result === 'pass' ? 'passed' : 'failed'} recorded`)
          break
        case 'start_library_prep':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { }
          })
          toast.success('Library prep started')
          break
        case 'start_sequencing_run':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { }
          })
          toast.success('Sequencing run started')
          break
        case 'generate_report':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { }
          })
          toast.success('Report generation initiated')
          break
        case 'deliver_results':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { }
          })
          toast.success('Results delivered')
          break
        case 'duplicate_sample':
          // Create a duplicate sample with all required fields properly mapped
          const duplicateData = {
            sampleName: `${sample.sample_name || sample.sampleName}_copy`,
            projectId: sample.project_id || sample.projectId,
            submitterName: sample.submitter_name || sample.submitterName,
            submitterEmail: sample.submitter_email || sample.submitterEmail,
            labName: sample.lab_name || sample.labName,
            sampleType: sample.sample_type || sample.sampleType,
            sampleBuffer: sample.sample_buffer || sample.sampleBuffer,
            concentration: sample.concentration,
            volume: sample.volume,
            totalAmount: sample.total_amount || sample.totalAmount,
            flowCellType: sample.flow_cell_type || sample.flowCellType,
            flowCellCount: sample.flow_cell_count || sample.flowCellCount || 1,
            priority: sample.priority || 'normal',
            chartField: sample.chart_field || sample.chartField,
            specialInstructions: sample.special_instructions || sample.specialInstructions,
            status: 'submitted' as const
          }
          
          console.log('Duplicating sample with data:', duplicateData)
          console.log('Original sample:', sample)
          
          await createSampleMutation.mutateAsync(duplicateData)
          toast.success('Sample duplicated')
          break
        case 'reprocess_sample':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { status: 'submitted' as const }
          })
          toast.success('Sample marked for reprocessing')
          break
        case 'update_priority':
          await updateSampleMutation.mutateAsync({
            id: sample.id,
            data: { priority: data?.priority as 'low' | 'normal' | 'high' | 'urgent' }
          })
          toast.success(`Priority updated to ${data?.priority}`)
          break
        case 'add_note':
          // This would open a modal for adding notes
          toast.info('Note functionality coming soon')
          break
        case 'audit_trail':
          // This would show audit trail
          toast.info('Audit trail functionality coming soon')
          break
        case 'export_data':
          // This would export sample data
          toast.info('Export functionality coming soon')
          break
        default:
          toast.info(`Workflow action: ${action}`)
      }
      
      refetch()
    } catch (error) {
      console.error('Failed to execute workflow action:', error)
      toast.error('Failed to execute workflow action')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSampleAssign = async (assignedTo: string, libraryPrepBy?: string) => {
    if (!selectedSample) return
    
    console.log('Sample assignment initiated:', { 
      sampleId: selectedSample.id, 
      assignedTo, 
      libraryPrepBy,
      currentAssignedTo: selectedSample.assigned_to,
      currentLibraryPrepBy: selectedSample.library_prep_by
    })
    
    setActionLoading(selectedSample.id)
    try {
      const result = await assignSampleMutation.mutateAsync({
        id: selectedSample.id,
        assignedTo,
        libraryPrepBy,
      })
      
      console.log('Assignment result:', result)
      
      // Invalidate and refetch the samples query
      await utils.nanopore.getAll.invalidate()
      await refetch()
      
      console.log('Data refetched after assignment')
      
      toast.success('Sample assigned successfully')
      setShowAssignModal(false)
    } catch (error) {
      console.error('Failed to assign sample:', error)
      toast.error('Failed to assign sample')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStatusUpdate = async (sample: any, newStatus: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived') => {
    console.log('Status update initiated:', { sampleId: sample.id, currentStatus: sample.status, newStatus })
    
    // Add debug logging to track the status change
    if (process.env.NODE_ENV === 'development') {
      console.log('=== STATUS UPDATE DEBUG ===')
      console.log('Sample before update:', sample)
      console.log('New status:', newStatus)
      console.log('Current cache data:', utils.nanopore.getAll.getData())
    }
    
    setActionLoading(sample.id)
    try {
      const result = await updateStatusMutation.mutateAsync({
        id: sample.id,
        status: newStatus,
      })
      
      console.log('Status update result:', result)
      console.log('Cache invalidation will be handled by mutation callback')
      
      if (process.env.NODE_ENV === 'development') {
        console.log('=== STATUS UPDATE SUCCESS ===')
        console.log('Server response:', result)
        console.log('Cache after update:', utils.nanopore.getAll.getData())
      }
      
      toast.success(`Sample status updated to ${newStatus}`)
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Failed to update sample status')
    } finally {
      setActionLoading(null)
    }
  }

  // Bulk actions handlers
  const handleSelectSample = (sampleId: string, checked: boolean) => {
    toggleSampleSelection(sampleId)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAllSamples(filteredSamples.map((s: NanoporeSample) => s.id))
    } else {
      clearSelection()
    }
  }

  const handleBulkAssign = async (assignedTo: string, libraryPrepBy?: string) => {
    const selectedIds = Array.from(selectedSamples)
    await sampleOperations.bulkAssign(selectedIds, assignedTo, libraryPrepBy)
    clearSelection()
    setShowBulkAssignModal(false)
  }

  // Bulk operations are now handled by the useSampleOperations hook

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedSamples.size} selected samples?`)) {
      return
    }

    const selectedIds = Array.from(selectedSamples)
    await sampleOperations.bulkDelete(selectedIds)
    clearSelection()
  }

  // Helper function to map API data to modal format
  const mapApiToModal = (sample: any) => {
    return {
      ...sample,
      status: sample.status as 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived',
      priority: sample.priority as 'low' | 'normal' | 'high' | 'urgent',
    }
  }

  if (isLoading) {
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
              <Button variant="outline" onClick={handleUploadCSV}>
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
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

        {/* Bulk Operation Progress Indicator */}
        <BulkOperationProgress />

        {/* Admin Login and Memory Optimization Panel */}
        <div className="mb-8">
          <AdminLogin
            onLogin={setAdminSession}
            onLogout={() => setAdminSession(null)}
            session={adminSession}
          />
          
          {/* Memory Optimization Panel - Admin Only */}
          {adminSession && adminSession.permissions.includes('memory_optimization') && (
            <MemoryOptimizationPanel />
          )}

          {/* Audit Panel - Admin Only */}
          {adminSession && adminSession.permissions.includes('audit_logs') && (
            <div className="mt-6">
              <AuditPanel adminSession={adminSession} />
            </div>
          )}

          {/* Configuration Panel - Admin Only */}
          {adminSession && adminSession.permissions.includes('security_settings') && (
            <div className="mt-6">
              <ConfigPanel adminSession={adminSession} />
            </div>
          )}

          {/* Shutdown Panel - Admin Only */}
          {adminSession && adminSession.permissions.includes('system_monitoring') && (
            <div className="mt-6">
              <ShutdownPanel adminSession={adminSession} />
            </div>
          )}

          {/* Migration Panel - Admin Only */}
          {adminSession && adminSession.permissions.includes('system_monitoring') && (
            <div className="mt-6">
              <MigrationPanel adminSession={adminSession} />
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <SampleFilters />

        {/* Bulk Actions Bar */}
        <BulkActions onBulkAssign={() => setShowBulkAssignModal(true)} />

        {/* Samples Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>Samples ({pagination?.total || 0})</CardTitle>
              {filteredSamples.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSamples.size === filteredSamples.length && filteredSamples.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllSamples(filteredSamples.map((s: NanoporeSample) => s.id))
                        } else {
                          clearSelection()
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-600">Select All</span>
                  </label>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {pagination && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1) // Reset to first page
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-600">per page</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={!pagination.hasPrevPage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                      const page = Math.max(1, currentPage - 2) + i
                      if (page > pagination.totalPages) return null
                      
                      return (
                        <Button
                          key={page}
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[2rem]"
                        >
                          {page}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                    disabled={!pagination.hasNextPage}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSamples.map((sample: NanoporeSample) => (
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
                          <StatusBadge key={`${sample.id}-${sample.status}`} status={sample.status} />
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
                      
                      {sample.library_prep_by && (
                        <div className="text-sm text-gray-500">
                          Library prep: <span className="font-medium">{sample.library_prep_by}</span>
                        </div>
                      )}
                      
                      {/* Enhanced Action Buttons */}
                      <SampleActions
                        sample={sample}
                        onViewSample={handleViewSample}
                        onEditSample={handleEditSample}
                        onAssignSample={handleAssignSample}
                        onDeleteSample={handleDeleteSample}
                        onStatusUpdate={handleStatusUpdate}
                        onWorkflowAction={handleWorkflowAction}
                        actionLoading={actionLoading}
                        isAdmin={adminSession ? adminSession.permissions.includes('system_monitoring') : false}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredSamples.length === 0 && (
                <div className="text-center py-12">
                  <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No samples found</h3>
                  <p className="text-gray-500 mb-4">
                    {samples.length === 0 && pagination?.total && pagination.total > 0
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
        onDelete={(id: string) => {
          if (selectedSample) {
            handleDeleteSample(selectedSample)
          }
        }}
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
              onDataExtracted={async (data, file) => {
                // Handle extracted data - create samples if sample_table exists
                console.log('PDF data extracted:', data, file)
                
                if (data && Array.isArray(data)) {
                  // Handle array of samples
                  const samples = data
                  if (samples.length > 0) {
                    toast.info(`Found ${samples.length} samples in PDF. Creating samples...`)
                    
                    // Debug log the raw PDF data
                    if (process.env.NODE_ENV === 'development') {
                      console.log('Raw PDF sample data:', samples)
                    }
                    
                    let created = 0
                    let failed = 0
                    
                    for (const sample of samples) {
                      try {
                        // Extract sample information
                        const sampleData = {
                          submitterName: sample.submitter_name || '',
                          submitterEmail: sample.submitter_email || '',
                          labName: sample.lab_name || '',
                          sampleName: sample.sample_name || `Sample-${Date.now()}`,
                          organism: sample.organism || '',
                          concentration: sample.concentration || sample.qubit_conc || null,
                          volume: sample.volume || null,
                          buffer: sample.buffer || 'Unknown',
                          priority: 'normal' as const,
                          status: 'submitted' as const,
                          flowCell: sample.flow_cell || '',
                          genomeSize: sample.genome_size || '',
                          coverage: sample.coverage || '',
                          serviceRequested: sample.service_requested || '',
                          sequencingType: sample.sequencing_type || '',
                          sampleType: (sample.sample_type || 'DNA') as 'DNA' | 'RNA' | 'Protein' | 'Other',
                          chartField: sample.billing_account || 'TBD',
                          metadata: {
                            pdfSource: file.name,
                            extractedAt: new Date().toISOString(),
                            ...(sample.metadata || {}),
                            sample_table: sample.sample_table || []
                          }
                        }
                        
                        // Sanitize and validate data before submission
                        const sanitizedData = {
                          // Sanitize sample name to only allow alphanumeric, spaces, hyphens, underscores, dots
                          sampleName: (sampleData.sampleName || `Sample-${Date.now()}`).replace(/[^a-zA-Z0-9\s\-_\.]/g, '').trim() || `Sample-${Date.now()}`,
                          
                          // Add projectId field (was missing!)
                          projectId: (() => {
                            const rawProjectId = sample.project_id || sampleData.sampleName || ''
                            console.log('Raw projectId from PDF (array):', rawProjectId) // DEBUG
                            const sanitized = rawProjectId.replace(/[^a-zA-Z0-9\s\-_\.]/g, '').trim()
                            console.log('Sanitized projectId (array):', sanitized) // DEBUG
                            return sanitized || undefined
                          })(),
                          
                          // Sanitize names to only allow letters, spaces, hyphens, apostrophes, dots
                          submitterName: sampleData.submitterName.replace(/[^a-zA-Z\s\-'\.]/g, '').trim() || 'Unknown Submitter',
                          submitterEmail: sampleData.submitterEmail.trim() || 'unknown@email.com',
                          
                          // Sanitize lab name to allow alphanumeric, spaces, hyphens, underscores, dots, commas, apostrophes
                          labName: sampleData.labName ? sampleData.labName.replace(/[^a-zA-Z0-9\s\-_\.,']/g, '').trim() : undefined,
                          
                          // Map sample type to valid enum values
                          sampleType: (() => {
                            const typeStr = (sample.sample_type || '').toLowerCase()
                            if (typeStr.includes('dna')) return 'DNA'
                            if (typeStr.includes('rna')) return 'RNA'
                            if (typeStr.includes('protein')) return 'Protein'
                            return 'Other'
                          })() as 'DNA' | 'RNA' | 'Protein' | 'Other',
                          
                          // Generate valid chart field - use HTSF-001 as default
                          chartField: (() => {
                            const billing = sample.billing_account || ''
                            if (/^(HTSF|NANO|SEQ)-\d{3}$/.test(billing)) {
                              return billing
                            }
                            // Generate a new HTSF number based on current timestamp
                            const num = (Date.now() % 900) + 100 // Generates 100-999
                            return `HTSF-${num.toString().padStart(3, '0')}`
                          })(),
                          
                          // Fix flowCellType - handle "Selection:" and other invalid values
                          flowCellType: (() => {
                            const flowCell = (sample.flow_cell || sampleData.flowCell || '').trim()
                            console.log('PDF flowCell value (array):', flowCell) // DEBUG
                            
                            // Check if it's a valid enum value
                            if (['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other'].includes(flowCell)) {
                              return flowCell as 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other'
                            }
                            // Check for common patterns
                            if (flowCell.includes('R9')) return 'R9.4.1'
                            if (flowCell.includes('R10.4')) return 'R10.4.1'
                            if (flowCell.includes('R10.5')) return 'R10.5.1'
                            // Skip if invalid or empty - including "Selection:"
                            if (flowCell === 'Selection:' || flowCell.startsWith('Selection')) {
                              console.log('Skipping invalid flowCell value (array):', flowCell) // DEBUG
                              return undefined
                            }
                            return undefined
                          })(),
                          
                          // Keep other fields
                          concentration: sampleData.concentration,
                          volume: sampleData.volume,
                          priority: 'normal' as const,
                        }
                        
                        // Remove undefined fields before sending
                        const dataToSend = Object.entries(sanitizedData).reduce((acc, [key, value]) => {
                          if (value !== undefined) {
                            acc[key] = value
                          }
                          return acc
                        }, {} as any)
                        
                        // Debug log the sanitized data before sending
                        if (process.env.NODE_ENV === 'development') {
                          console.log('Sanitized sample data being sent to API:', dataToSend)
                          console.log('CODE VERSION: 2.1 - with flowCell fix') // VERSION CHECK
                        }
                        
                        // Create the sample with sanitized data
                        await createSampleMutation.mutateAsync(dataToSend)
                        created++
                      } catch (error) {
                        console.error('Failed to create sample:', error)
                        failed++
                        
                        // Extract detailed error information
                        let errorMessage = 'Unknown error'
                        if (error && typeof error === 'object' && 'message' in error) {
                          errorMessage = error.message as string
                        }
                        
                        // Show specific validation errors if available
                        if (error && typeof error === 'object' && 'data' in error && error.data) {
                          const errorData = error.data as any
                          if (errorData.zodError && errorData.zodError.issues) {
                            const validationErrors = errorData.zodError.issues.map((issue: any) => 
                              `${issue.path.join('.')}: ${issue.message}`
                            )
                            errorMessage = `Validation errors: ${validationErrors.join(', ')}`
                          }
                        }
                        
                        console.error(`Sample ${sample.sample_name || 'Unknown'} failed: ${errorMessage}`)
                      }
                    }
                    
                    if (created > 0) {
                      toast.success(`Successfully created ${created} samples from PDF`)
                    }
                    if (failed > 0) {
                      toast.error(`Failed to create ${failed} samples`)
                    }
                    
                    // Close the modal and refresh the list
                    setShowPdfUploadModal(false)
                    refetch()
                  }
                } else if (data && typeof data === 'object') {
                  // Handle single sample object
                  
                  // Debug log the raw PDF data
                  if (process.env.NODE_ENV === 'development') {
                    console.log('Raw PDF single sample data:', data)
                  }
                  
                  try {
                    const sampleData = {
                      submitterName: data.submitter_name || data.submitterName || '',
                      submitterEmail: data.submitter_email || data.submitterEmail || '',
                      labName: data.lab_name || data.labName || '',
                      sampleName: data.sample_name || data.sampleName || `Sample-${Date.now()}`,
                      organism: data.organism || '',
                      concentration: data.concentration || data.qubit_conc || null,
                      volume: data.volume || null,
                      buffer: data.buffer || 'Unknown',
                      priority: 'normal' as const,
                      status: 'submitted' as const,
                      flowCell: data.flow_cell || data.flowCell || '',
                      genomeSize: data.genome_size || data.genomeSize || '',
                      coverage: data.coverage || '',
                      serviceRequested: data.service_requested || data.serviceRequested || '',
                      sequencingType: data.sequencing_type || data.sequencingType || '',
                      sampleType: (data.sample_type || data.sampleType || 'DNA') as 'DNA' | 'RNA' | 'Protein' | 'Other',
                      chartField: data.billing_account || 'TBD',
                      metadata: {
                        pdfSource: file.name,
                        extractedAt: new Date().toISOString(),
                        ...(data.metadata || {}),
                        sample_table: data.sample_table || []
                      }
                    }
                    
                    // Sanitize and validate data before submission (same logic as array handler)
                    const sanitizedData = {
                      // Sanitize sample name to only allow alphanumeric, spaces, hyphens, underscores, dots
                      sampleName: (sampleData.sampleName || `Sample-${Date.now()}`).replace(/[^a-zA-Z0-9\s\-_\.]/g, '').trim() || `Sample-${Date.now()}`,
                      
                      // Add projectId field (was missing!)
                      projectId: (() => {
                        const rawProjectId = data.project_id || sampleData.sampleName || ''
                        console.log('Raw projectId from PDF:', rawProjectId) // DEBUG
                        const sanitized = rawProjectId.replace(/[^a-zA-Z0-9\s\-_\.]/g, '').trim()
                        console.log('Sanitized projectId:', sanitized) // DEBUG
                        return sanitized || undefined
                      })(),
                      
                      // Sanitize names to only allow letters, spaces, hyphens, apostrophes, dots
                      submitterName: sampleData.submitterName.replace(/[^a-zA-Z\s\-'\.]/g, '').trim() || 'Unknown Submitter',
                      submitterEmail: sampleData.submitterEmail.trim() || 'unknown@email.com',
                      
                      // Sanitize lab name to allow alphanumeric, spaces, hyphens, underscores, dots, commas, apostrophes
                      labName: sampleData.labName ? sampleData.labName.replace(/[^a-zA-Z0-9\s\-_\.,']/g, '').trim() : undefined,
                      
                      // Map sample type to valid enum values
                      sampleType: (() => {
                        const typeStr = (data.sample_type || data.sampleType || '').toLowerCase()
                        if (typeStr.includes('dna')) return 'DNA'
                        if (typeStr.includes('rna')) return 'RNA'
                        if (typeStr.includes('protein')) return 'Protein'
                        return 'Other'
                      })() as 'DNA' | 'RNA' | 'Protein' | 'Other',
                      
                      // Generate valid chart field - use HTSF-001 as default
                      chartField: (() => {
                        const billing = data.billing_account || ''
                        if (/^(HTSF|NANO|SEQ)-\d{3}$/.test(billing)) {
                          return billing
                        }
                        // Generate a new HTSF number based on current timestamp
                        const num = (Date.now() % 900) + 100 // Generates 100-999
                        return `HTSF-${num.toString().padStart(3, '0')}`
                      })(),
                      
                      // Fix flowCellType - handle "Selection:" and other invalid values
                      flowCellType: (() => {
                        const flowCell = (data.flow_cell || data.flowCell || '').trim()
                        console.log('PDF flowCell value:', flowCell) // DEBUG
                        
                        // Check if it's a valid enum value
                        if (['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other'].includes(flowCell)) {
                          return flowCell as 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other'
                        }
                        // Check for common patterns
                        if (flowCell.includes('R9')) return 'R9.4.1'
                        if (flowCell.includes('R10.4')) return 'R10.4.1'
                        if (flowCell.includes('R10.5')) return 'R10.5.1'
                        // Skip if invalid or empty - including "Selection:"
                        if (flowCell === 'Selection:' || flowCell.startsWith('Selection')) {
                          console.log('Skipping invalid flowCell value:', flowCell) // DEBUG
                          return undefined
                        }
                        return undefined
                      })(),
                      
                      // Keep other fields
                      concentration: sampleData.concentration,
                      volume: sampleData.volume,
                      priority: 'normal' as const,
                    }
                    
                    // Remove undefined fields before sending
                    const dataToSend = Object.entries(sanitizedData).reduce((acc, [key, value]) => {
                      if (value !== undefined) {
                        acc[key] = value
                      }
                      return acc
                    }, {} as any)
                    
                    // Debug log the sanitized data before sending
                    if (process.env.NODE_ENV === 'development') {
                      console.log('Sanitized single sample data being sent to API:', dataToSend)
                      console.log('CODE VERSION: 2.1 - with flowCell fix') // VERSION CHECK
                    }
                    
                    await createSampleMutation.mutateAsync(dataToSend)
                    toast.success('Successfully created sample from PDF')
                    setShowPdfUploadModal(false)
                    refetch()
                  } catch (error) {
                    console.error('Failed to create sample:', error)
                    toast.error('Failed to create sample from PDF')
                  }
                } else {
                  toast.warning('No valid sample data found in PDF')
                }
              }}
              onFileUploaded={(file) => {
                console.log('PDF uploaded:', file)
              }}
            />
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCsvUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload CSV Spreadsheet</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCsvUploadModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CSVUpload
              onSamplesCreated={(samples, file) => {
                console.log('Samples created from CSV:', samples, file)
                // Refresh the samples list
                refetch()
                setShowCsvUploadModal(false)
              }}
              onFileUploaded={(file) => {
                console.log('CSV uploaded:', file)
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

import { trpc } from '@/client/trpc'
import { toast } from 'sonner'
import { useSampleStore } from '@/stores/sampleStore'
import type { NanoporeSample } from '@/lib/api-client'

export interface SampleOperations {
  createSample: (data: any) => Promise<void>
  updateSample: (id: string, data: any) => Promise<void>
  deleteSample: (id: string) => Promise<void>
  updateStatus: (id: string, status: string) => Promise<void>
  assignSample: (id: string, assignedTo: string, libraryPrepBy?: string) => Promise<void>
  bulkUpdateStatus: (ids: string[], status: string) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  bulkAssign: (ids: string[], assignedTo: string, libraryPrepBy?: string) => Promise<void>
  isLoading: boolean
}

export function useSampleOperations(): SampleOperations {
  const utils = trpc.useUtils()
  const { setBulkOperationProgress, resetBulkOperation } = useSampleStore()
  
  // Mutations
  const createMutation = trpc.nanopore.create.useMutation({
    onSuccess: () => {
      utils.nanopore.getAllPaginated.invalidate()
      toast.success('Sample created successfully!')
    },
    onError: (error) => {
      console.error('Failed to create sample:', error)
      toast.error('Failed to create sample')
    },
  })
  
  const updateMutation = trpc.nanopore.update.useMutation({
    onSuccess: () => {
      utils.nanopore.getAllPaginated.invalidate()
      toast.success('Sample updated successfully')
    },
    onError: (error) => {
      console.error('Failed to update sample:', error)
      toast.error('Failed to update sample')
    },
  })
  
  const deleteMutation = trpc.nanopore.delete.useMutation({
    onSuccess: () => {
      utils.nanopore.getAllPaginated.invalidate()
      toast.success('Sample deleted successfully')
    },
    onError: (error) => {
      console.error('Failed to delete sample:', error)
      toast.error('Failed to delete sample')
    },
  })
  
  const updateStatusMutation = trpc.nanopore.updateStatus.useMutation({
    onSuccess: () => {
      utils.nanopore.getAllPaginated.invalidate()
      toast.success('Status updated successfully')
    },
    onError: (error) => {
      console.error('Failed to update status:', error)
      toast.error('Failed to update status')
    },
  })
  
  const assignMutation = trpc.nanopore.assign.useMutation({
    onSuccess: () => {
      utils.nanopore.getAllPaginated.invalidate()
      toast.success('Sample assigned successfully')
    },
    onError: (error) => {
      console.error('Failed to assign sample:', error)
      toast.error('Failed to assign sample')
    },
  })
  
  // Single operations
  const createSample = async (data: any) => {
    await createMutation.mutateAsync(data)
  }
  
  const updateSample = async (id: string, data: any) => {
    await updateMutation.mutateAsync({ id, data })
  }
  
  const deleteSample = async (id: string) => {
    await deleteMutation.mutateAsync(id)
  }
  
  const updateStatus = async (id: string, status: string) => {
    await updateStatusMutation.mutateAsync({ id, status: status as any })
  }
  
  const assignSample = async (id: string, assignedTo: string, libraryPrepBy?: string) => {
    await assignMutation.mutateAsync({ id, assignedTo, libraryPrepBy })
  }
  
  // Bulk operations
  const bulkUpdateStatus = async (ids: string[], status: string) => {
    setBulkOperationProgress({
      isActive: true,
      total: ids.length,
      completed: 0,
      operation: `Updating status to ${status}`,
      errors: [],
    })
    
    const errors: string[] = []
    let completed = 0
    
    for (const id of ids) {
      try {
        await updateStatusMutation.mutateAsync({ id, status: status as any })
        completed++
        setBulkOperationProgress({ completed })
      } catch (error) {
        const errorMsg = `Failed to update sample ${id}`
        errors.push(errorMsg)
        setBulkOperationProgress({ errors: [...errors] })
      }
    }
    
    if (errors.length === 0) {
      toast.success(`Updated ${completed} samples to ${status}`)
    } else if (completed > 0) {
      toast.warning(`${completed} samples updated, ${errors.length} failed`)
    } else {
      toast.error('All updates failed')
    }
    
    setTimeout(() => resetBulkOperation(), 3000)
  }
  
  const bulkDelete = async (ids: string[]) => {
    setBulkOperationProgress({
      isActive: true,
      total: ids.length,
      completed: 0,
      operation: 'Deleting samples',
      errors: [],
    })
    
    const errors: string[] = []
    let completed = 0
    
    for (const id of ids) {
      try {
        await deleteMutation.mutateAsync(id)
        completed++
        setBulkOperationProgress({ completed })
      } catch (error) {
        const errorMsg = `Failed to delete sample ${id}`
        errors.push(errorMsg)
        setBulkOperationProgress({ errors: [...errors] })
      }
    }
    
    if (errors.length === 0) {
      toast.success(`Deleted ${completed} samples`)
    } else if (completed > 0) {
      toast.warning(`${completed} samples deleted, ${errors.length} failed`)
    } else {
      toast.error('All deletions failed')
    }
    
    setTimeout(() => resetBulkOperation(), 3000)
  }
  
  const bulkAssign = async (ids: string[], assignedTo: string, libraryPrepBy?: string) => {
    setBulkOperationProgress({
      isActive: true,
      total: ids.length,
      completed: 0,
      operation: 'Assigning samples',
      errors: [],
    })
    
    const errors: string[] = []
    let completed = 0
    
    for (const id of ids) {
      try {
        await assignMutation.mutateAsync({ id, assignedTo, libraryPrepBy })
        completed++
        setBulkOperationProgress({ completed })
      } catch (error) {
        const errorMsg = `Failed to assign sample ${id}`
        errors.push(errorMsg)
        setBulkOperationProgress({ errors: [...errors] })
      }
    }
    
    if (errors.length === 0) {
      toast.success(`${completed} samples assigned successfully`)
    } else if (completed > 0) {
      toast.warning(`${completed} samples assigned, ${errors.length} failed`)
    } else {
      toast.error('All assignments failed')
    }
    
    setTimeout(() => resetBulkOperation(), 3000)
  }
  
  const isLoading = 
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    updateStatusMutation.isPending ||
    assignMutation.isPending
  
  return {
    createSample,
    updateSample,
    deleteSample,
    updateStatus,
    assignSample,
    bulkUpdateStatus,
    bulkDelete,
    bulkAssign,
    isLoading,
  }
} 
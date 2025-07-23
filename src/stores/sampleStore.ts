import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface SampleFilters {
  search: string
  status: string
  priority: string
  sortBy: 'submittedAt' | 'sampleName' | 'status' | 'priority'
  sortOrder: 'asc' | 'desc'
}

interface BulkOperationProgress {
  isActive: boolean
  total: number
  completed: number
  operation: string
  errors: string[]
}

interface SampleStore {
  // Selection state
  selectedSamples: Set<string>
  
  // Filter state
  filters: SampleFilters
  
  // Pagination state
  currentPage: number
  pageSize: number
  
  // Bulk operation state
  bulkOperationProgress: BulkOperationProgress
  
  // Actions
  toggleSampleSelection: (sampleId: string) => void
  selectAllSamples: (sampleIds: string[]) => void
  clearSelection: () => void
  setFilter: <K extends keyof SampleFilters>(key: K, value: SampleFilters[K]) => void
  setFilters: (filters: Partial<SampleFilters>) => void
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setBulkOperationProgress: (progress: Partial<BulkOperationProgress>) => void
  resetBulkOperation: () => void
}

export const useSampleStore = create<SampleStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      selectedSamples: new Set<string>(),
      
      filters: {
        search: '',
        status: 'all',
        priority: 'all',
        sortBy: 'submittedAt',
        sortOrder: 'desc',
      },
      
      currentPage: 1,
      pageSize: 20,
      
      bulkOperationProgress: {
        isActive: false,
        total: 0,
        completed: 0,
        operation: '',
        errors: [],
      },
      
      // Actions
      toggleSampleSelection: (sampleId) =>
        set((state) => {
          if (state.selectedSamples.has(sampleId)) {
            state.selectedSamples.delete(sampleId)
          } else {
            state.selectedSamples.add(sampleId)
          }
        }),
        
      selectAllSamples: (sampleIds) =>
        set((state) => {
          state.selectedSamples = new Set(sampleIds)
        }),
        
      clearSelection: () =>
        set((state) => {
          state.selectedSamples.clear()
        }),
        
      setFilter: (key, value) =>
        set((state) => {
          state.filters[key] = value
          state.currentPage = 1 // Reset to first page when filter changes
        }),
        
      setFilters: (filters) =>
        set((state) => {
          Object.assign(state.filters, filters)
          state.currentPage = 1
        }),
        
      setCurrentPage: (page) =>
        set((state) => {
          state.currentPage = page
        }),
        
      setPageSize: (size) =>
        set((state) => {
          state.pageSize = size
          state.currentPage = 1 // Reset to first page when page size changes
        }),
        
      setBulkOperationProgress: (progress) =>
        set((state) => {
          Object.assign(state.bulkOperationProgress, progress)
        }),
        
      resetBulkOperation: () =>
        set((state) => {
          state.bulkOperationProgress = {
            isActive: false,
            total: 0,
            completed: 0,
            operation: '',
            errors: [],
          }
        }),
    })),
    {
      name: 'sample-store',
    }
  )
) 
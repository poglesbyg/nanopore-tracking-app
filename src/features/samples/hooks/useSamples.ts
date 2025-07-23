import { useMemo } from 'react'
import { trpc } from '@/client/trpc'
import { useSampleStore } from '@/stores/sampleStore'
import type { NanoporeSample } from '@/lib/api-client'

export interface UseSamplesResult {
  samples: NanoporeSample[]
  isLoading: boolean
  error: any
  refetch: () => void
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  } | undefined
}

export function useSamples(): UseSamplesResult {
  const { filters, currentPage, pageSize } = useSampleStore()
  
  const { data, isLoading, error, refetch } = trpc.nanopore.getAllPaginated.useQuery({
    page: currentPage,
    limit: pageSize,
    search: filters.search || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })
  
  const samples = useMemo(() => data?.data || [], [data])
  const pagination = useMemo(() => data?.pagination, [data])
  
  return {
    samples,
    isLoading,
    error,
    refetch,
    pagination,
  }
} 
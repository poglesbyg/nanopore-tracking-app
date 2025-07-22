import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SampleService } from '../../src/services/implementations/SampleService'
import type { 
  PaginationOptions,
  PaginatedResult,
  Sample
} from '../../src/services/interfaces/ISampleService'
import type { ISampleRepository } from '../../src/services/interfaces/ISampleRepository'
import type { IAuditLogger } from '../../src/services/interfaces/IAuditLogger'
import type { IEventEmitter } from '../../src/services/interfaces/IEventEmitter'

// Mock dependencies
const mockSampleRepository: Partial<ISampleRepository> = {
  search: vi.fn(),
  findAll: vi.fn(),
}

const mockAuditLogger: Partial<IAuditLogger> = {
  log: vi.fn(),
  logSampleCreated: vi.fn(),
  logSampleUpdated: vi.fn(),
  logSampleDeleted: vi.fn(),
}

const mockEventEmitter: Partial<IEventEmitter> = {
  emit: vi.fn(),
  emitSampleCreated: vi.fn(),
  emitSampleUpdated: vi.fn(),
}

// Sample test data
const mockSamples: Sample[] = [
  {
    id: '1',
    sample_name: 'Sample-001',
    project_id: 'PRJ-001',
    submitter_name: 'John Doe',
    submitter_email: 'john@example.com',
    lab_name: 'Test Lab',
    sample_type: 'DNA',
    sample_buffer: null,
    concentration: 100,
    volume: 50,
    total_amount: 5000,
    flow_cell_type: 'R10',
    flow_cell_count: 1,
    status: 'submitted',
    priority: 'normal',
    assigned_to: null,
    library_prep_by: null,
    chart_field: 'NANO-001',
    submitted_at: new Date('2024-01-01'),
    started_at: null,
    completed_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    created_by: 'user1'
  },
  {
    id: '2',
    sample_name: 'Sample-002',
    project_id: 'PRJ-002',
    submitter_name: 'Jane Smith',
    submitter_email: 'jane@example.com',
    lab_name: 'Research Lab',
    sample_type: 'RNA',
    sample_buffer: null,
    concentration: 80,
    volume: 30,
    total_amount: 2400,
    flow_cell_type: 'R9',
    flow_cell_count: 2,
    status: 'prep',
    priority: 'high',
    assigned_to: 'Grey',
    library_prep_by: 'Stephanie',
    chart_field: 'NANO-002',
    submitted_at: new Date('2024-01-02'),
    started_at: new Date('2024-01-02'),
    completed_at: null,
    created_at: new Date('2024-01-02'),
    updated_at: new Date('2024-01-02'),
    created_by: 'user2'
  },
  {
    id: '3',
    sample_name: 'Sample-003',
    project_id: 'PRJ-001',
    submitter_name: 'Bob Wilson',
    submitter_email: 'bob@example.com',
    lab_name: 'Test Lab',
    sample_type: 'DNA',
    sample_buffer: null,
    concentration: 120,
    volume: 40,
    total_amount: 4800,
    flow_cell_type: 'R10',
    flow_cell_count: 1,
    status: 'completed',
    priority: 'urgent',
    assigned_to: 'Jenny',
    library_prep_by: null,
    chart_field: 'NANO-003',
    submitted_at: new Date('2024-01-03'),
    started_at: new Date('2024-01-03'),
    completed_at: new Date('2024-01-04'),
    created_at: new Date('2024-01-03'),
    updated_at: new Date('2024-01-04'),
    created_by: 'user3'
  }
]

describe('SampleService Pagination Tests', () => {
  let sampleService: SampleService

  beforeEach(() => {
    vi.clearAllMocks()
    sampleService = new SampleService(
      mockSampleRepository as ISampleRepository,
      mockAuditLogger as IAuditLogger,
      mockEventEmitter as IEventEmitter
    )
  })

  describe('getAllSamplesPaginated', () => {
    it('should return paginated results with default parameters', async () => {
      // Arrange
      const options: PaginationOptions = { page: 1, limit: 20 }
      ;(mockSampleRepository.search as any).mockResolvedValue(mockSamples)

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result).toEqual({
        data: mockSamples,
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      })
      expect(mockSampleRepository.search).toHaveBeenCalledWith({})
    })

    it('should filter samples based on search criteria', async () => {
      // Arrange
      const options: PaginationOptions = {
        page: 1,
        limit: 10,
        search: 'John',
        status: 'submitted',
        priority: 'normal'
      }
      const filteredSamples = [mockSamples[0]]
      ;(mockSampleRepository.search as any).mockResolvedValue(filteredSamples)

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result.data).toEqual(filteredSamples)
      expect(mockSampleRepository.search).toHaveBeenCalledWith({
        searchTerm: 'John',
        status: 'submitted',
        priority: 'normal'
      })
    })

    it('should handle pagination with multiple pages', async () => {
      // Arrange
      const options: PaginationOptions = { page: 2, limit: 1 }
      ;(mockSampleRepository.search as any).mockResolvedValue(mockSamples)

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('2') // Second sample
      expect(result.pagination).toEqual({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true
      })
    })

    it('should sort samples by sample name ascending', async () => {
      // Arrange
      const options: PaginationOptions = {
        page: 1,
        limit: 10,
        sortBy: 'sampleName',
        sortOrder: 'asc'
      }
      ;(mockSampleRepository.search as any).mockResolvedValue([...mockSamples])

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result.data[0].sample_name).toBe('Sample-001')
      expect(result.data[1].sample_name).toBe('Sample-002')
      expect(result.data[2].sample_name).toBe('Sample-003')
    })

    it('should sort samples by priority descending', async () => {
      // Arrange
      const options: PaginationOptions = {
        page: 1,
        limit: 10,
        sortBy: 'priority',
        sortOrder: 'desc'
      }
      ;(mockSampleRepository.search as any).mockResolvedValue([...mockSamples])

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result.data[0].priority).toBe('urgent')
      expect(result.data[1].priority).toBe('normal')
      expect(result.data[2].priority).toBe('high')
    })

    it('should sort samples by submitted date descending (default)', async () => {
      // Arrange
      const options: PaginationOptions = {
        page: 1,
        limit: 10,
        sortBy: 'submittedAt',
        sortOrder: 'desc'
      }
      ;(mockSampleRepository.search as any).mockResolvedValue([...mockSamples])

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result.data[0].submitted_at.getTime()).toBeGreaterThan(
        result.data[1].submitted_at.getTime()
      )
      expect(result.data[1].submitted_at.getTime()).toBeGreaterThan(
        result.data[2].submitted_at.getTime()
      )
    })

    it('should handle empty results', async () => {
      // Arrange
      const options: PaginationOptions = { page: 1, limit: 10 }
      ;(mockSampleRepository.search as any).mockResolvedValue([])

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      })
    })

    it('should handle page beyond total pages', async () => {
      // Arrange
      const options: PaginationOptions = { page: 5, limit: 10 }
      ;(mockSampleRepository.search as any).mockResolvedValue(mockSamples)

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(result.data).toEqual([])
      expect(result.pagination.hasNextPage).toBe(false)
      expect(result.pagination.hasPrevPage).toBe(true)
    })

    it('should handle search criteria without optional fields', async () => {
      // Arrange
      const options: PaginationOptions = {
        page: 1,
        limit: 10,
        // Only search, no status or priority
        search: 'Sample'
      }
      ;(mockSampleRepository.search as any).mockResolvedValue(mockSamples)

      // Act
      const result = await sampleService.getAllSamplesPaginated(options)

      // Assert
      expect(mockSampleRepository.search).toHaveBeenCalledWith({
        searchTerm: 'Sample'
      })
      expect(result.data).toEqual(mockSamples)
    })
  })
}) 
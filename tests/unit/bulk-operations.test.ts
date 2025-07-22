import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock bulk operation progress functionality
interface BulkOperationProgress {
  isActive: boolean
  total: number
  completed: number
  operation: string
  errors: string[]
}

class BulkOperationManager {
  private progress: BulkOperationProgress = {
    isActive: false,
    total: 0,
    completed: 0,
    operation: '',
    errors: []
  }

  private onProgressUpdate?: (progress: BulkOperationProgress) => void

  constructor(onProgressUpdate?: (progress: BulkOperationProgress) => void) {
    this.onProgressUpdate = onProgressUpdate
  }

  async executeBulkOperation<T>(
    items: T[],
    operation: string,
    processor: (item: T) => Promise<void>
  ): Promise<{ completed: number; errors: string[] }> {
    this.progress = {
      isActive: true,
      total: items.length,
      completed: 0,
      operation,
      errors: []
    }
    this.notifyUpdate()

    let completed = 0
    const errors: string[] = []

    for (let i = 0; i < items.length; i++) {
      try {
        await processor(items[i])
        completed++
        this.progress.completed = completed
        this.notifyUpdate()
      } catch (error) {
        const errorMsg = `Failed to process item ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        this.progress.errors.push(errorMsg)
        this.notifyUpdate()
      }
    }

    this.progress.isActive = false
    this.notifyUpdate()

    return { completed, errors }
  }

  private notifyUpdate() {
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ ...this.progress })
    }
  }

  getProgress(): BulkOperationProgress {
    return { ...this.progress }
  }

  reset() {
    this.progress = {
      isActive: false,
      total: 0,
      completed: 0,
      operation: '',
      errors: []
    }
    this.notifyUpdate()
  }
}

describe('Bulk Operations Progress Tests', () => {
  let bulkOperationManager: BulkOperationManager
  let progressUpdates: BulkOperationProgress[]
  let onProgressUpdate: (progress: BulkOperationProgress) => void

  beforeEach(() => {
    progressUpdates = []
    onProgressUpdate = (progress: BulkOperationProgress) => {
      progressUpdates.push(progress)
    }
    bulkOperationManager = new BulkOperationManager(onProgressUpdate)
  })

  it('should track progress for successful bulk operations', async () => {
    // Arrange
    const items = ['item1', 'item2', 'item3']
    const processor = vi.fn().mockResolvedValue(undefined)

    // Act
    const result = await bulkOperationManager.executeBulkOperation(
      items,
      'Processing items',
      processor
    )

    // Assert
    expect(result).toEqual({
      completed: 3,
      errors: []
    })

    // Check progress updates
    expect(progressUpdates).toHaveLength(5) // Start + 3 updates + end
    
    // Initial progress
    expect(progressUpdates[0]).toEqual({
      isActive: true,
      total: 3,
      completed: 0,
      operation: 'Processing items',
      errors: []
    })

    // Final progress
    expect(progressUpdates[4]).toEqual({
      isActive: false,
      total: 3,
      completed: 3,
      operation: 'Processing items',
      errors: []
    })

    // Verify processor was called for each item
    expect(processor).toHaveBeenCalledTimes(3)
    expect(processor).toHaveBeenCalledWith('item1')
    expect(processor).toHaveBeenCalledWith('item2')
    expect(processor).toHaveBeenCalledWith('item3')
  })

  it('should handle partial failures in bulk operations', async () => {
    // Arrange
    const items = ['item1', 'item2', 'item3']
    const processor = vi.fn()
      .mockResolvedValueOnce(undefined) // item1 succeeds
      .mockRejectedValueOnce(new Error('Item 2 failed')) // item2 fails
      .mockResolvedValueOnce(undefined) // item3 succeeds

    // Act
    const result = await bulkOperationManager.executeBulkOperation(
      items,
      'Processing items',
      processor
    )

    // Assert
    expect(result).toEqual({
      completed: 2,
      errors: ['Failed to process item 1: Item 2 failed']
    })

    // Check final progress includes errors
    const finalProgress = progressUpdates[progressUpdates.length - 1]
    expect(finalProgress.errors).toHaveLength(1)
    expect(finalProgress.errors[0]).toBe('Failed to process item 1: Item 2 failed')
    expect(finalProgress.completed).toBe(2)
  })

  it('should handle complete failure scenario', async () => {
    // Arrange
    const items = ['item1', 'item2']
    const processor = vi.fn().mockRejectedValue(new Error('Processing failed'))

    // Act
    const result = await bulkOperationManager.executeBulkOperation(
      items,
      'Failing operation',
      processor
    )

    // Assert
    expect(result).toEqual({
      completed: 0,
      errors: [
        'Failed to process item 0: Processing failed',
        'Failed to process item 1: Processing failed'
      ]
    })

    // Check final progress
    const finalProgress = progressUpdates[progressUpdates.length - 1]
    expect(finalProgress.completed).toBe(0)
    expect(finalProgress.errors).toHaveLength(2)
    expect(finalProgress.isActive).toBe(false)
  })

  it('should reset progress correctly', () => {
    // Arrange - set some initial progress
    bulkOperationManager['progress'] = {
      isActive: true,
      total: 5,
      completed: 3,
      operation: 'Test operation',
      errors: ['Some error']
    }

    // Act
    bulkOperationManager.reset()

    // Assert
    const progress = bulkOperationManager.getProgress()
    expect(progress).toEqual({
      isActive: false,
      total: 0,
      completed: 0,
      operation: '',
      errors: []
    })

    // Check progress update was called
    expect(progressUpdates).toHaveLength(1)
    expect(progressUpdates[0]).toEqual({
      isActive: false,
      total: 0,
      completed: 0,
      operation: '',
      errors: []
    })
  })

  it('should calculate progress percentage correctly', () => {
    // Test helper function for progress percentage
    const calculateProgressPercentage = (completed: number, total: number): number => {
      if (total === 0) return 0
      return Math.round((completed / total) * 100)
    }

    expect(calculateProgressPercentage(0, 10)).toBe(0)
    expect(calculateProgressPercentage(5, 10)).toBe(50)
    expect(calculateProgressPercentage(10, 10)).toBe(100)
    expect(calculateProgressPercentage(0, 0)).toBe(0)
    expect(calculateProgressPercentage(3, 7)).toBe(43)
  })

  it('should handle empty item array', async () => {
    // Arrange
    const items: string[] = []
    const processor = vi.fn()

    // Act
    const result = await bulkOperationManager.executeBulkOperation(
      items,
      'Empty operation',
      processor
    )

    // Assert
    expect(result).toEqual({
      completed: 0,
      errors: []
    })

    // Should still have progress updates for start and end
    expect(progressUpdates).toHaveLength(2)
    expect(progressUpdates[0].isActive).toBe(true)
    expect(progressUpdates[1].isActive).toBe(false)
    
    // Processor should not be called
    expect(processor).not.toHaveBeenCalled()
  })

  it('should provide immutable progress objects', () => {
    // Arrange
    const items = ['item1']
    const processor = vi.fn().mockResolvedValue(undefined)

    // Act
    bulkOperationManager.executeBulkOperation(items, 'Test', processor)

    // Assert - progress objects should be immutable copies
    const progress1 = bulkOperationManager.getProgress()
    const progress2 = bulkOperationManager.getProgress()
    
    expect(progress1).toEqual(progress2)
    expect(progress1).not.toBe(progress2) // Different object references
    
    // Modifying returned object shouldn't affect internal state
    progress1.completed = 999
    const progress3 = bulkOperationManager.getProgress()
    expect(progress3.completed).not.toBe(999)
  })
}) 
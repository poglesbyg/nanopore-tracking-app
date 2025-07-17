import type { 
  ISampleService, 
  CreateSampleData, 
  UpdateSampleData, 
  Sample, 
  SearchCriteria 
} from '../interfaces/ISampleService'
import type { ISampleRepository } from '../interfaces/ISampleRepository'
import type { IAuditLogger } from '../interfaces/IAuditLogger'
import type { IEventEmitter } from '../interfaces/IEventEmitter'
import { ValidationError, NotFoundError, BusinessLogicError } from '../../middleware/errors/ErrorTypes'
import { getComponentLogger } from '../../lib/logging/StructuredLogger'
import { applicationMetrics } from '../../lib/monitoring/MetricsCollector'
import { withCache, cacheManager } from '../../lib/cache/CacheManager'

export class SampleService implements ISampleService {
  private readonly logger = getComponentLogger('SampleService')

  constructor(
    private readonly sampleRepository: ISampleRepository,
    private readonly auditLogger: IAuditLogger,
    private readonly eventEmitter: IEventEmitter
  ) {}

  async createSample(data: CreateSampleData): Promise<Sample> {
    const timer = this.logger.startTimer('createSample')
    
    this.logger.info('Creating new sample', {
      action: 'create_sample',
      workflowStage: 'validation',
      metadata: {
        sampleName: data.sampleName,
        sampleType: data.sampleType,
        submitterName: data.submitterName
      }
    })
    
    try {
      // Validate required fields
      this.validateCreateData(data)
      
      this.logger.debug('Sample validation passed', {
        action: 'validation_passed',
        metadata: {
          sampleName: data.sampleName
        }
      })
      
      // Create the sample
      const sample = await this.sampleRepository.create(data)
      
      this.logger.info('Sample created successfully', {
        sampleId: sample.id,
        action: 'sample_created',
        workflowStage: 'created',
        metadata: {
          sampleName: sample.sample_name,
          sampleType: sample.sample_type
        }
      })
      
      // Record business metrics
      applicationMetrics.recordSampleCreated(sample.sample_type, sample.priority)
      
      // Log the action
      await this.auditLogger.logSampleCreated(sample.id, sample.created_by, {
        sampleName: data.sampleName,
        submitterName: data.submitterName,
        sampleType: data.sampleType,
      })
      
      // Emit domain event
      this.eventEmitter.emitSampleCreated(sample)
      
      // Invalidate cache
      await this.invalidateSampleCache()
      
      timer()
      return sample
    } catch (error) {
      this.logger.error('Failed to create sample', {
        action: 'create_sample_failed',
        workflowStage: 'error',
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          sampleName: data.sampleName,
          sampleType: data.sampleType
        }
      }, error instanceof Error ? error : undefined)
      
      timer()
      throw error
    }
  }

  async updateSample(id: string, data: UpdateSampleData): Promise<Sample> {
    // Get existing sample for comparison
    const existingSample = await this.sampleRepository.findById(id)
    if (!existingSample) {
      throw new Error('Sample not found')
    }
    
    // Update the sample
    const updatedSample = await this.sampleRepository.update(id, data)
    
    // Calculate changes for audit
    const changes = this.calculateChanges(existingSample, data)
    
    // Log the action
    await this.auditLogger.logSampleUpdated(id, updatedSample.created_by, changes)
    
    // Emit domain event
    this.eventEmitter.emitSampleUpdated(updatedSample, changes)
    
    return updatedSample
  }

  async getSampleById(id: string): Promise<Sample | null> {
    if (!id?.trim()) {
      throw new ValidationError('Sample ID is required', 'id')
    }
    
    return await this.sampleRepository.findById(id)
  }

  async getAllSamples(): Promise<Sample[]> {
    return await withCache(
      'all-samples',
      async () => await this.sampleRepository.findAll(),
      {
        ttl: 300, // 5 minutes
        namespace: 'samples'
      }
    )
  }

  async searchSamples(criteria: SearchCriteria): Promise<Sample[]> {
    return await this.sampleRepository.search(criteria)
  }

  /**
   * Invalidate sample-related cache entries
   */
  private async invalidateSampleCache(): Promise<void> {
    try {
      // Clear all sample-related cache entries
      await cacheManager.clear('samples:*')
      
      this.logger.debug('Sample cache invalidated', {
        action: 'cache_invalidated',
        metadata: {
          pattern: 'samples:*'
        }
      })
    } catch (error) {
      this.logger.warn('Failed to invalidate sample cache', {
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          pattern: 'samples:*'
        }
      })
    }
  }

  async deleteSample(id: string): Promise<{ success: boolean }> {
    if (!id?.trim()) {
      throw new ValidationError('Sample ID is required', 'id')
    }
    
    const existingSample = await this.sampleRepository.findById(id)
    if (!existingSample) {
      throw new NotFoundError('Sample', id)
    }
    
    await this.sampleRepository.delete(id)
    
    // Log the action
    await this.auditLogger.logSampleDeleted(id, existingSample.created_by)
    
    // Emit domain event
    this.eventEmitter.emitSampleDeleted(id)
    
    return { success: true }
  }

  async assignSample(id: string, assignedTo: string, libraryPrepBy?: string): Promise<Sample> {
    const existingSample = await this.sampleRepository.findById(id)
    if (!existingSample) {
      throw new Error('Sample not found')
    }
    
    const updatedSample = await this.sampleRepository.assign(id, assignedTo, libraryPrepBy)
    
    // Log the action
    await this.auditLogger.logSampleAssigned(id, updatedSample.created_by, assignedTo)
    
    // Emit domain event
    this.eventEmitter.emitSampleAssigned(updatedSample, assignedTo)
    
    return updatedSample
  }

  async updateSampleStatus(
    id: string, 
    status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
  ): Promise<Sample> {
    const existingSample = await this.sampleRepository.findById(id)
    if (!existingSample) {
      throw new Error('Sample not found')
    }
    
    const oldStatus = existingSample.status
    const updatedSample = await this.sampleRepository.updateStatus(id, status)
    
    // Log the action
    await this.auditLogger.logStatusChange(id, updatedSample.created_by, oldStatus, status)
    
    // Emit domain event
    this.eventEmitter.emitStatusChanged(updatedSample, oldStatus, status)
    
    return updatedSample
  }

  async getSamplesByStatus(status: string): Promise<Sample[]> {
    return await this.sampleRepository.findByStatus(status)
  }

  async getSamplesByUser(userId: string): Promise<Sample[]> {
    const timer = this.logger.startTimer('getSamplesByUser')
    
    try {
      const samples = await this.sampleRepository.findByUser(userId)
      
      this.logger.info('Retrieved samples by user', {
        action: 'get_samples_by_user',
        metadata: {
          userId,
          count: samples.length
        }
      })
      
      return samples
    } catch (error) {
      this.logger.error('Failed to get samples by user', {
        action: 'get_samples_by_user_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userId }
      })
      throw error
    } finally {
      timer.done()
    }
  }

  // Processing step methods
  async getProcessingSteps(sampleId: string): Promise<any[]> {
    const timer = this.logger.startTimer('getProcessingSteps')
    
    try {
      const steps = await this.sampleRepository.getProcessingSteps(sampleId)
      
      this.logger.info('Retrieved processing steps', {
        action: 'get_processing_steps',
        metadata: {
          sampleId,
          count: steps.length
        }
      })
      
      return steps
    } catch (error) {
      this.logger.error('Failed to get processing steps', {
        action: 'get_processing_steps_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sampleId }
      })
      throw error
    } finally {
      timer.done()
    }
  }

  async updateProcessingStep(stepId: string, updates: any): Promise<any> {
    const timer = this.logger.startTimer('updateProcessingStep')
    
    try {
      const step = await this.sampleRepository.updateProcessingStep(stepId, updates)
      
      this.logger.info('Updated processing step', {
        action: 'update_processing_step',
        metadata: {
          stepId,
          updates
        }
      })
      
      return step
    } catch (error) {
      this.logger.error('Failed to update processing step', {
        action: 'update_processing_step_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { stepId, updates }
      })
      throw error
    } finally {
      timer.done()
    }
  }

  async startProcessingStep(stepId: string, assignedTo?: string): Promise<any> {
    const timer = this.logger.startTimer('startProcessingStep')
    
    try {
      const updates = {
        step_status: 'in_progress',
        started_at: new Date(),
        assigned_to: assignedTo || null
      }
      
      const step = await this.sampleRepository.updateProcessingStep(stepId, updates)
      
      this.logger.info('Started processing step', {
        action: 'start_processing_step',
        metadata: {
          stepId,
          assignedTo
        }
      })
      
      return step
    } catch (error) {
      this.logger.error('Failed to start processing step', {
        action: 'start_processing_step_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { stepId, assignedTo }
      })
      throw error
    } finally {
      timer.done()
    }
  }

  async completeProcessingStep(stepId: string, notes?: string, resultsData?: any): Promise<any> {
    const timer = this.logger.startTimer('completeProcessingStep')
    
    try {
      const updates = {
        step_status: 'completed',
        completed_at: new Date(),
        notes: notes || null,
        results_data: resultsData || null
      }
      
      const step = await this.sampleRepository.updateProcessingStep(stepId, updates)
      
      this.logger.info('Completed processing step', {
        action: 'complete_processing_step',
        metadata: {
          stepId,
          notes: notes ? 'present' : 'none',
          resultsData: resultsData ? 'present' : 'none'
        }
      })
      
      return step
    } catch (error) {
      this.logger.error('Failed to complete processing step', {
        action: 'complete_processing_step_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { stepId, notes, resultsData }
      })
      throw error
    } finally {
      timer.done()
    }
  }

  async createDefaultProcessingSteps(sampleId: string): Promise<any[]> {
    const timer = this.logger.startTimer('createDefaultProcessingSteps')
    
    try {
      const defaultSteps = [
        {
          sample_id: sampleId,
          step_name: 'Sample QC',
          step_status: 'pending',
          estimated_duration_hours: 1
        },
        {
          sample_id: sampleId,
          step_name: 'Library Preparation',
          step_status: 'pending',
          estimated_duration_hours: 4
        },
        {
          sample_id: sampleId,
          step_name: 'Library QC',
          step_status: 'pending',
          estimated_duration_hours: 1
        },
        {
          sample_id: sampleId,
          step_name: 'Sequencing Setup',
          step_status: 'pending',
          estimated_duration_hours: 1
        },
        {
          sample_id: sampleId,
          step_name: 'Sequencing Run',
          step_status: 'pending',
          estimated_duration_hours: 48
        },
        {
          sample_id: sampleId,
          step_name: 'Basecalling',
          step_status: 'pending',
          estimated_duration_hours: 2
        },
        {
          sample_id: sampleId,
          step_name: 'Quality Assessment',
          step_status: 'pending',
          estimated_duration_hours: 1
        },
        {
          sample_id: sampleId,
          step_name: 'Data Delivery',
          step_status: 'pending',
          estimated_duration_hours: 1
        }
      ]

      const steps = []
      for (const stepData of defaultSteps) {
        const step = await this.sampleRepository.createProcessingStep(sampleId, stepData)
        steps.push(step)
      }
      
      this.logger.info('Created default processing steps', {
        action: 'create_default_processing_steps',
        metadata: {
          sampleId,
          count: steps.length
        }
      })
      
      return steps
    } catch (error) {
      this.logger.error('Failed to create default processing steps', {
        action: 'create_default_processing_steps_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { sampleId }
      })
      throw error
    } finally {
      timer.done()
    }
  }

  private validateCreateData(data: CreateSampleData): void {
    const errors: string[] = []
    
    if (!data.sampleName?.trim()) {
      errors.push('Sample name is required')
    }
    
    if (!data.submitterName?.trim()) {
      errors.push('Submitter name is required')
    }
    
    if (!data.submitterEmail?.trim()) {
      errors.push('Submitter email is required')
    }
    
    if (!data.sampleType?.trim()) {
      errors.push('Sample type is required')
    }
    
    if (!data.chartField?.trim()) {
      errors.push('Chart field is required')
    }
    
    // Email validation
    if (data.submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.submitterEmail)) {
      errors.push('Invalid email format')
    }
    
    // Numeric validations
    if (data.concentration !== undefined && data.concentration < 0) {
      errors.push('Concentration must be positive')
    }
    
    if (data.volume !== undefined && data.volume < 0) {
      errors.push('Volume must be positive')
    }
    
    if (data.flowCellCount !== undefined && data.flowCellCount < 1) {
      errors.push('Flow cell count must be at least 1')
    }
    
    if (errors.length > 0) {
      throw new ValidationError(`Validation failed: ${errors.join(', ')}`)
    }
  }

  private calculateChanges(existing: Sample, updates: UpdateSampleData): Record<string, any> {
    const changes: Record<string, any> = {}
    
    Object.entries(updates).forEach(([key, value]) => {
      const existingValue = (existing as any)[key]
      if (existingValue !== value) {
        changes[key] = {
          from: existingValue,
          to: value,
        }
      }
    })
    
    return changes
  }
} 
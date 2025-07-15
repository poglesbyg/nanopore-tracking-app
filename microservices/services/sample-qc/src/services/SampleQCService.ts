import { Logger } from '../utils/Logger'
import {
  ProcessingStep,
  NanoporeSample,
  QCResult,
  QCIssue,
  StepStartedEvent,
  StepCompletedEvent,
  StepFailedEvent,
  WORKFLOW_STEPS,
  createEvent,
  createServiceResponse,
  ServiceResponse
} from '../../../../shared/types'

// Mock interfaces for services (to be implemented)
interface DatabaseService {
  connect(): Promise<void>
  disconnect(): Promise<void>
  getStep(stepId: string): Promise<ProcessingStep | null>
  updateStep(stepId: string, step: Partial<ProcessingStep>): Promise<void>
  getSample(sampleId: string): Promise<NanoporeSample | null>
}

interface MessageQueueService {
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribe(topic: string, handler: (event: any) => Promise<void>): Promise<void>
  publish(topic: string, event: any): Promise<void>
  unsubscribeAll(): Promise<void>
}

interface RedisService {
  connect(): Promise<void>
  disconnect(): Promise<void>
  setStep(stepId: string, step: ProcessingStep): Promise<void>
  getStep(stepId: string): Promise<ProcessingStep | null>
  deleteStep(stepId: string): Promise<void>
}

export interface SampleQCConfig {
  database: DatabaseService
  messageQueue: MessageQueueService
  redis: RedisService
  logger: Logger
}

export class SampleQCService {
  private database: DatabaseService
  private messageQueue: MessageQueueService
  private redis: RedisService
  private logger: Logger
  private isRunning = false
  private processingSteps: Map<string, ProcessingStep> = new Map()

  constructor(config: SampleQCConfig) {
    this.database = config.database
    this.messageQueue = config.messageQueue
    this.redis = config.redis
    this.logger = config.logger
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    this.logger.info('Starting Sample QC Service')
    
    // Subscribe to step events
    await this.subscribeToEvents()
    
    // Load existing processing steps
    await this.loadProcessingSteps()
    
    this.isRunning = true
    this.logger.info('Sample QC Service started successfully')
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) return

    this.logger.info('Shutting down Sample QC Service')
    this.isRunning = false
    
    // Unsubscribe from events
    await this.messageQueue.unsubscribeAll()
    
    this.logger.info('Sample QC Service shutdown complete')
  }

  private async subscribeToEvents(): Promise<void> {
    // Subscribe to step events for Sample QC
    await this.messageQueue.subscribe('step.started', this.handleStepStarted.bind(this))
    
    this.logger.info('Subscribed to Sample QC events')
  }

  private async loadProcessingSteps(): Promise<void> {
    try {
      // Load any in-progress Sample QC steps
      // This would query the database for steps with stepName = 'Sample QC' and stepStatus = 'in_progress'
      this.logger.info('Loaded existing Sample QC processing steps')
    } catch (error) {
      this.logger.error('Failed to load processing steps:', error)
    }
  }

  private async handleStepStarted(event: StepStartedEvent): Promise<void> {
    try {
      // Only handle Sample QC steps
      if (event.step.stepName !== 'Sample QC') return

      this.logger.info(`Starting Sample QC for step ${event.stepId}`)
      
      // Add to processing steps
      this.processingSteps.set(event.stepId, event.step)
      
      // Start the QC process
      await this.performQualityControl(event.step)
      
    } catch (error) {
      this.logger.error('Error handling step started event:', error)
      await this.failStep(event.step, error.message)
    }
  }

  private async performQualityControl(step: ProcessingStep): Promise<void> {
    try {
      this.logger.info(`Performing quality control for step ${step.id}`)
      
      // Get sample data
      const sample = await this.database.getSample(step.sampleId)
      if (!sample) {
        throw new Error('Sample not found')
      }

      // Perform QC checks
      const qcResult = await this.runQualityChecks(sample)
      
      // Update step with QC results
      const updatedStep = {
        ...step,
        resultsData: {
          qcResult,
          timestamp: new Date().toISOString()
        },
        qcPassed: qcResult.passed,
        qcNotes: qcResult.issues.map(issue => issue.message).join('; ')
      }

      await this.database.updateStep(step.id, updatedStep)
      
      // Simulate processing time
      await this.simulateProcessingTime(step.estimatedDurationHours)
      
      // Complete the step
      await this.completeStep(updatedStep)
      
    } catch (error) {
      this.logger.error(`Error performing quality control for step ${step.id}:`, error)
      await this.failStep(step, error.message)
    }
  }

  private async runQualityChecks(sample: NanoporeSample): Promise<QCResult> {
    const issues: QCIssue[] = []
    const metrics: Record<string, any> = {}
    let score = 100

    // Check concentration
    if (sample.concentration) {
      metrics.concentration = sample.concentration
      
      if (sample.concentration < 1) {
        issues.push({
          severity: 'high',
          message: 'Sample concentration is too low (< 1 ng/μL)',
          field: 'concentration',
          suggestedAction: 'Consider concentrating the sample or increasing input volume'
        })
        score -= 30
      } else if (sample.concentration > 1000) {
        issues.push({
          severity: 'medium',
          message: 'Sample concentration is very high (> 1000 ng/μL)',
          field: 'concentration',
          suggestedAction: 'Consider diluting the sample to prevent sequencing issues'
        })
        score -= 15
      }
    } else {
      issues.push({
        severity: 'critical',
        message: 'Sample concentration is required for QC',
        field: 'concentration',
        suggestedAction: 'Measure sample concentration before proceeding'
      })
      score -= 50
    }

    // Check volume
    if (sample.volume) {
      metrics.volume = sample.volume
      
      if (sample.volume < 1) {
        issues.push({
          severity: 'high',
          message: 'Sample volume is too low (< 1 μL)',
          field: 'volume',
          suggestedAction: 'Increase sample volume or adjust protocol'
        })
        score -= 25
      } else if (sample.volume > 100) {
        issues.push({
          severity: 'low',
          message: 'Sample volume is very high (> 100 μL)',
          field: 'volume',
          suggestedAction: 'Consider using smaller volume for efficiency'
        })
        score -= 5
      }
    } else {
      issues.push({
        severity: 'high',
        message: 'Sample volume is required for QC',
        field: 'volume',
        suggestedAction: 'Measure sample volume before proceeding'
      })
      score -= 30
    }

    // Check sample type
    if (!sample.sampleType) {
      issues.push({
        severity: 'critical',
        message: 'Sample type is required for QC',
        field: 'sampleType',
        suggestedAction: 'Specify sample type (DNA, RNA, etc.)'
      })
      score -= 40
    }

    // Check total amount (if calculable)
    if (sample.concentration && sample.volume) {
      const totalAmount = sample.concentration * sample.volume
      metrics.totalAmount = totalAmount
      
      if (totalAmount < 50) {
        issues.push({
          severity: 'medium',
          message: 'Total sample amount is low (< 50 ng)',
          field: 'totalAmount',
          suggestedAction: 'Consider increasing concentration or volume'
        })
        score -= 20
      }
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (issues.length === 0) {
      recommendations.push('Sample passes all QC checks and is ready for library preparation')
    } else {
      recommendations.push('Review QC issues before proceeding to library preparation')
      if (issues.some(i => i.severity === 'critical')) {
        recommendations.push('Critical issues must be resolved before proceeding')
      }
    }

    // Determine if QC passed
    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const passed = criticalIssues.length === 0 && score >= 70

    return {
      passed,
      score: Math.max(0, score),
      metrics,
      issues,
      recommendations
    }
  }

  private async simulateProcessingTime(estimatedHours: number): Promise<void> {
    // In a real implementation, this would be actual processing time
    // For demo purposes, we'll simulate with a shorter delay
    const simulatedMs = estimatedHours * 60 * 1000 // Convert hours to milliseconds, reduced for demo
    await new Promise(resolve => setTimeout(resolve, Math.min(simulatedMs, 10000))) // Max 10 seconds for demo
  }

  private async completeStep(step: ProcessingStep): Promise<void> {
    const completedStep = {
      ...step,
      stepStatus: 'completed' as const,
      completedAt: new Date(),
      actualDurationHours: step.estimatedDurationHours // In reality, calculate actual duration
    }

    await this.database.updateStep(step.id, completedStep)
    this.processingSteps.delete(step.id)
    
    // Remove from Redis cache
    await this.redis.deleteStep(step.id)
    
    // Publish step completed event
    const event = createEvent<StepCompletedEvent>(
      'step.completed',
      {
        stepId: step.id,
        sampleId: step.sampleId,
        step: completedStep
      },
      'sample-qc'
    )
    
    await this.messageQueue.publish('step.completed', event)
    
    this.logger.info(`Completed Sample QC for step ${step.id}`)
  }

  private async failStep(step: ProcessingStep, error: string): Promise<void> {
    const failedStep = {
      ...step,
      stepStatus: 'failed' as const,
      notes: error
    }

    await this.database.updateStep(step.id, failedStep)
    this.processingSteps.delete(step.id)
    
    // Remove from Redis cache
    await this.redis.deleteStep(step.id)
    
    // Publish step failed event
    const event = createEvent<StepFailedEvent>(
      'step.failed',
      {
        stepId: step.id,
        sampleId: step.sampleId,
        step: failedStep,
        error
      },
      'sample-qc'
    )
    
    await this.messageQueue.publish('step.failed', event)
    
    this.logger.error(`Failed Sample QC for step ${step.id}: ${error}`)
  }

  // Public API methods
  async getQCStatus(stepId: string): Promise<ServiceResponse<ProcessingStep | null>> {
    try {
      const step = await this.database.getStep(stepId)
      if (!step) {
        return createServiceResponse(false, null, 'Step not found')
      }

      if (step.stepName !== 'Sample QC') {
        return createServiceResponse(false, null, 'Step is not a Sample QC step')
      }

      return createServiceResponse(true, step)
    } catch (error) {
      this.logger.error('Error getting QC status:', error)
      return createServiceResponse(false, null, 'Internal server error')
    }
  }

  async getQCHistory(sampleId: string): Promise<ServiceResponse<ProcessingStep[]>> {
    try {
      // In a real implementation, this would query the database for QC history
      // For now, return empty array
      return createServiceResponse(true, [])
    } catch (error) {
      this.logger.error('Error getting QC history:', error)
      return createServiceResponse(false, [], 'Internal server error')
    }
  }

  async getServiceStatus(): Promise<ServiceResponse<{
    activeSteps: number
    completedSteps: number
    failedSteps: number
    averageProcessingTime: number
  }>> {
    try {
      // In a real implementation, this would query metrics from the database
      return createServiceResponse(true, {
        activeSteps: this.processingSteps.size,
        completedSteps: 0,
        failedSteps: 0,
        averageProcessingTime: 1.0
      })
    } catch (error) {
      this.logger.error('Error getting service status:', error)
      return createServiceResponse(false, {
        activeSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        averageProcessingTime: 0
      }, 'Internal server error')
    }
  }
} 
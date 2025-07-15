import { DatabaseService } from './DatabaseService'
import { MessageQueueService } from './MessageQueueService'
import { RedisService } from './RedisService'
import { Logger } from '../utils/Logger'
import {
  NanoporeSample,
  ProcessingStep,
  WorkflowStepName,
  WorkflowStatus,
  StepStatus,
  Priority,
  SampleCreatedEvent,
  SampleUpdatedEvent,
  SampleStatusChangedEvent,
  StepStartedEvent,
  StepCompletedEvent,
  StepFailedEvent,
  WorkflowCompletedEvent,
  PriorityChangedEvent,
  WORKFLOW_STEPS,
  getNextWorkflowStep,
  getWorkflowStatusFromStep,
  isValidWorkflowTransition,
  createEvent,
  createServiceResponse,
  ServiceResponse
} from '../../../shared/types'

export interface WorkflowOrchestratorConfig {
  database: DatabaseService
  messageQueue: MessageQueueService
  redis: RedisService
  logger: Logger
}

export class WorkflowOrchestrator {
  private database: DatabaseService
  private messageQueue: MessageQueueService
  private redis: RedisService
  private logger: Logger
  private isRunning = false
  private workflowQueues: Map<WorkflowStepName, string[]> = new Map()
  private processingSteps: Map<string, ProcessingStep> = new Map()

  constructor(config: WorkflowOrchestratorConfig) {
    this.database = config.database
    this.messageQueue = config.messageQueue
    this.redis = config.redis
    this.logger = config.logger
    
    // Initialize workflow queues
    Object.keys(WORKFLOW_STEPS).forEach(stepName => {
      this.workflowQueues.set(stepName as WorkflowStepName, [])
    })
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    this.logger.info('Starting Workflow Orchestrator')
    
    // Subscribe to events
    await this.subscribeToEvents()
    
    // Load existing processing steps
    await this.loadProcessingSteps()
    
    // Start workflow processing
    this.startWorkflowProcessing()
    
    this.isRunning = true
    this.logger.info('Workflow Orchestrator started successfully')
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) return

    this.logger.info('Shutting down Workflow Orchestrator')
    this.isRunning = false
    
    // Unsubscribe from events
    await this.messageQueue.unsubscribeAll()
    
    this.logger.info('Workflow Orchestrator shutdown complete')
  }

  private async subscribeToEvents(): Promise<void> {
    // Subscribe to sample events
    await this.messageQueue.subscribe('sample.created', this.handleSampleCreated.bind(this))
    await this.messageQueue.subscribe('sample.updated', this.handleSampleUpdated.bind(this))
    await this.messageQueue.subscribe('sample.status_changed', this.handleSampleStatusChanged.bind(this))
    await this.messageQueue.subscribe('priority.changed', this.handlePriorityChanged.bind(this))
    
    // Subscribe to step events
    await this.messageQueue.subscribe('step.started', this.handleStepStarted.bind(this))
    await this.messageQueue.subscribe('step.completed', this.handleStepCompleted.bind(this))
    await this.messageQueue.subscribe('step.failed', this.handleStepFailed.bind(this))
    
    this.logger.info('Subscribed to workflow events')
  }

  private async loadProcessingSteps(): Promise<void> {
    try {
      const steps = await this.database.getInProgressSteps()
      steps.forEach(step => {
        this.processingSteps.set(step.id, step)
      })
      
      this.logger.info(`Loaded ${steps.length} in-progress processing steps`)
    } catch (error) {
      this.logger.error('Failed to load processing steps:', error)
    }
  }

  private async startWorkflowProcessing(): Promise<void> {
    // Process each workflow step queue
    Object.keys(WORKFLOW_STEPS).forEach(stepName => {
      setInterval(async () => {
        await this.processWorkflowQueue(stepName as WorkflowStepName)
      }, 5000) // Check every 5 seconds
    })
  }

  private async processWorkflowQueue(stepName: WorkflowStepName): Promise<void> {
    const queue = this.workflowQueues.get(stepName)
    if (!queue || queue.length === 0) return

    try {
      // Get pending steps for this workflow step
      const pendingSteps = await this.database.getPendingSteps(stepName)
      
      for (const step of pendingSteps) {
        await this.processStep(step)
      }
    } catch (error) {
      this.logger.error(`Error processing workflow queue for ${stepName}:`, error)
    }
  }

  private async processStep(step: ProcessingStep): Promise<void> {
    try {
      // Check if step dependencies are met
      const canStart = await this.checkStepDependencies(step)
      if (!canStart) {
        this.logger.debug(`Step ${step.id} dependencies not met, skipping`)
        return
      }

      // Start the step
      await this.startStep(step)
      
      // Publish step started event
      const event = createEvent<StepStartedEvent>(
        'step.started',
        {
          stepId: step.id,
          sampleId: step.sampleId,
          step: { ...step, stepStatus: 'in_progress' }
        },
        'workflow-orchestrator'
      )
      
      await this.messageQueue.publish('step.started', event)
      
      this.logger.info(`Started step ${step.stepName} for sample ${step.sampleId}`)
    } catch (error) {
      this.logger.error(`Error processing step ${step.id}:`, error)
      await this.failStep(step, error.message)
    }
  }

  private async checkStepDependencies(step: ProcessingStep): Promise<boolean> {
    const stepConfig = WORKFLOW_STEPS[step.stepName]
    if (!stepConfig.dependencies || stepConfig.dependencies.length === 0) {
      return true
    }

    try {
      // Check if all dependency steps are completed
      const dependencies = await this.database.getStepDependencies(step.sampleId, stepConfig.dependencies)
      
      return dependencies.every(dep => dep.stepStatus === 'completed')
    } catch (error) {
      this.logger.error(`Error checking dependencies for step ${step.id}:`, error)
      return false
    }
  }

  private async startStep(step: ProcessingStep): Promise<void> {
    const updatedStep = {
      ...step,
      stepStatus: 'in_progress' as StepStatus,
      startedAt: new Date()
    }
    
    await this.database.updateStep(step.id, updatedStep)
    this.processingSteps.set(step.id, updatedStep)
    
    // Cache step in Redis
    await this.redis.setStep(step.id, updatedStep)
  }

  private async failStep(step: ProcessingStep, error: string): Promise<void> {
    const updatedStep = {
      ...step,
      stepStatus: 'failed' as StepStatus,
      notes: error
    }
    
    await this.database.updateStep(step.id, updatedStep)
    this.processingSteps.delete(step.id)
    
    // Remove from Redis cache
    await this.redis.deleteStep(step.id)
    
    // Publish step failed event
    const event = createEvent<StepFailedEvent>(
      'step.failed',
      {
        stepId: step.id,
        sampleId: step.sampleId,
        step: updatedStep,
        error
      },
      'workflow-orchestrator'
    )
    
    await this.messageQueue.publish('step.failed', event)
  }

  // Event handlers
  private async handleSampleCreated(event: SampleCreatedEvent): Promise<void> {
    try {
      this.logger.info(`Sample created: ${event.sampleId}`)
      
      // Create initial processing steps
      await this.createProcessingSteps(event.sample)
      
      // Start first step if possible
      await this.startNextStep(event.sample)
      
    } catch (error) {
      this.logger.error('Error handling sample created event:', error)
    }
  }

  private async handleSampleUpdated(event: SampleUpdatedEvent): Promise<void> {
    try {
      this.logger.info(`Sample updated: ${event.sampleId}`)
      
      // Update cached sample data
      await this.redis.setSample(event.sampleId, event.changes)
      
    } catch (error) {
      this.logger.error('Error handling sample updated event:', error)
    }
  }

  private async handleSampleStatusChanged(event: SampleStatusChangedEvent): Promise<void> {
    try {
      this.logger.info(`Sample status changed: ${event.sampleId} ${event.oldStatus} -> ${event.newStatus}`)
      
      // Update workflow based on status change
      await this.updateWorkflowStatus(event.sampleId, event.newStatus)
      
    } catch (error) {
      this.logger.error('Error handling sample status changed event:', error)
    }
  }

  private async handlePriorityChanged(event: PriorityChangedEvent): Promise<void> {
    try {
      this.logger.info(`Priority changed: ${event.sampleId} ${event.oldPriority} -> ${event.newPriority}`)
      
      // Reorder processing queues based on new priority
      await this.reorderProcessingQueues(event.sampleId, event.newPriority)
      
    } catch (error) {
      this.logger.error('Error handling priority changed event:', error)
    }
  }

  private async handleStepStarted(event: StepStartedEvent): Promise<void> {
    try {
      this.logger.info(`Step started: ${event.stepId}`)
      
      // Update step tracking
      this.processingSteps.set(event.stepId, event.step)
      
      // Cache step in Redis
      await this.redis.setStep(event.stepId, event.step)
      
    } catch (error) {
      this.logger.error('Error handling step started event:', error)
    }
  }

  private async handleStepCompleted(event: StepCompletedEvent): Promise<void> {
    try {
      this.logger.info(`Step completed: ${event.stepId}`)
      
      // Remove from processing steps
      this.processingSteps.delete(event.stepId)
      
      // Remove from Redis cache
      await this.redis.deleteStep(event.stepId)
      
      // Start next step if possible
      const sample = await this.database.getSample(event.sampleId)
      if (sample) {
        await this.startNextStep(sample)
      }
      
      // Check if workflow is complete
      await this.checkWorkflowCompletion(event.sampleId)
      
    } catch (error) {
      this.logger.error('Error handling step completed event:', error)
    }
  }

  private async handleStepFailed(event: StepFailedEvent): Promise<void> {
    try {
      this.logger.error(`Step failed: ${event.stepId} - ${event.error}`)
      
      // Remove from processing steps
      this.processingSteps.delete(event.stepId)
      
      // Remove from Redis cache
      await this.redis.deleteStep(event.stepId)
      
      // Handle failure based on step configuration
      await this.handleStepFailure(event.sampleId, event.step, event.error)
      
    } catch (error) {
      this.logger.error('Error handling step failed event:', error)
    }
  }

  // Helper methods
  private async createProcessingSteps(sample: NanoporeSample): Promise<void> {
    const steps = Object.values(WORKFLOW_STEPS).map(config => ({
      sampleId: sample.id,
      stepName: config.name,
      stepStatus: 'pending' as StepStatus,
      estimatedDurationHours: config.estimatedDurationHours,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
    
    await this.database.createProcessingSteps(steps)
  }

  private async startNextStep(sample: NanoporeSample): Promise<void> {
    const nextStep = await this.getNextAvailableStep(sample.id)
    if (nextStep) {
      await this.processStep(nextStep)
    }
  }

  private async getNextAvailableStep(sampleId: string): Promise<ProcessingStep | null> {
    const steps = await this.database.getSampleSteps(sampleId)
    
    // Find first pending step with satisfied dependencies
    for (const step of steps) {
      if (step.stepStatus === 'pending') {
        const canStart = await this.checkStepDependencies(step)
        if (canStart) {
          return step
        }
      }
    }
    
    return null
  }

  private async updateWorkflowStatus(sampleId: string, newStatus: WorkflowStatus): Promise<void> {
    // Update sample status in database
    await this.database.updateSampleStatus(sampleId, newStatus)
    
    // Update cached sample data
    await this.redis.setSample(sampleId, { status: newStatus })
  }

  private async reorderProcessingQueues(sampleId: string, newPriority: Priority): Promise<void> {
    const steps = await this.database.getSampleSteps(sampleId)
    
    // Reorder queues based on priority
    const priorityOrder = ['urgent', 'high', 'normal', 'low']
    const priorityIndex = priorityOrder.indexOf(newPriority)
    
    for (const step of steps) {
      if (step.stepStatus === 'pending') {
        const queue = this.workflowQueues.get(step.stepName)
        if (queue) {
          // Remove from current position
          const index = queue.indexOf(step.id)
          if (index > -1) {
            queue.splice(index, 1)
          }
          
          // Insert at new position based on priority
          let insertIndex = 0
          for (let i = 0; i < queue.length; i++) {
            const queuedStep = await this.database.getStep(queue[i])
            if (queuedStep) {
              const sample = await this.database.getSample(queuedStep.sampleId)
              if (sample) {
                const queuedPriorityIndex = priorityOrder.indexOf(sample.priority)
                if (priorityIndex <= queuedPriorityIndex) {
                  insertIndex = i
                  break
                }
              }
            }
            insertIndex = i + 1
          }
          
          queue.splice(insertIndex, 0, step.id)
        }
      }
    }
  }

  private async checkWorkflowCompletion(sampleId: string): Promise<void> {
    const steps = await this.database.getSampleSteps(sampleId)
    const allCompleted = steps.every(step => step.stepStatus === 'completed')
    
    if (allCompleted) {
      const sample = await this.database.getSample(sampleId)
      if (sample) {
        // Update sample status to completed
        await this.database.updateSampleStatus(sampleId, 'completed')
        
        // Calculate total duration
        const totalDuration = steps.reduce((total, step) => {
          return total + (step.actualDurationHours || step.estimatedDurationHours)
        }, 0)
        
        // Publish workflow completed event
        const event = createEvent<WorkflowCompletedEvent>(
          'workflow.completed',
          {
            sampleId,
            sample: { ...sample, status: 'completed' },
            completedAt: new Date(),
            totalDurationHours: totalDuration
          },
          'workflow-orchestrator'
        )
        
        await this.messageQueue.publish('workflow.completed', event)
        
        this.logger.info(`Workflow completed for sample ${sampleId} in ${totalDuration} hours`)
      }
    }
  }

  private async handleStepFailure(sampleId: string, step: ProcessingStep, error: string): Promise<void> {
    // For now, just log the failure
    // In a real implementation, you might want to retry, escalate, or pause the workflow
    this.logger.error(`Step ${step.stepName} failed for sample ${sampleId}: ${error}`)
    
    // Optionally, update sample status to indicate failure
    await this.database.updateSampleStatus(sampleId, 'prep') // Reset to prep status for manual intervention
  }

  // Public API methods
  async getSampleWorkflow(sampleId: string): Promise<ServiceResponse<{ sample: NanoporeSample; steps: ProcessingStep[] }>> {
    try {
      const sample = await this.database.getSample(sampleId)
      if (!sample) {
        return createServiceResponse(false, undefined, 'Sample not found')
      }
      
      const steps = await this.database.getSampleSteps(sampleId)
      
      return createServiceResponse(true, { sample, steps })
    } catch (error) {
      this.logger.error('Error getting sample workflow:', error)
      return createServiceResponse(false, undefined, 'Internal server error')
    }
  }

  async pauseWorkflow(sampleId: string): Promise<ServiceResponse<void>> {
    try {
      // Pause all in-progress steps for this sample
      const steps = await this.database.getSampleSteps(sampleId)
      const inProgressSteps = steps.filter(step => step.stepStatus === 'in_progress')
      
      for (const step of inProgressSteps) {
        await this.database.updateStep(step.id, { ...step, stepStatus: 'pending' })
        this.processingSteps.delete(step.id)
        await this.redis.deleteStep(step.id)
      }
      
      this.logger.info(`Paused workflow for sample ${sampleId}`)
      return createServiceResponse(true)
    } catch (error) {
      this.logger.error('Error pausing workflow:', error)
      return createServiceResponse(false, undefined, 'Internal server error')
    }
  }

  async resumeWorkflow(sampleId: string): Promise<ServiceResponse<void>> {
    try {
      const sample = await this.database.getSample(sampleId)
      if (!sample) {
        return createServiceResponse(false, undefined, 'Sample not found')
      }
      
      await this.startNextStep(sample)
      
      this.logger.info(`Resumed workflow for sample ${sampleId}`)
      return createServiceResponse(true)
    } catch (error) {
      this.logger.error('Error resuming workflow:', error)
      return createServiceResponse(false, undefined, 'Internal server error')
    }
  }

  async getWorkflowStatus(): Promise<ServiceResponse<{ 
    totalSamples: number
    activeSamples: number
    completedSamples: number
    failedSteps: number
    queueLengths: Record<string, number>
  }>> {
    try {
      const totalSamples = await this.database.getTotalSamplesCount()
      const activeSamples = await this.database.getActiveSamplesCount()
      const completedSamples = await this.database.getCompletedSamplesCount()
      const failedSteps = await this.database.getFailedStepsCount()
      
      const queueLengths: Record<string, number> = {}
      for (const [stepName, queue] of this.workflowQueues) {
        queueLengths[stepName] = queue.length
      }
      
      return createServiceResponse(true, {
        totalSamples,
        activeSamples,
        completedSamples,
        failedSteps,
        queueLengths
      })
    } catch (error) {
      this.logger.error('Error getting workflow status:', error)
      return createServiceResponse(false, undefined, 'Internal server error')
    }
  }
} 
// Shared types and interfaces for the nanopore microservices

export interface NanoporeSample {
  id: string
  sampleName: string
  projectId?: string
  submitterName: string
  submitterEmail: string
  labName?: string
  sampleType: 'DNA' | 'RNA' | 'Protein' | 'Other'
  sampleBuffer?: string
  concentration?: number
  volume?: number
  totalAmount?: number
  flowCellType?: 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other'
  flowCellCount?: number
  status: WorkflowStatus
  priority: Priority
  assignedTo?: string
  libraryPrepBy?: string
  chartField: string
  submittedAt: Date
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface ProcessingStep {
  id: string
  sampleId: string
  stepName: WorkflowStepName
  stepStatus: StepStatus
  assignedTo?: string
  startedAt?: Date
  completedAt?: Date
  estimatedDurationHours: number
  actualDurationHours?: number
  notes?: string
  resultsData?: Record<string, any>
  qcPassed?: boolean
  qcNotes?: string
  createdAt: Date
  updatedAt: Date
}

export type WorkflowStatus = 
  | 'submitted'
  | 'prep'
  | 'sequencing'
  | 'analysis'
  | 'completed'
  | 'archived'

export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export type StepStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped'

export type WorkflowStepName = 
  | 'Sample QC'
  | 'Library Preparation'
  | 'Library QC'
  | 'Sequencing Setup'
  | 'Sequencing Run'
  | 'Basecalling'
  | 'Quality Assessment'
  | 'Data Delivery'

export interface WorkflowStepConfig {
  name: WorkflowStepName
  estimatedDurationHours: number
  description: string
  validationRules: ValidationRule[]
  dependencies?: WorkflowStepName[]
  qcRequired: boolean
}

export interface ValidationRule {
  field: string
  type: 'required' | 'range' | 'pattern' | 'custom'
  value?: any
  message: string
}

// Event types for inter-service communication
export interface BaseEvent {
  id: string
  type: string
  timestamp: Date
  source: string
  correlationId?: string
  metadata?: Record<string, any>
}

export interface SampleEvent extends BaseEvent {
  sampleId: string
  sample?: NanoporeSample
}

export interface StepEvent extends BaseEvent {
  stepId: string
  sampleId: string
  step?: ProcessingStep
}

// Specific event types
export interface SampleCreatedEvent extends SampleEvent {
  type: 'sample.created'
  sample: NanoporeSample
}

export interface SampleUpdatedEvent extends SampleEvent {
  type: 'sample.updated'
  changes: Partial<NanoporeSample>
}

export interface SampleStatusChangedEvent extends SampleEvent {
  type: 'sample.status_changed'
  oldStatus: WorkflowStatus
  newStatus: WorkflowStatus
}

export interface StepStartedEvent extends StepEvent {
  type: 'step.started'
  step: ProcessingStep
}

export interface StepCompletedEvent extends StepEvent {
  type: 'step.completed'
  step: ProcessingStep
}

export interface StepFailedEvent extends StepEvent {
  type: 'step.failed'
  step: ProcessingStep
  error: string
}

export interface WorkflowCompletedEvent extends SampleEvent {
  type: 'workflow.completed'
  completedAt: Date
  totalDurationHours: number
}

export interface PriorityChangedEvent extends SampleEvent {
  type: 'priority.changed'
  oldPriority: Priority
  newPriority: Priority
}

// Service response types
export interface ServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
  requestId?: string
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: Date
  uptime: number
  version: string
  dependencies?: Record<string, 'healthy' | 'unhealthy'>
  metrics?: Record<string, any>
}

// Service configuration
export interface ServiceConfig {
  name: string
  version: string
  port: number
  environment: 'development' | 'production' | 'test'
  database: {
    url: string
    maxConnections: number
    timeout: number
  }
  messageQueue: {
    url: string
    topics: string[]
  }
  redis: {
    url: string
    ttl: number
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    format: 'json' | 'text'
  }
  metrics: {
    enabled: boolean
    port: number
  }
  healthCheck: {
    enabled: boolean
    interval: number
    timeout: number
  }
}

// API request/response types
export interface CreateSampleRequest {
  sampleName: string
  projectId?: string
  submitterName: string
  submitterEmail: string
  labName?: string
  sampleType: 'DNA' | 'RNA' | 'Protein' | 'Other'
  sampleBuffer?: string
  concentration?: number
  volume?: number
  totalAmount?: number
  flowCellType?: 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other'
  flowCellCount?: number
  priority: Priority
  assignedTo?: string
  libraryPrepBy?: string
  chartField: string
  specialInstructions?: string
}

export interface UpdateSampleRequest {
  sampleName?: string
  projectId?: string
  submitterName?: string
  submitterEmail?: string
  labName?: string
  sampleType?: 'DNA' | 'RNA' | 'Protein' | 'Other'
  sampleBuffer?: string
  concentration?: number
  volume?: number
  totalAmount?: number
  flowCellType?: 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other'
  flowCellCount?: number
  priority?: Priority
  assignedTo?: string
  libraryPrepBy?: string
  chartField?: string
  specialInstructions?: string
}

export interface StartStepRequest {
  sampleId: string
  stepName: WorkflowStepName
  assignedTo?: string
  notes?: string
}

export interface CompleteStepRequest {
  stepId: string
  notes?: string
  resultsData?: Record<string, any>
  qcPassed?: boolean
  qcNotes?: string
}

export interface FailStepRequest {
  stepId: string
  error: string
  notes?: string
}

// Quality control types
export interface QCResult {
  passed: boolean
  score: number
  metrics: Record<string, any>
  issues: QCIssue[]
  recommendations: string[]
}

export interface QCIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  field?: string
  suggestedAction?: string
}

// Workflow step configurations
export const WORKFLOW_STEPS: Record<WorkflowStepName, WorkflowStepConfig> = {
  'Sample QC': {
    name: 'Sample QC',
    estimatedDurationHours: 1,
    description: 'Initial quality control validation',
    validationRules: [
      {
        field: 'concentration',
        type: 'range',
        value: { min: 1, max: 1000 },
        message: 'Concentration must be between 1-1000 ng/μL'
      },
      {
        field: 'volume',
        type: 'range',
        value: { min: 1, max: 100 },
        message: 'Volume must be between 1-100 μL'
      }
    ],
    qcRequired: true
  },
  'Library Preparation': {
    name: 'Library Preparation',
    estimatedDurationHours: 4,
    description: 'DNA/RNA library construction',
    validationRules: [
      {
        field: 'sampleType',
        type: 'required',
        message: 'Sample type is required for library preparation'
      }
    ],
    dependencies: ['Sample QC'],
    qcRequired: false
  },
  'Library QC': {
    name: 'Library QC',
    estimatedDurationHours: 1,
    description: 'Quality metrics validation',
    validationRules: [
      {
        field: 'libraryConcentration',
        type: 'range',
        value: { min: 0.1, max: 100 },
        message: 'Library concentration must be between 0.1-100 ng/μL'
      }
    ],
    dependencies: ['Library Preparation'],
    qcRequired: true
  },
  'Sequencing Setup': {
    name: 'Sequencing Setup',
    estimatedDurationHours: 1,
    description: 'Flow cell preparation',
    validationRules: [
      {
        field: 'flowCellType',
        type: 'required',
        message: 'Flow cell type is required for sequencing setup'
      }
    ],
    dependencies: ['Library QC'],
    qcRequired: false
  },
  'Sequencing Run': {
    name: 'Sequencing Run',
    estimatedDurationHours: 48,
    description: 'Active sequencing monitoring',
    validationRules: [],
    dependencies: ['Sequencing Setup'],
    qcRequired: false
  },
  'Basecalling': {
    name: 'Basecalling',
    estimatedDurationHours: 2,
    description: 'Raw signal conversion',
    validationRules: [],
    dependencies: ['Sequencing Run'],
    qcRequired: false
  },
  'Quality Assessment': {
    name: 'Quality Assessment',
    estimatedDurationHours: 1,
    description: 'Read quality metrics',
    validationRules: [
      {
        field: 'readQuality',
        type: 'range',
        value: { min: 7, max: 50 },
        message: 'Read quality score must be between 7-50'
      }
    ],
    dependencies: ['Basecalling'],
    qcRequired: true
  },
  'Data Delivery': {
    name: 'Data Delivery',
    estimatedDurationHours: 1,
    description: 'Results packaging',
    validationRules: [],
    dependencies: ['Quality Assessment'],
    qcRequired: false
  }
}

// Utility functions
export function getNextWorkflowStep(currentStep: WorkflowStepName): WorkflowStepName | null {
  const steps = Object.keys(WORKFLOW_STEPS) as WorkflowStepName[]
  const currentIndex = steps.indexOf(currentStep)
  return currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null
}

export function getPreviousWorkflowStep(currentStep: WorkflowStepName): WorkflowStepName | null {
  const steps = Object.keys(WORKFLOW_STEPS) as WorkflowStepName[]
  const currentIndex = steps.indexOf(currentStep)
  return currentIndex > 0 ? steps[currentIndex - 1] : null
}

export function isValidWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  const validTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    'submitted': ['prep'],
    'prep': ['sequencing', 'submitted'],
    'sequencing': ['analysis', 'prep'],
    'analysis': ['completed', 'sequencing'],
    'completed': ['archived'],
    'archived': []
  }
  return validTransitions[from]?.includes(to) || false
}

export function getWorkflowStatusFromStep(stepName: WorkflowStepName): WorkflowStatus {
  const stepToStatus: Record<WorkflowStepName, WorkflowStatus> = {
    'Sample QC': 'prep',
    'Library Preparation': 'prep',
    'Library QC': 'prep',
    'Sequencing Setup': 'sequencing',
    'Sequencing Run': 'sequencing',
    'Basecalling': 'analysis',
    'Quality Assessment': 'analysis',
    'Data Delivery': 'completed'
  }
  return stepToStatus[stepName] || 'submitted'
}

export function createEvent<T extends BaseEvent>(
  type: T['type'],
  data: Omit<T, 'id' | 'timestamp' | 'type' | 'source'>,
  source: string
): T {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date(),
    source,
    ...data
  } as T
}

export function createServiceResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  requestId?: string
): ServiceResponse<T> {
  return {
    success,
    data,
    error,
    timestamp: new Date(),
    requestId
  }
} 
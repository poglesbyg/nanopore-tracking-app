// Core nanopore workflow model implementation (initial version)
// Context: Implements 8-step workflow and basic validation rules
// This module will grow as we integrate backend enforcement.

export enum WorkflowStage {
  SampleQC = 'sample_qc',
  LibraryPrep = 'library_prep',
  LibraryQC = 'library_qc',
  SequencingSetup = 'sequencing_setup',
  SequencingRun = 'sequencing_run',
  Basecalling = 'basecalling',
  QualityAssessment = 'quality_assessment',
  DataDelivery = 'data_delivery'
}

export const WORKFLOW_SEQUENCE: readonly WorkflowStage[] = [
  WorkflowStage.SampleQC,
  WorkflowStage.LibraryPrep,
  WorkflowStage.LibraryQC,
  WorkflowStage.SequencingSetup,
  WorkflowStage.SequencingRun,
  WorkflowStage.Basecalling,
  WorkflowStage.QualityAssessment,
  WorkflowStage.DataDelivery
]

// Validation helpers
interface SampleValidationInput {
  sample_type: string
  concentration?: number | null
  volume?: number | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// Concentration ranges (ng/μL) – extend as needed
const CONCENTRATION_RANGES: Record<string, { min: number; max: number }> = {
  DNA: { min: 0.1, max: 1000 },
  RNA: { min: 0.1, max: 500 },
  Protein: { min: 0.5, max: 2000 }
}

export function canTransition(current: WorkflowStage, target: WorkflowStage): boolean {
  const currIndex = WORKFLOW_SEQUENCE.indexOf(current)
  const targetIndex = WORKFLOW_SEQUENCE.indexOf(target)
  // Allow staying in same stage or advancing to next stage
  return targetIndex === currIndex || targetIndex === currIndex + 1
}

export function validateSampleQC(data: SampleValidationInput): ValidationResult {
  const errors: string[] = []
  const range = CONCENTRATION_RANGES[data.sample_type as keyof typeof CONCENTRATION_RANGES]

  // Concentration validation
  if (data.concentration != null && range) {
    if (data.concentration < range.min || data.concentration > range.max) {
      errors.push(
        `Concentration ${data.concentration} ng/μL out of range for ${data.sample_type} (${range.min}-${range.max})`
      )
    }
  }

  // Volume validation
  if (data.volume != null && data.volume < 0.1) {
    errors.push('Volume must be at least 0.1 μL')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

import { z } from 'zod';

// Nanopore Technology Types
export const FlowCellTypeSchema = z.enum(['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other']);
export type FlowCellType = z.infer<typeof FlowCellTypeSchema>;

export const SampleTypeSchema = z.enum(['DNA', 'RNA', 'Protein', 'Other']);
export type SampleType = z.infer<typeof SampleTypeSchema>;

export const SequencingKitSchema = z.enum([
  'SQK-LSK109', 'SQK-LSK110', 'SQK-LSK114', 
  'SQK-RNA002', 'SQK-RNA004',
  'SQK-16S024', 'SQK-PCB109', 'SQK-PCB111',
  'Other'
]);
export type SequencingKit = z.infer<typeof SequencingKitSchema>;

// Quality Control Parameters
export const QualityMetricsSchema = z.object({
  concentration: z.number().min(0).optional(),
  volume: z.number().min(0).optional(),
  purity_260_280: z.number().min(0).optional(),
  purity_260_230: z.number().min(0).optional(),
  dna_integrity_number: z.number().min(1).max(10).optional(),
  fragment_size_distribution: z.string().optional(),
  contamination_level: z.enum(['none', 'low', 'medium', 'high']).optional(),
});
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>;

// Sequencing Parameters
export const SequencingParametersSchema = z.object({
  flow_cell_type: FlowCellTypeSchema,
  sequencing_kit: SequencingKitSchema,
  target_yield: z.number().min(0).optional(),
  target_read_length: z.number().min(0).optional(),
  run_duration_hours: z.number().min(1).max(72).optional(),
  basecalling_model: z.string().optional(),
  barcode_kit: z.string().optional(),
});
export type SequencingParameters = z.infer<typeof SequencingParametersSchema>;

// Domain Expertise Areas
export const ExpertiseAreaSchema = z.enum([
  'sample_preparation',
  'library_preparation', 
  'sequencing_optimization',
  'quality_control',
  'troubleshooting',
  'data_analysis',
  'protocol_selection',
  'contamination_detection',
  'yield_optimization',
  'read_length_optimization'
]);
export type ExpertiseArea = z.infer<typeof ExpertiseAreaSchema>;

// Protocol Recommendations
export const ProtocolRecommendationSchema = z.object({
  protocol_name: z.string(),
  protocol_version: z.string(),
  suitability_score: z.number().min(0).max(100),
  recommended_kit: SequencingKitSchema,
  estimated_yield: z.string(),
  estimated_read_length: z.string(),
  preparation_time: z.string(),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']),
  special_requirements: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  optimization_tips: z.array(z.string()).optional(),
});
export type ProtocolRecommendation = z.infer<typeof ProtocolRecommendationSchema>;

// Troubleshooting Issues
export const TroubleshootingIssueSchema = z.object({
  issue_type: z.enum([
    'low_yield',
    'poor_quality',
    'short_reads',
    'high_adapter_content',
    'contamination',
    'library_prep_failure',
    'sequencing_failure',
    'basecalling_issues',
    'data_quality_issues'
  ]),
  symptoms: z.array(z.string()),
  possible_causes: z.array(z.string()),
  diagnostic_steps: z.array(z.string()),
  solutions: z.array(z.string()),
  prevention_tips: z.array(z.string()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});
export type TroubleshootingIssue = z.infer<typeof TroubleshootingIssueSchema>;

// Quality Assessment
export const QualityAssessmentSchema = z.object({
  overall_score: z.number().min(0).max(100),
  quality_grade: z.enum(['excellent', 'good', 'acceptable', 'poor', 'failed']),
  critical_issues: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  estimated_success_probability: z.number().min(0).max(100),
  suggested_modifications: z.array(z.string()).optional(),
});
export type QualityAssessment = z.infer<typeof QualityAssessmentSchema>;

// Optimization Suggestions
export const OptimizationSuggestionSchema = z.object({
  category: z.enum([
    'sample_preparation',
    'library_preparation',
    'sequencing_parameters',
    'data_processing',
    'workflow_efficiency'
  ]),
  suggestion: z.string(),
  expected_improvement: z.string(),
  implementation_difficulty: z.enum(['easy', 'moderate', 'difficult']),
  estimated_cost_impact: z.enum(['none', 'low', 'medium', 'high']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  supporting_evidence: z.string().optional(),
});
export type OptimizationSuggestion = z.infer<typeof OptimizationSuggestionSchema>;

// Knowledge Base Entry
export const KnowledgeBaseEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: ExpertiseAreaSchema,
  content: z.string(),
  tags: z.array(z.string()),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']),
  last_updated: z.string(),
  references: z.array(z.string()).optional(),
  related_protocols: z.array(z.string()).optional(),
});
export type KnowledgeBaseEntry = z.infer<typeof KnowledgeBaseEntrySchema>;

// Best Practices
export const BestPracticeSchema = z.object({
  practice_id: z.string(),
  title: z.string(),
  description: z.string(),
  applicable_to: z.array(ExpertiseAreaSchema),
  importance_level: z.enum(['nice-to-have', 'recommended', 'essential', 'critical']),
  implementation_steps: z.array(z.string()),
  common_mistakes: z.array(z.string()).optional(),
  success_indicators: z.array(z.string()).optional(),
});
export type BestPractice = z.infer<typeof BestPracticeSchema>;

// Domain Expert Analysis Request
export const DomainAnalysisRequestSchema = z.object({
  analysis_type: z.enum([
    'protocol_recommendation',
    'quality_assessment', 
    'troubleshooting',
    'optimization',
    'best_practices',
    'knowledge_lookup'
  ]),
  sample_data: z.object({
    sample_type: SampleTypeSchema,
    concentration: z.number().optional(),
    volume: z.number().optional(),
    quality_metrics: QualityMetricsSchema.optional(),
    special_requirements: z.array(z.string()).optional(),
  }).optional(),
  sequencing_requirements: z.object({
    target_application: z.string().optional(),
    target_yield: z.number().optional(),
    target_read_length: z.number().optional(),
    budget_constraints: z.enum(['low', 'medium', 'high', 'unlimited']).optional(),
    timeline_constraints: z.enum(['urgent', 'standard', 'flexible']).optional(),
  }).optional(),
  current_issues: z.array(z.string()).optional(),
  expertise_area: ExpertiseAreaSchema.optional(),
});
export type DomainAnalysisRequest = z.infer<typeof DomainAnalysisRequestSchema>;

// MCP Tool Schemas
export const AnalyzeProtocolRequestSchema = z.object({
  sample_type: SampleTypeSchema,
  sample_concentration: z.number().min(0).optional(),
  sample_volume: z.number().min(0).optional(),
  target_application: z.string(),
  budget_level: z.enum(['low', 'medium', 'high', 'unlimited']).default('medium'),
  timeline: z.enum(['urgent', 'standard', 'flexible']).default('standard'),
  special_requirements: z.array(z.string()).default([]),
});

export const AssessQualityRequestSchema = z.object({
  sample_id: z.string().optional(),
  quality_metrics: QualityMetricsSchema,
  sample_type: SampleTypeSchema,
  intended_application: z.string(),
  flow_cell_type: FlowCellTypeSchema.optional(),
});

export const TroubleshootIssueRequestSchema = z.object({
  issue_description: z.string(),
  sample_type: SampleTypeSchema.optional(),
  workflow_stage: z.enum([
    'sample_preparation',
    'quality_control',
    'library_preparation', 
    'sequencing_setup',
    'sequencing_run',
    'basecalling',
    'data_analysis'
  ]),
  observed_symptoms: z.array(z.string()),
  recent_changes: z.array(z.string()).default([]),
});

export const OptimizeWorkflowRequestSchema = z.object({
  current_workflow: z.string(),
  sample_types: z.array(SampleTypeSchema),
  throughput_requirements: z.number().min(1).optional(),
  quality_requirements: z.enum(['basic', 'standard', 'high', 'research-grade']).default('standard'),
  resource_constraints: z.array(z.string()).default([]),
  optimization_goals: z.array(z.enum([
    'increase_yield',
    'improve_quality',
    'reduce_time',
    'reduce_cost',
    'increase_throughput',
    'reduce_failure_rate'
  ])),
});

export const GetBestPracticesRequestSchema = z.object({
  expertise_area: ExpertiseAreaSchema,
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  specific_focus: z.string().optional(),
});

// Database Types (shared with sample management)
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Logging Types
export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

// Error Types
export class DomainExpertError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'DomainExpertError';
  }
}

export class ValidationError extends DomainExpertError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class KnowledgeBaseError extends DomainExpertError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'KNOWLEDGE_BASE_ERROR', context);
    this.name = 'KnowledgeBaseError';
  }
} 
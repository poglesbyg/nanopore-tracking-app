import { z } from 'zod';

// Core sample data types
export const SampleSchema = z.object({
  id: z.string(),
  sample_name: z.string(),
  submission_id: z.string(),
  sample_number: z.number(),
  sample_type: z.enum(['DNA', 'RNA', 'Protein', 'Other']),
  status: z.enum(['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  concentration: z.number().optional(),
  volume: z.number().optional(),
  flow_cell_type: z.enum(['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other']).optional(),
  assigned_to: z.string().optional(),
  library_prep_by: z.string().optional(),
  submitted_at: z.string(),
  updated_at: z.string(),
});

export type Sample = z.infer<typeof SampleSchema>;

// Workflow analysis types
export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration_minutes: z.number(),
  required_resources: z.array(z.string()),
  dependencies: z.array(z.string()),
});

export const WorkflowPerformanceSchema = z.object({
  step_id: z.string(),
  average_duration: z.number(),
  success_rate: z.number(),
  bottleneck_score: z.number(),
  resource_utilization: z.number(),
});

// Assignment optimization types
export const OperatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(z.string()),
  current_workload: z.number(),
  max_capacity: z.number(),
  efficiency_rating: z.number(),
});

export const AssignmentRecommendationSchema = z.object({
  sample_id: z.string(),
  recommended_operator: z.string(),
  confidence_score: z.number(),
  reasoning: z.string(),
  estimated_completion: z.string(),
});

// Prediction types
export const CompletionPredictionSchema = z.object({
  sample_id: z.string(),
  predicted_completion_date: z.string(),
  confidence_interval: z.object({
    lower: z.string(),
    upper: z.string(),
  }),
  risk_factors: z.array(z.string()),
  recommendations: z.array(z.string()),
});

// Quality metrics
export const QualityMetricsSchema = z.object({
  concentration_cv: z.number(),
  volume_accuracy: z.number(),
  processing_time_variance: z.number(),
  error_rate: z.number(),
});

// Export all types
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowPerformance = z.infer<typeof WorkflowPerformanceSchema>;
export type Operator = z.infer<typeof OperatorSchema>;
export type AssignmentRecommendation = z.infer<typeof AssignmentRecommendationSchema>;
export type CompletionPrediction = z.infer<typeof CompletionPredictionSchema>;
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>; 
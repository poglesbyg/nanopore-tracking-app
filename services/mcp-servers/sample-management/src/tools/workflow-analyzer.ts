import { z } from 'zod';
import { DatabaseConnection } from '../database.js';
import type { WorkflowPerformance, Sample } from '../types.js';
import { addDays, differenceInMinutes, parseISO } from 'date-fns';

/**
 * Analyzes workflow performance and identifies bottlenecks
 */
export class WorkflowAnalyzer {
  private db = DatabaseConnection.getInstance();

  /**
   * Analyze workflow performance over a time period
   */
  async analyzeWorkflowPerformance(params: {
    timeRangeStart: string;
    timeRangeEnd: string;
    includeCompleted?: boolean;
  }): Promise<{
    overall_metrics: {
      total_samples: number;
      average_processing_time_hours: number;
      completion_rate: number;
      bottleneck_stages: string[];
    };
    stage_performance: WorkflowPerformance[];
    recommendations: string[];
  }> {
    const { timeRangeStart, timeRangeEnd, includeCompleted = true } = params;

    // Get samples in the time range
    let query = this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('submitted_at', '>=', timeRangeStart)
      .where('submitted_at', '<=', timeRangeEnd);

    if (includeCompleted) {
      query = query.where('status', 'in', ['completed', 'archived']);
    }

    const samples = await query.execute();

    // Calculate overall metrics
    const totalSamples = samples.length;
    const completedSamples = samples.filter(s => s.status === 'completed' || s.status === 'archived');
    const completionRate = totalSamples > 0 ? (completedSamples.length / totalSamples) * 100 : 0;

    // Calculate average processing time for completed samples
    const avgProcessingTime = completedSamples.length > 0 
      ? completedSamples.reduce((sum, sample) => {
          const submitTime = parseISO(sample.submitted_at);
          const updateTime = parseISO(sample.updated_at);
          return sum + differenceInMinutes(updateTime, submitTime);
        }, 0) / completedSamples.length / 60 // Convert to hours
      : 0;

    // Analyze stage performance (simplified - in real implementation would track stage transitions)
    const stagePerformance: WorkflowPerformance[] = [
      {
        step_id: 'sample_qc',
        average_duration: 60, // minutes
        success_rate: 0.95,
        bottleneck_score: this.calculateBottleneckScore(samples, 'submitted'),
        resource_utilization: 0.75,
      },
      {
        step_id: 'library_prep',
        average_duration: 240,
        success_rate: 0.92,
        bottleneck_score: this.calculateBottleneckScore(samples, 'prep'),
        resource_utilization: 0.85,
      },
      {
        step_id: 'sequencing',
        average_duration: 2880, // 48 hours
        success_rate: 0.88,
        bottleneck_score: this.calculateBottleneckScore(samples, 'sequencing'),
        resource_utilization: 0.90,
      },
      {
        step_id: 'analysis',
        average_duration: 120,
        success_rate: 0.94,
        bottleneck_score: this.calculateBottleneckScore(samples, 'analysis'),
        resource_utilization: 0.70,
      },
    ];

    // Identify bottleneck stages
    const bottleneckStages = stagePerformance
      .filter(stage => stage.bottleneck_score > 0.7)
      .map(stage => stage.step_id);

    // Generate recommendations
    const recommendations = this.generateRecommendations(stagePerformance, samples);

    return {
      overall_metrics: {
        total_samples: totalSamples,
        average_processing_time_hours: Math.round(avgProcessingTime * 100) / 100,
        completion_rate: Math.round(completionRate * 100) / 100,
        bottleneck_stages: bottleneckStages,
      },
      stage_performance: stagePerformance,
      recommendations,
    };
  }

  /**
   * Predict optimal sample scheduling
   */
  async optimizeSchedule(params: {
    priorityWeights?: {
      urgent: number;
      high: number;
      normal: number;
      low: number;
    };
    resourceConstraints?: {
      max_prep_capacity: number;
      max_sequencing_capacity: number;
    };
  }): Promise<{
    optimized_queue: Array<{
      sample_id: string;
      sample_name: string;
      recommended_start_time: string;
      estimated_completion: string;
      priority_score: number;
    }>;
    resource_utilization: {
      prep_utilization: number;
      sequencing_utilization: number;
    };
    scheduling_insights: string[];
  }> {
    const { 
      priorityWeights = { urgent: 4, high: 3, normal: 2, low: 1 },
      resourceConstraints = { max_prep_capacity: 10, max_sequencing_capacity: 5 }
    } = params;

    // Get pending samples
    const pendingSamples = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('status', 'in', ['submitted', 'prep'])
      .orderBy('submitted_at', 'asc')
      .execute();

    // Calculate priority scores
    const samplesWithScores = pendingSamples.map(sample => {
      const priorityScore = priorityWeights[sample.priority];
      const ageBonus = Math.min(
        differenceInMinutes(new Date(), parseISO(sample.submitted_at)) / (24 * 60), // Days old
        2 // Max 2 point bonus for age
      );
      
      return {
        ...sample,
        priority_score: priorityScore + ageBonus,
      };
    });

    // Sort by priority score (highest first)
    samplesWithScores.sort((a, b) => b.priority_score - a.priority_score);

    // Generate optimized schedule
    const optimizedQueue = samplesWithScores.slice(0, 20).map((sample, index) => {
      const startTime = addDays(new Date(), Math.floor(index / resourceConstraints.max_prep_capacity));
      const completionTime = addDays(startTime, 3); // Estimated 3-day turnaround

      return {
        sample_id: sample.id,
        sample_name: sample.sample_name,
        recommended_start_time: startTime.toISOString(),
        estimated_completion: completionTime.toISOString(),
        priority_score: Math.round(sample.priority_score * 100) / 100,
      };
    });

    // Calculate resource utilization
    const prepUtilization = Math.min(pendingSamples.length / resourceConstraints.max_prep_capacity, 1);
    const sequencingUtilization = Math.min(
      pendingSamples.filter(s => s.status === 'prep').length / resourceConstraints.max_sequencing_capacity, 
      1
    );

    // Generate scheduling insights
    const schedulingInsights = [
      `${pendingSamples.length} samples in queue`,
      `Prep capacity: ${Math.round(prepUtilization * 100)}% utilized`,
      `Sequencing capacity: ${Math.round(sequencingUtilization * 100)}% utilized`,
      samplesWithScores.filter(s => s.priority === 'urgent').length > 0 
        ? `${samplesWithScores.filter(s => s.priority === 'urgent').length} urgent samples require immediate attention`
        : 'No urgent samples in queue',
    ];

    return {
      optimized_queue: optimizedQueue,
      resource_utilization: {
        prep_utilization: Math.round(prepUtilization * 100) / 100,
        sequencing_utilization: Math.round(sequencingUtilization * 100) / 100,
      },
      scheduling_insights: schedulingInsights,
    };
  }

  /**
   * Calculate bottleneck score for a specific stage
   */
  private calculateBottleneckScore(samples: Sample[], status: string): number {
    const samplesInStage = samples.filter(s => s.status === status);
    const totalSamples = samples.length;
    
    if (totalSamples === 0) return 0;
    
    // Higher percentage in a stage indicates potential bottleneck
    const stagePercentage = samplesInStage.length / totalSamples;
    
    // Also consider age of samples in this stage
    const avgAgeInStage = samplesInStage.length > 0
      ? samplesInStage.reduce((sum, sample) => {
          return sum + differenceInMinutes(new Date(), parseISO(sample.submitted_at));
        }, 0) / samplesInStage.length / (24 * 60) // Convert to days
      : 0;

    // Combine percentage and age factors
    return Math.min(stagePercentage + (avgAgeInStage / 10), 1);
  }

  /**
   * Generate recommendations based on performance analysis
   */
  private generateRecommendations(stagePerformance: WorkflowPerformance[], samples: Sample[]): string[] {
    const recommendations: string[] = [];

    // Check for bottlenecks
    const bottlenecks = stagePerformance.filter(stage => stage.bottleneck_score > 0.7);
    if (bottlenecks.length > 0) {
      recommendations.push(
        `Address bottlenecks in: ${bottlenecks.map(b => b.step_id).join(', ')}`
      );
    }

    // Check resource utilization
    const underutilized = stagePerformance.filter(stage => stage.resource_utilization < 0.6);
    if (underutilized.length > 0) {
      recommendations.push(
        `Consider redistributing resources from underutilized stages: ${underutilized.map(u => u.step_id).join(', ')}`
      );
    }

    // Check for urgent samples
    const urgentSamples = samples.filter(s => s.priority === 'urgent' && s.status !== 'completed');
    if (urgentSamples.length > 0) {
      recommendations.push(`${urgentSamples.length} urgent samples need immediate attention`);
    }

    // Check for old samples
    const oldSamples = samples.filter(s => {
      const ageInDays = differenceInMinutes(new Date(), parseISO(s.submitted_at)) / (24 * 60);
      return ageInDays > 7 && s.status !== 'completed';
    });
    if (oldSamples.length > 0) {
      recommendations.push(`${oldSamples.length} samples are over 7 days old - consider priority review`);
    }

    return recommendations;
  }
} 
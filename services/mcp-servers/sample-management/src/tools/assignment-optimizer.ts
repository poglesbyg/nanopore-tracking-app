import { DatabaseConnection } from '../database.js';
import type { AssignmentRecommendation, Operator, Sample } from '../types.js';
import { addDays, differenceInMinutes, parseISO } from 'date-fns';

/**
 * Intelligent assignment optimization for samples to operators
 */
export class AssignmentOptimizer {
  private db = DatabaseConnection.getInstance();

  // Mock operator data - in real implementation this would come from database
  private operators: Operator[] = [
    {
      id: 'op-001',
      name: 'Dr. Sarah Chen',
      skills: ['DNA_extraction', 'library_prep', 'qc_analysis'],
      current_workload: 3,
      max_capacity: 8,
      efficiency_rating: 0.95,
    },
    {
      id: 'op-002',
      name: 'Dr. Michael Rodriguez',
      skills: ['RNA_extraction', 'library_prep', 'sequencing_setup'],
      current_workload: 5,
      max_capacity: 10,
      efficiency_rating: 0.88,
    },
    {
      id: 'op-003',
      name: 'Dr. Emily Johnson',
      skills: ['protein_analysis', 'qc_analysis', 'data_analysis'],
      current_workload: 2,
      max_capacity: 6,
      efficiency_rating: 0.92,
    },
    {
      id: 'op-004',
      name: 'Dr. James Wilson',
      skills: ['DNA_extraction', 'RNA_extraction', 'sequencing_setup', 'library_prep'],
      current_workload: 4,
      max_capacity: 12,
      efficiency_rating: 0.90,
    },
  ];

  /**
   * Generate intelligent assignment recommendations
   */
  async generateAssignmentRecommendations(params: {
    sample_ids?: string[];
    consider_workload?: boolean;
    consider_skills?: boolean;
    consider_efficiency?: boolean;
  }): Promise<{
    recommendations: AssignmentRecommendation[];
    workload_distribution: Array<{
      operator_id: string;
      operator_name: string;
      current_load: number;
      recommended_load: number;
      capacity_utilization: number;
    }>;
    optimization_insights: string[];
  }> {
    const {
      sample_ids,
      consider_workload = true,
      consider_skills = true,
      consider_efficiency = true,
    } = params;

    // Get samples to assign
    let query = this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('status', 'in', ['submitted', 'prep']);

    if (sample_ids && sample_ids.length > 0) {
      query = query.where('id', 'in', sample_ids);
    } else {
      // Get unassigned samples or samples needing reassignment
      query = query.where((eb) => eb.or([
        eb('assigned_to', 'is', null),
        eb('assigned_to', '=', ''),
      ]));
    }

    const samples = await query.execute();

    // Generate recommendations for each sample
    const recommendations: AssignmentRecommendation[] = [];

    for (const sample of samples) {
      const recommendation = await this.findOptimalAssignment(sample, {
        consider_workload,
        consider_skills,
        consider_efficiency,
      });
      recommendations.push(recommendation);
    }

    // Calculate workload distribution after assignments
    const workloadDistribution = this.calculateWorkloadDistribution(recommendations);

    // Generate optimization insights
    const optimizationInsights = this.generateOptimizationInsights(
      recommendations,
      workloadDistribution,
      samples
    );

    return {
      recommendations,
      workload_distribution: workloadDistribution,
      optimization_insights: optimizationInsights,
    };
  }

  /**
   * Analyze current workload balance across operators
   */
  async analyzeWorkloadBalance(): Promise<{
    balance_score: number; // 0-1, where 1 is perfectly balanced
    overloaded_operators: string[];
    underutilized_operators: string[];
    rebalancing_suggestions: string[];
  }> {
    // Get current assignments
    const assignedSamples = await this.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('assigned_to', 'is not', null)
      .where('status', 'in', ['prep', 'sequencing', 'analysis'])
      .execute();

    // Calculate current workload for each operator
    const workloadMap = new Map<string, number>();
    assignedSamples.forEach(sample => {
      if (sample.assigned_to) {
        workloadMap.set(sample.assigned_to, (workloadMap.get(sample.assigned_to) || 0) + 1);
      }
    });

    // Calculate balance metrics
    const operatorUtilizations = this.operators.map(op => {
      const currentLoad = workloadMap.get(op.name) || 0;
      return {
        operator: op.name,
        utilization: currentLoad / op.max_capacity,
        currentLoad,
        maxCapacity: op.max_capacity,
      };
    });

    // Calculate balance score (1 - coefficient of variation)
    const utilizations = operatorUtilizations.map(ou => ou.utilization);
    const avgUtilization = utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length;
    const variance = utilizations.reduce((sum, u) => sum + Math.pow(u - avgUtilization, 2), 0) / utilizations.length;
    const coefficientOfVariation = avgUtilization > 0 ? Math.sqrt(variance) / avgUtilization : 0;
    const balanceScore = Math.max(0, 1 - coefficientOfVariation);

    // Identify overloaded and underutilized operators
    const overloadedOperators = operatorUtilizations
      .filter(ou => ou.utilization > 0.9)
      .map(ou => ou.operator);

    const underutilizedOperators = operatorUtilizations
      .filter(ou => ou.utilization < 0.5)
      .map(ou => ou.operator);

    // Generate rebalancing suggestions
    const rebalancingSuggestions: string[] = [];
    if (overloadedOperators.length > 0) {
      rebalancingSuggestions.push(
        `Consider redistributing work from overloaded operators: ${overloadedOperators.join(', ')}`
      );
    }
    if (underutilizedOperators.length > 0) {
      rebalancingSuggestions.push(
        `Assign more work to underutilized operators: ${underutilizedOperators.join(', ')}`
      );
    }
    if (balanceScore < 0.7) {
      rebalancingSuggestions.push('Overall workload distribution needs improvement');
    }

    return {
      balance_score: Math.round(balanceScore * 100) / 100,
      overloaded_operators: overloadedOperators,
      underutilized_operators: underutilizedOperators,
      rebalancing_suggestions: rebalancingSuggestions,
    };
  }

  /**
   * Find optimal assignment for a single sample
   */
  private async findOptimalAssignment(
    sample: Sample,
    options: {
      consider_workload: boolean;
      consider_skills: boolean;
      consider_efficiency: boolean;
    }
  ): Promise<AssignmentRecommendation> {
    let bestOperator = this.operators[0];
    let bestScore = 0;
    let reasoning = '';

    for (const operator of this.operators) {
      let score = 0;
      const reasoningParts: string[] = [];

      // Workload consideration
      if (options.consider_workload) {
        const capacityUtilization = operator.current_workload / operator.max_capacity;
        const workloadScore = Math.max(0, 1 - capacityUtilization);
        score += workloadScore * 0.4;
        reasoningParts.push(`workload: ${Math.round(workloadScore * 100)}%`);
      }

      // Skills consideration
      if (options.consider_skills) {
        const requiredSkill = this.getRequiredSkill(sample.sample_type);
        const hasSkill = operator.skills.includes(requiredSkill);
        const skillScore = hasSkill ? 1 : 0.3; // Penalty for missing skills
        score += skillScore * 0.4;
        reasoningParts.push(`skills: ${hasSkill ? 'match' : 'partial'}`);
      }

      // Efficiency consideration
      if (options.consider_efficiency) {
        score += operator.efficiency_rating * 0.2;
        reasoningParts.push(`efficiency: ${Math.round(operator.efficiency_rating * 100)}%`);
      }

      if (score > bestScore) {
        bestScore = score;
        bestOperator = operator;
        reasoning = `Best match based on ${reasoningParts.join(', ')}`;
      }
    }

    // Estimate completion time
    const baseProcessingTime = this.getBaseProcessingTime(sample.sample_type);
    const adjustedTime = baseProcessingTime / bestOperator.efficiency_rating;
    const estimatedCompletion = addDays(new Date(), adjustedTime).toISOString();

    return {
      sample_id: sample.id,
      recommended_operator: bestOperator.name,
      confidence_score: Math.round(bestScore * 100) / 100,
      reasoning,
      estimated_completion: estimatedCompletion,
    };
  }

  /**
   * Get required skill based on sample type
   */
  private getRequiredSkill(sampleType: string): string {
    const skillMap: Record<string, string> = {
      'DNA': 'DNA_extraction',
      'RNA': 'RNA_extraction',
      'Protein': 'protein_analysis',
      'Other': 'qc_analysis',
    };
    return skillMap[sampleType] || 'qc_analysis';
  }

  /**
   * Get base processing time in days for sample type
   */
  private getBaseProcessingTime(sampleType: string): number {
    const timeMap: Record<string, number> = {
      'DNA': 2,
      'RNA': 3,
      'Protein': 4,
      'Other': 2,
    };
    return timeMap[sampleType] || 2;
  }

  /**
   * Calculate workload distribution after recommendations
   */
  private calculateWorkloadDistribution(recommendations: AssignmentRecommendation[]) {
    const newWorkload = new Map<string, number>();
    
    // Count recommendations per operator
    recommendations.forEach(rec => {
      newWorkload.set(rec.recommended_operator, (newWorkload.get(rec.recommended_operator) || 0) + 1);
    });

    return this.operators.map(op => {
      const currentLoad = op.current_workload;
      const additionalLoad = newWorkload.get(op.name) || 0;
      const recommendedLoad = currentLoad + additionalLoad;
      const capacityUtilization = recommendedLoad / op.max_capacity;

      return {
        operator_id: op.id,
        operator_name: op.name,
        current_load: currentLoad,
        recommended_load: recommendedLoad,
        capacity_utilization: Math.round(capacityUtilization * 100) / 100,
      };
    });
  }

  /**
   * Generate optimization insights
   */
  private generateOptimizationInsights(
    recommendations: AssignmentRecommendation[],
    workloadDistribution: any[],
    samples: Sample[]
  ): string[] {
    const insights: string[] = [];

    // Check for overutilization
    const overutilized = workloadDistribution.filter(wd => wd.capacity_utilization > 0.9);
    if (overutilized.length > 0) {
      insights.push(
        `Warning: ${overutilized.length} operators will be over 90% capacity after assignments`
      );
    }

    // Check assignment confidence
    const lowConfidenceAssignments = recommendations.filter(rec => rec.confidence_score < 0.7);
    if (lowConfidenceAssignments.length > 0) {
      insights.push(
        `${lowConfidenceAssignments.length} assignments have low confidence - consider manual review`
      );
    }

    // Check for urgent samples
    const urgentSamples = samples.filter(s => s.priority === 'urgent');
    if (urgentSamples.length > 0) {
      insights.push(`${urgentSamples.length} urgent samples in assignment queue`);
    }

    // Overall distribution quality
    const avgUtilization = workloadDistribution.reduce((sum, wd) => sum + wd.capacity_utilization, 0) / workloadDistribution.length;
    if (avgUtilization > 0.8) {
      insights.push('High overall capacity utilization - consider adding resources');
    } else if (avgUtilization < 0.5) {
      insights.push('Low overall capacity utilization - opportunity for increased throughput');
    }

    return insights;
  }
} 
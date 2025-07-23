import type {
  SampleType,
  FlowCellType,
  SequencingKit,
  QualityMetrics,
  ProtocolRecommendation,
  TroubleshootingIssue,
  QualityAssessment,
  OptimizationSuggestion,
  BestPractice,
  ExpertiseArea
} from './types.js';

/**
 * Nanopore Domain Knowledge Engine
 * Provides expert-level guidance for nanopore sequencing workflows
 */
export class DomainKnowledgeEngine {
  
  /**
   * Analyze sample and recommend optimal protocols
   */
  analyzeProtocolRecommendation(params: {
    sampleType: SampleType;
    concentration?: number;
    volume?: number;
    targetApplication: string;
    budgetLevel: 'low' | 'medium' | 'high' | 'unlimited';
    timeline: 'urgent' | 'standard' | 'flexible';
    specialRequirements: string[];
  }): ProtocolRecommendation[] {
    const recommendations: ProtocolRecommendation[] = [];

    // DNA-specific protocols
    if (params.sampleType === 'DNA') {
      // High molecular weight DNA protocol
      if (params.concentration && params.concentration >= 50) {
        recommendations.push({
          protocol_name: 'Ligation Sequencing Kit',
          protocol_version: 'SQK-LSK114',
          suitability_score: 95,
          recommended_kit: 'SQK-LSK114',
          estimated_yield: '15-30 Gb',
          estimated_read_length: '10-50 kb average',
          preparation_time: '4-6 hours',
          difficulty_level: 'intermediate',
          special_requirements: ['High molecular weight DNA (>20 kb)', 'Gentle handling required'],
          warnings: ['Avoid vortexing', 'Keep samples on ice'],
          optimization_tips: [
            'Use wide-bore pipette tips',
            'Minimize freeze-thaw cycles',
            'Check DNA integrity with TapeStation'
          ]
        });
      }

      // Rapid sequencing for urgent samples
      if (params.timeline === 'urgent') {
        recommendations.push({
          protocol_name: 'Rapid Sequencing Kit',
          protocol_version: 'SQK-RAD004',
          suitability_score: 80,
          recommended_kit: 'Other',
          estimated_yield: '5-15 Gb',
          estimated_read_length: '5-20 kb average',
          preparation_time: '10 minutes',
          difficulty_level: 'beginner',
          special_requirements: ['DNA concentration >400 ng/μL'],
          warnings: ['Lower yield compared to ligation kits'],
          optimization_tips: [
            'Use fresh DNA',
            'Ensure proper sample concentration',
            'Follow timing precisely'
          ]
        });
      }

      // PCR-based protocols for low input
      if (params.concentration && params.concentration < 10) {
        recommendations.push({
          protocol_name: 'PCR Barcoding Kit',
          protocol_version: 'SQK-PCB111',
          suitability_score: 70,
          recommended_kit: 'SQK-PCB111',
          estimated_yield: '1-5 Gb',
          estimated_read_length: '1-10 kb average',
          preparation_time: '6-8 hours',
          difficulty_level: 'advanced',
          special_requirements: ['PCR amplification step', 'Multiplexing capability'],
          warnings: ['Potential PCR bias', 'Shorter read lengths'],
          optimization_tips: [
            'Optimize PCR cycles',
            'Use high-fidelity polymerase',
            'Monitor amplification efficiency'
          ]
        });
      }
    }

    // RNA-specific protocols
    if (params.sampleType === 'RNA') {
      recommendations.push({
        protocol_name: 'Direct RNA Sequencing Kit',
        protocol_version: 'SQK-RNA002',
        suitability_score: 90,
        recommended_kit: 'SQK-RNA002',
        estimated_yield: '2-10 Gb',
        estimated_read_length: 'Native RNA length',
        preparation_time: '3-4 hours',
        difficulty_level: 'intermediate',
        special_requirements: ['High quality RNA (RIN >8)', 'Poly(A) tail required'],
        warnings: ['RNA degradation sensitive', 'Lower throughput than DNA'],
        optimization_tips: [
          'Keep samples on ice',
          'Use RNase-free environment',
          'Check RNA integrity before prep'
        ]
      });

      recommendations.push({
        protocol_name: 'Direct cDNA Sequencing Kit',
        protocol_version: 'SQK-DCS109',
        suitability_score: 85,
        recommended_kit: 'Other',
        estimated_yield: '5-20 Gb',
        estimated_read_length: '10-30 kb average',
        preparation_time: '5-7 hours',
        difficulty_level: 'advanced',
        special_requirements: ['Reverse transcription step', 'Template switching'],
        warnings: ['Loss of 5\' information', 'Potential RT bias'],
        optimization_tips: [
          'Optimize reverse transcription',
          'Use high-quality reverse transcriptase',
          'Monitor cDNA synthesis efficiency'
        ]
      });
    }

    // Sort by suitability score
    return recommendations.sort((a, b) => b.suitability_score - a.suitability_score);
  }

  /**
   * Assess sample quality and predict success probability
   */
  assessSampleQuality(params: {
    sampleType: SampleType;
    qualityMetrics: QualityMetrics;
    intendedApplication: string;
    flowCellType?: FlowCellType;
  }): QualityAssessment {
    let overallScore = 100;
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Concentration assessment
    if (params.qualityMetrics.concentration !== undefined) {
      const conc = params.qualityMetrics.concentration;
      
      if (params.sampleType === 'DNA') {
        if (conc < 10) {
          overallScore -= 30;
          criticalIssues.push('DNA concentration too low (<10 ng/μL)');
          recommendations.push('Consider PCR amplification or concentrate sample');
        } else if (conc < 50) {
          overallScore -= 15;
          warnings.push('DNA concentration suboptimal (10-50 ng/μL)');
          recommendations.push('Consider concentrating sample for better yield');
        }
        
        if (conc > 2000) {
          overallScore -= 10;
          warnings.push('DNA concentration very high (>2000 ng/μL)');
          recommendations.push('Consider diluting sample to prevent clogging');
        }
      }

      if (params.sampleType === 'RNA') {
        if (conc < 5) {
          overallScore -= 40;
          criticalIssues.push('RNA concentration too low (<5 ng/μL)');
          recommendations.push('Concentrate RNA or consider cDNA synthesis');
        } else if (conc < 25) {
          overallScore -= 20;
          warnings.push('RNA concentration suboptimal (5-25 ng/μL)');
        }
      }
    }

    // Purity assessment
    if (params.qualityMetrics.purity_260_280 !== undefined) {
      const ratio = params.qualityMetrics.purity_260_280;
      
      if (params.sampleType === 'DNA') {
        if (ratio < 1.7 || ratio > 2.0) {
          overallScore -= 25;
          criticalIssues.push(`Poor DNA purity (260/280 = ${ratio})`);
          recommendations.push('Purify DNA using column cleanup or ethanol precipitation');
        } else if (ratio < 1.8 || ratio > 1.9) {
          overallScore -= 10;
          warnings.push(`Suboptimal DNA purity (260/280 = ${ratio})`);
        }
      }

      if (params.sampleType === 'RNA') {
        if (ratio < 1.8 || ratio > 2.2) {
          overallScore -= 30;
          criticalIssues.push(`Poor RNA purity (260/280 = ${ratio})`);
          recommendations.push('Purify RNA and check for protein contamination');
        }
      }
    }

    // DNA integrity assessment
    if (params.qualityMetrics.dna_integrity_number !== undefined) {
      const din = params.qualityMetrics.dna_integrity_number;
      
      if (din < 7) {
        overallScore -= 35;
        criticalIssues.push(`Low DNA integrity (DIN = ${din})`);
        recommendations.push('Use degraded DNA protocols or re-extract from fresh sample');
      } else if (din < 8) {
        overallScore -= 15;
        warnings.push(`Moderate DNA degradation (DIN = ${din})`);
        recommendations.push('Consider size selection to remove short fragments');
      }
    }

    // Contamination assessment
    if (params.qualityMetrics.contamination_level) {
      const level = params.qualityMetrics.contamination_level;
      
      if (level === 'high') {
        overallScore -= 50;
        criticalIssues.push('High contamination detected');
        recommendations.push('Re-extract sample or use contamination removal protocols');
      } else if (level === 'medium') {
        overallScore -= 25;
        warnings.push('Moderate contamination detected');
        recommendations.push('Consider additional purification steps');
      } else if (level === 'low') {
        overallScore -= 10;
        warnings.push('Low level contamination detected');
      }
    }

    // Determine quality grade
    let qualityGrade: 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed';
    if (overallScore >= 90) qualityGrade = 'excellent';
    else if (overallScore >= 75) qualityGrade = 'good';
    else if (overallScore >= 60) qualityGrade = 'acceptable';
    else if (overallScore >= 40) qualityGrade = 'poor';
    else qualityGrade = 'failed';

    // Calculate success probability
    const estimatedSuccessProbability = Math.max(0, Math.min(100, overallScore));

    return {
      overall_score: Math.max(0, overallScore),
      quality_grade: qualityGrade,
      critical_issues: criticalIssues,
      warnings: warnings,
      recommendations: recommendations,
      estimated_success_probability: estimatedSuccessProbability,
      suggested_modifications: criticalIssues.length > 0 ? [
        'Consider alternative protocols for low-quality samples',
        'Implement additional QC steps',
        'Consult with sequencing core facility'
      ] : undefined
    };
  }

  /**
   * Troubleshoot common sequencing issues
   */
  troubleshootIssue(params: {
    issueDescription: string;
    sampleType?: SampleType;
    workflowStage: string;
    observedSymptoms: string[];
    recentChanges: string[];
  }): TroubleshootingIssue[] {
    const issues: TroubleshootingIssue[] = [];

    // Low yield troubleshooting
    if (params.issueDescription.toLowerCase().includes('low yield') || 
        params.observedSymptoms.some(s => s.toLowerCase().includes('yield'))) {
      issues.push({
        issue_type: 'low_yield',
        symptoms: [
          'Lower than expected data output',
          'Fewer active pores',
          'Early sequencing termination'
        ],
        possible_causes: [
          'Low input DNA concentration',
          'Poor DNA quality or integrity',
          'Inefficient library preparation',
          'Flow cell storage issues',
          'Incorrect adapter ligation'
        ],
        diagnostic_steps: [
          'Check input DNA concentration and purity',
          'Verify DNA integrity using gel or TapeStation',
          'Review library preparation protocol adherence',
          'Check flow cell QC metrics',
          'Verify adapter concentrations and ratios'
        ],
        solutions: [
          'Increase input DNA concentration',
          'Improve DNA extraction and purification',
          'Optimize library preparation conditions',
          'Use fresh flow cells stored properly',
          'Adjust adapter ratios and incubation times'
        ],
        prevention_tips: [
          'Always check DNA quality before library prep',
          'Use high molecular weight DNA when possible',
          'Follow storage guidelines strictly',
          'Maintain consistent library prep protocols',
          'Regular equipment calibration'
        ],
        severity: 'high'
      });
    }

    // Poor quality troubleshooting
    if (params.issueDescription.toLowerCase().includes('poor quality') ||
        params.observedSymptoms.some(s => s.toLowerCase().includes('quality'))) {
      issues.push({
        issue_type: 'poor_quality',
        symptoms: [
          'Low mean quality scores',
          'High error rates',
          'Short read lengths',
          'High adapter content'
        ],
        possible_causes: [
          'Degraded DNA input',
          'Contamination in sample',
          'Suboptimal basecalling models',
          'Flow cell age or storage',
          'Temperature fluctuations during sequencing'
        ],
        diagnostic_steps: [
          'Analyze quality score distributions',
          'Check for contamination markers',
          'Review basecalling parameters',
          'Examine flow cell metrics',
          'Monitor sequencing environment'
        ],
        solutions: [
          'Use higher quality DNA inputs',
          'Implement contamination removal steps',
          'Update basecalling models',
          'Use fresh flow cells',
          'Ensure stable sequencing conditions'
        ],
        prevention_tips: [
          'Implement rigorous QC at each step',
          'Maintain clean laboratory environment',
          'Keep software and models updated',
          'Monitor environmental conditions',
          'Regular maintenance of sequencing device'
        ],
        severity: 'medium'
      });
    }

    // Library preparation failure
    if (params.workflowStage === 'library_preparation' || 
        params.issueDescription.toLowerCase().includes('library')) {
      issues.push({
        issue_type: 'library_prep_failure',
        symptoms: [
          'No detectable library',
          'Wrong library size distribution',
          'Low library concentration',
          'Failed adapter ligation'
        ],
        possible_causes: [
          'Incorrect reagent ratios',
          'Expired reagents',
          'Inadequate mixing',
          'Wrong incubation conditions',
          'DNA degradation during prep'
        ],
        diagnostic_steps: [
          'Check library concentration and size',
          'Verify reagent expiry dates',
          'Review protocol step-by-step',
          'Test positive controls',
          'Examine intermediate products'
        ],
        solutions: [
          'Recalculate and verify reagent volumes',
          'Use fresh reagents',
          'Ensure thorough mixing at each step',
          'Optimize incubation conditions',
          'Handle DNA gently throughout prep'
        ],
        prevention_tips: [
          'Always use positive and negative controls',
          'Check reagent storage conditions',
          'Maintain detailed prep logs',
          'Regular protocol training',
          'Batch test new reagent lots'
        ],
        severity: 'high'
      });
    }

    return issues;
  }

  /**
   * Get workflow optimization suggestions
   */
  optimizeWorkflow(params: {
    currentWorkflow: string;
    sampleTypes: SampleType[];
    throughputRequirements?: number;
    qualityRequirements: 'basic' | 'standard' | 'high' | 'research-grade';
    resourceConstraints: string[];
    optimizationGoals: string[];
  }): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Throughput optimization
    if (params.optimizationGoals.includes('increase_throughput')) {
      suggestions.push({
        category: 'workflow_efficiency',
        suggestion: 'Implement batch processing for library preparation',
        expected_improvement: '50-75% reduction in hands-on time',
        implementation_difficulty: 'moderate',
        estimated_cost_impact: 'low',
        priority: 'high',
        supporting_evidence: 'Batch processing reduces setup time and improves consistency'
      });

      suggestions.push({
        category: 'sample_preparation',
        suggestion: 'Use automated DNA extraction systems',
        expected_improvement: '3-5x increase in sample processing capacity',
        implementation_difficulty: 'difficult',
        estimated_cost_impact: 'high',
        priority: 'medium',
        supporting_evidence: 'Automation reduces manual errors and increases reproducibility'
      });
    }

    // Quality optimization
    if (params.optimizationGoals.includes('improve_quality')) {
             suggestions.push({
         category: 'workflow_efficiency',
         suggestion: 'Implement comprehensive QC checkpoints',
         expected_improvement: '25-40% reduction in failed runs',
         implementation_difficulty: 'easy',
         estimated_cost_impact: 'low',
         priority: 'high',
         supporting_evidence: 'Early detection of quality issues prevents costly failures'
       });

      if (params.qualityRequirements === 'research-grade') {
        suggestions.push({
          category: 'sample_preparation',
          suggestion: 'Implement size selection for optimal read length distribution',
          expected_improvement: '2-3x improvement in N50 read length',
          implementation_difficulty: 'moderate',
          estimated_cost_impact: 'medium',
          priority: 'high',
          supporting_evidence: 'Size selection removes short fragments that reduce overall quality'
        });
      }
    }

    // Cost optimization
    if (params.optimizationGoals.includes('reduce_cost')) {
      suggestions.push({
        category: 'sequencing_parameters',
        suggestion: 'Optimize flow cell utilization through multiplexing',
        expected_improvement: '40-60% cost reduction per sample',
        implementation_difficulty: 'moderate',
        estimated_cost_impact: 'none',
        priority: 'high',
        supporting_evidence: 'Multiplexing maximizes data output per flow cell'
      });

      suggestions.push({
        category: 'workflow_efficiency',
        suggestion: 'Implement predictive maintenance schedules',
        expected_improvement: '20-30% reduction in unplanned downtime',
        implementation_difficulty: 'easy',
        estimated_cost_impact: 'low',
        priority: 'medium',
        supporting_evidence: 'Preventive maintenance reduces costly emergency repairs'
      });
    }

    // Time optimization
    if (params.optimizationGoals.includes('reduce_time')) {
      suggestions.push({
        category: 'library_preparation',
        suggestion: 'Switch to rapid library preparation protocols',
        expected_improvement: '4-6 hour reduction in prep time',
        implementation_difficulty: 'easy',
        estimated_cost_impact: 'none',
        priority: 'high',
        supporting_evidence: 'Rapid protocols maintain quality while reducing time'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get best practices for specific expertise areas
   */
  getBestPractices(params: {
    expertiseArea: ExpertiseArea;
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    specificFocus?: string;
  }): BestPractice[] {
    const practices: BestPractice[] = [];

    if (params.expertiseArea === 'sample_preparation') {
      practices.push({
        practice_id: 'sp_001',
        title: 'Maintain DNA integrity throughout extraction',
        description: 'Preserve high molecular weight DNA by using gentle extraction methods and avoiding mechanical shearing',
        applicable_to: ['sample_preparation', 'quality_control'],
        importance_level: 'critical',
        implementation_steps: [
          'Use wide-bore pipette tips for all DNA handling',
          'Avoid vortexing DNA solutions',
          'Keep samples on ice when not in use',
          'Minimize freeze-thaw cycles',
          'Use gentle inversion for mixing'
        ],
        common_mistakes: [
          'Using regular pipette tips for high MW DNA',
          'Vortexing DNA solutions vigorously',
          'Leaving samples at room temperature',
          'Multiple freeze-thaw cycles'
        ],
        success_indicators: [
          'DNA fragment size >20 kb on gel',
          'High DIN scores (>8.0)',
          'Consistent library preparation success'
        ]
      });

      practices.push({
        practice_id: 'sp_002',
        title: 'Implement comprehensive contamination controls',
        description: 'Prevent and detect contamination that can compromise sequencing results',
        applicable_to: ['sample_preparation', 'quality_control'],
        importance_level: 'essential',
        implementation_steps: [
          'Include negative controls in every batch',
          'Use dedicated pipettes for different sample types',
          'Implement UV sterilization protocols',
          'Maintain separate work areas for different projects',
          'Regular equipment decontamination'
        ],
        common_mistakes: [
          'Skipping negative controls',
          'Cross-contamination between samples',
          'Inadequate workspace cleaning',
          'Sharing pipettes between projects'
        ],
        success_indicators: [
          'Clean negative controls',
          'Consistent sample profiles',
          'No unexpected contaminating sequences'
        ]
      });
    }

    if (params.expertiseArea === 'library_preparation') {
      practices.push({
        practice_id: 'lp_001',
        title: 'Optimize adapter ligation efficiency',
        description: 'Ensure maximum library yield through proper adapter ligation conditions',
        applicable_to: ['library_preparation'],
        importance_level: 'critical',
        implementation_steps: [
          'Use optimal adapter:DNA molar ratios (typically 5:1)',
          'Ensure proper ligation buffer composition',
          'Optimize incubation time and temperature',
          'Include ligation controls',
          'Monitor adapter dimer formation'
        ],
        common_mistakes: [
          'Incorrect adapter concentrations',
          'Suboptimal ligation conditions',
          'Excessive adapter dimer formation',
          'Insufficient ligation time'
        ],
        success_indicators: [
          'High library yield (>70% conversion)',
          'Minimal adapter dimers',
          'Consistent library size distribution'
        ]
      });
    }

    if (params.expertiseArea === 'quality_control') {
      practices.push({
        practice_id: 'qc_001',
        title: 'Implement multi-stage quality assessment',
        description: 'Monitor sample quality at critical workflow checkpoints',
        applicable_to: ['quality_control', 'sample_preparation', 'library_preparation'],
        importance_level: 'essential',
        implementation_steps: [
          'Check DNA concentration and purity post-extraction',
          'Assess DNA integrity before library prep',
          'Monitor library concentration and size distribution',
          'Verify flow cell QC metrics before sequencing',
          'Track quality metrics throughout the workflow'
        ],
        common_mistakes: [
          'Skipping intermediate QC steps',
          'Proceeding with poor quality samples',
          'Ignoring warning signs in QC data',
          'Inadequate documentation of QC results'
        ],
        success_indicators: [
          'Predictable sequencing outcomes',
          'Reduced run failures',
          'Consistent data quality metrics'
        ]
      });
    }

    return practices.filter(p => 
      params.experienceLevel === 'beginner' ? 
        p.importance_level === 'critical' || p.importance_level === 'essential' :
      params.experienceLevel === 'intermediate' ?
        p.importance_level !== 'nice-to-have' :
        true // Advanced users see all practices
    );
  }
} 
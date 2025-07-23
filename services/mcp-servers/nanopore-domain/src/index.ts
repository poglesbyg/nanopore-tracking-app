#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { DomainKnowledgeEngine } from './domain-knowledge.js';
import {
  AnalyzeProtocolRequestSchema,
  AssessQualityRequestSchema,
  TroubleshootIssueRequestSchema,
  OptimizeWorkflowRequestSchema,
  GetBestPracticesRequestSchema,
  ValidationError,
  DomainExpertError,
} from './types.js';

/**
 * Nanopore Domain Expert MCP Server
 * Provides specialized domain knowledge and guidance for nanopore sequencing workflows
 */
class NanoporeDomainExpertServer {
  private server: Server;
  private domainEngine: DomainKnowledgeEngine;

  constructor() {
    this.server = new Server(
      {
        name: 'nanopore-domain-expert',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.domainEngine = new DomainKnowledgeEngine();
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      console.log('\nShutting down Nanopore Domain Expert MCP Server...');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_protocol_recommendation',
            description: 'Analyze sample characteristics and recommend optimal nanopore sequencing protocols',
            inputSchema: {
              type: 'object',
              properties: {
                sample_type: {
                  type: 'string',
                  enum: ['DNA', 'RNA', 'Protein', 'Other'],
                  description: 'Type of sample to be sequenced'
                },
                sample_concentration: {
                  type: 'number',
                  minimum: 0,
                  description: 'Sample concentration in ng/μL (optional)'
                },
                sample_volume: {
                  type: 'number',
                  minimum: 0,
                  description: 'Available sample volume in μL (optional)'
                },
                target_application: {
                  type: 'string',
                  description: 'Intended sequencing application (e.g., genome assembly, RNA-seq, metagenomics)'
                },
                budget_level: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'unlimited'],
                  default: 'medium',
                  description: 'Budget constraints for the project'
                },
                timeline: {
                  type: 'string',
                  enum: ['urgent', 'standard', 'flexible'],
                  default: 'standard',
                  description: 'Project timeline requirements'
                },
                special_requirements: {
                  type: 'array',
                  items: { type: 'string' },
                  default: [],
                  description: 'Any special requirements or constraints'
                }
              },
              required: ['sample_type', 'target_application']
            }
          },
          {
            name: 'assess_sample_quality',
            description: 'Assess sample quality metrics and predict sequencing success probability',
            inputSchema: {
              type: 'object',
              properties: {
                sample_id: {
                  type: 'string',
                  description: 'Sample identifier (optional)'
                },
                quality_metrics: {
                  type: 'object',
                  properties: {
                    concentration: { type: 'number', minimum: 0 },
                    volume: { type: 'number', minimum: 0 },
                    purity_260_280: { type: 'number', minimum: 0 },
                    purity_260_230: { type: 'number', minimum: 0 },
                    dna_integrity_number: { type: 'number', minimum: 1, maximum: 10 },
                    fragment_size_distribution: { type: 'string' },
                    contamination_level: { 
                      type: 'string', 
                      enum: ['none', 'low', 'medium', 'high'] 
                    }
                  },
                  description: 'Quality control measurements'
                },
                sample_type: {
                  type: 'string',
                  enum: ['DNA', 'RNA', 'Protein', 'Other'],
                  description: 'Type of sample being assessed'
                },
                intended_application: {
                  type: 'string',
                  description: 'Intended use of the sequencing data'
                },
                flow_cell_type: {
                  type: 'string',
                  enum: ['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other'],
                  description: 'Target flow cell type (optional)'
                }
              },
              required: ['quality_metrics', 'sample_type', 'intended_application']
            }
          },
          {
            name: 'troubleshoot_sequencing_issue',
            description: 'Diagnose and provide solutions for common nanopore sequencing problems',
            inputSchema: {
              type: 'object',
              properties: {
                issue_description: {
                  type: 'string',
                  description: 'Detailed description of the problem encountered'
                },
                sample_type: {
                  type: 'string',
                  enum: ['DNA', 'RNA', 'Protein', 'Other'],
                  description: 'Type of sample involved (optional)'
                },
                workflow_stage: {
                  type: 'string',
                  enum: [
                    'sample_preparation',
                    'quality_control',
                    'library_preparation',
                    'sequencing_setup',
                    'sequencing_run',
                    'basecalling',
                    'data_analysis'
                  ],
                  description: 'Stage of workflow where issue occurred'
                },
                observed_symptoms: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of observed symptoms or error messages'
                },
                recent_changes: {
                  type: 'array',
                  items: { type: 'string' },
                  default: [],
                  description: 'Any recent changes to protocols, reagents, or equipment'
                }
              },
              required: ['issue_description', 'workflow_stage', 'observed_symptoms']
            }
          },
          {
            name: 'optimize_sequencing_workflow',
            description: 'Provide optimization suggestions for nanopore sequencing workflows',
            inputSchema: {
              type: 'object',
              properties: {
                current_workflow: {
                  type: 'string',
                  description: 'Description of current workflow process'
                },
                sample_types: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['DNA', 'RNA', 'Protein', 'Other']
                  },
                  description: 'Types of samples processed in the workflow'
                },
                throughput_requirements: {
                  type: 'number',
                  minimum: 1,
                  description: 'Required samples per day/week (optional)'
                },
                quality_requirements: {
                  type: 'string',
                  enum: ['basic', 'standard', 'high', 'research-grade'],
                  default: 'standard',
                  description: 'Quality level requirements'
                },
                resource_constraints: {
                  type: 'array',
                  items: { type: 'string' },
                  default: [],
                  description: 'Budget, equipment, or personnel constraints'
                },
                optimization_goals: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'increase_yield',
                      'improve_quality',
                      'reduce_time',
                      'reduce_cost',
                      'increase_throughput',
                      'reduce_failure_rate'
                    ]
                  },
                  description: 'Primary optimization objectives'
                }
              },
              required: ['current_workflow', 'sample_types', 'optimization_goals']
            }
          },
          {
            name: 'get_nanopore_best_practices',
            description: 'Retrieve best practices and expert guidance for specific nanopore sequencing areas',
            inputSchema: {
              type: 'object',
              properties: {
                expertise_area: {
                  type: 'string',
                  enum: [
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
                  ],
                  description: 'Specific area of nanopore sequencing expertise'
                },
                experience_level: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced'],
                  default: 'intermediate',
                  description: 'User experience level for tailored recommendations'
                },
                specific_focus: {
                  type: 'string',
                  description: 'Specific aspect within the expertise area (optional)'
                }
              },
              required: ['expertise_area']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_protocol_recommendation':
            return await this.handleProtocolAnalysis(args);
          
          case 'assess_sample_quality':
            return await this.handleQualityAssessment(args);
          
          case 'troubleshoot_sequencing_issue':
            return await this.handleTroubleshooting(args);
          
          case 'optimize_sequencing_workflow':
            return await this.handleWorkflowOptimization(args);
          
          case 'get_nanopore_best_practices':
            return await this.handleBestPractices(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new McpError(ErrorCode.InvalidParams, error.message);
        }
        if (error instanceof DomainExpertError) {
          throw new McpError(ErrorCode.InternalError, error.message);
        }
        throw error;
      }
    });
  }

  private async handleProtocolAnalysis(args: any) {
    const validatedArgs = AnalyzeProtocolRequestSchema.parse(args);
    
    const recommendations = this.domainEngine.analyzeProtocolRecommendation({
      sampleType: validatedArgs.sample_type,
      concentration: validatedArgs.sample_concentration,
      volume: validatedArgs.sample_volume,
      targetApplication: validatedArgs.target_application,
      budgetLevel: validatedArgs.budget_level,
      timeline: validatedArgs.timeline,
      specialRequirements: validatedArgs.special_requirements
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'protocol_recommendation',
            sample_info: {
              type: validatedArgs.sample_type,
              concentration: validatedArgs.sample_concentration,
              volume: validatedArgs.sample_volume,
              application: validatedArgs.target_application
            },
            recommendations: recommendations,
            summary: {
              total_protocols: recommendations.length,
              top_recommendation: recommendations[0]?.protocol_name || 'None available',
              estimated_prep_time: recommendations[0]?.preparation_time || 'Variable',
              estimated_yield: recommendations[0]?.estimated_yield || 'Variable'
            },
            expert_notes: [
              'Protocol selection depends heavily on sample quality and project requirements',
              'Always perform quality control before library preparation',
              'Consider multiplexing to maximize flow cell utilization',
              'Consult latest protocol updates from Oxford Nanopore Technologies'
            ]
          }, null, 2)
        }
      ]
    };
  }

  private async handleQualityAssessment(args: any) {
    const validatedArgs = AssessQualityRequestSchema.parse(args);
    
    const assessment = this.domainEngine.assessSampleQuality({
      sampleType: validatedArgs.sample_type,
      qualityMetrics: validatedArgs.quality_metrics,
      intendedApplication: validatedArgs.intended_application,
      flowCellType: validatedArgs.flow_cell_type
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'quality_assessment',
            sample_id: validatedArgs.sample_id || 'Unknown',
            assessment: assessment,
            interpretation: {
              proceed_with_sequencing: assessment.quality_grade !== 'failed',
              recommended_actions: assessment.critical_issues.length > 0 ? 
                'Address critical issues before proceeding' : 
                'Sample suitable for sequencing',
              risk_level: assessment.critical_issues.length > 0 ? 'High' :
                         assessment.warnings.length > 0 ? 'Medium' : 'Low'
            },
            expert_guidance: {
              quality_thresholds: {
                DNA: {
                  concentration: 'Optimal: >50 ng/μL, Minimum: 10 ng/μL',
                  purity_260_280: 'Optimal: 1.8-1.9, Acceptable: 1.7-2.0',
                  integrity: 'Optimal: DIN >8.0, Minimum: DIN >7.0'
                },
                RNA: {
                  concentration: 'Optimal: >25 ng/μL, Minimum: 5 ng/μL',
                  purity_260_280: 'Optimal: 1.9-2.1, Acceptable: 1.8-2.2',
                  integrity: 'Optimal: RIN >8.0, Minimum: RIN >7.0'
                }
              },
              next_steps: assessment.recommendations
            }
          }, null, 2)
        }
      ]
    };
  }

  private async handleTroubleshooting(args: any) {
    const validatedArgs = TroubleshootIssueRequestSchema.parse(args);
    
    const issues = this.domainEngine.troubleshootIssue({
      issueDescription: validatedArgs.issue_description,
      sampleType: validatedArgs.sample_type,
      workflowStage: validatedArgs.workflow_stage,
      observedSymptoms: validatedArgs.observed_symptoms,
      recentChanges: validatedArgs.recent_changes
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'troubleshooting',
            issue_summary: {
              description: validatedArgs.issue_description,
              workflow_stage: validatedArgs.workflow_stage,
              symptoms_count: validatedArgs.observed_symptoms.length,
              recent_changes: validatedArgs.recent_changes.length
            },
            identified_issues: issues,
            priority_actions: issues
              .filter(issue => issue.severity === 'critical' || issue.severity === 'high')
              .map(issue => ({
                issue_type: issue.issue_type,
                immediate_actions: issue.solutions.slice(0, 2),
                diagnostic_priority: issue.diagnostic_steps.slice(0, 2)
              })),
            expert_recommendations: {
              immediate_steps: [
                'Stop current workflow if safety concerns exist',
                'Document all symptoms and recent changes',
                'Check basic parameters (temperature, reagent expiry, equipment status)',
                'Review protocol adherence step-by-step'
              ],
              prevention_strategy: issues.length > 0 ? issues[0].prevention_tips : [
                'Implement regular equipment maintenance',
                'Maintain detailed workflow logs',
                'Use positive and negative controls',
                'Regular staff training updates'
              ]
            }
          }, null, 2)
        }
      ]
    };
  }

  private async handleWorkflowOptimization(args: any) {
    const validatedArgs = OptimizeWorkflowRequestSchema.parse(args);
    
    const suggestions = this.domainEngine.optimizeWorkflow({
      currentWorkflow: validatedArgs.current_workflow,
      sampleTypes: validatedArgs.sample_types,
      throughputRequirements: validatedArgs.throughput_requirements,
      qualityRequirements: validatedArgs.quality_requirements,
      resourceConstraints: validatedArgs.resource_constraints,
      optimizationGoals: validatedArgs.optimization_goals
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'workflow_optimization',
            current_workflow_analysis: {
              sample_types: validatedArgs.sample_types,
              throughput_target: validatedArgs.throughput_requirements || 'Not specified',
              quality_level: validatedArgs.quality_requirements,
              constraints: validatedArgs.resource_constraints,
              goals: validatedArgs.optimization_goals
            },
            optimization_suggestions: suggestions,
            implementation_roadmap: {
              quick_wins: suggestions.filter(s => 
                s.implementation_difficulty === 'easy' && s.priority === 'high'
              ).map(s => s.suggestion),
              medium_term: suggestions.filter(s => 
                s.implementation_difficulty === 'moderate'
              ).map(s => s.suggestion),
              long_term: suggestions.filter(s => 
                s.implementation_difficulty === 'difficult'
              ).map(s => s.suggestion)
            },
            expected_outcomes: {
              efficiency_gains: suggestions
                .filter(s => s.category === 'workflow_efficiency')
                .map(s => s.expected_improvement),
              quality_improvements: suggestions
                .filter(s => s.category === 'sample_preparation' || s.category === 'library_preparation')
                .map(s => s.expected_improvement),
              cost_savings: suggestions
                .filter(s => s.estimated_cost_impact === 'none' || s.estimated_cost_impact === 'low')
                .map(s => s.expected_improvement)
            }
          }, null, 2)
        }
      ]
    };
  }

  private async handleBestPractices(args: any) {
    const validatedArgs = GetBestPracticesRequestSchema.parse(args);
    
    const practices = this.domainEngine.getBestPractices({
      expertiseArea: validatedArgs.expertise_area,
      experienceLevel: validatedArgs.experience_level,
      specificFocus: validatedArgs.specific_focus
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'best_practices',
            expertise_area: validatedArgs.expertise_area,
            experience_level: validatedArgs.experience_level,
            specific_focus: validatedArgs.specific_focus || 'General guidance',
            best_practices: practices,
            practice_summary: {
              total_practices: practices.length,
              critical_practices: practices.filter(p => p.importance_level === 'critical').length,
              essential_practices: practices.filter(p => p.importance_level === 'essential').length,
              key_focus_areas: [...new Set(practices.flatMap(p => p.applicable_to))]
            },
            implementation_guide: {
              start_here: practices
                .filter(p => p.importance_level === 'critical')
                .map(p => ({
                  title: p.title,
                  first_steps: p.implementation_steps.slice(0, 2),
                  success_metric: p.success_indicators?.[0] || 'Monitor outcomes'
                })),
              common_pitfalls: practices
                .flatMap(p => p.common_mistakes || [])
                .slice(0, 5),
              success_indicators: practices
                .flatMap(p => p.success_indicators || [])
                .slice(0, 5)
            },
            expert_insights: {
              area_overview: this.getAreaOverview(validatedArgs.expertise_area),
              level_guidance: this.getLevelGuidance(validatedArgs.experience_level),
              additional_resources: [
                'Oxford Nanopore Technologies Community',
                'Nanopore sequencing protocols database',
                'Quality control guidelines and standards',
                'Troubleshooting knowledge base'
              ]
            }
          }, null, 2)
        }
      ]
    };
  }

  private getAreaOverview(area: string): string {
    const overviews = {
      sample_preparation: 'Critical foundation for successful nanopore sequencing. Focus on maintaining DNA/RNA integrity and preventing contamination.',
      library_preparation: 'Key step that determines sequencing success. Proper adapter ligation and library quality are essential.',
      sequencing_optimization: 'Maximize flow cell performance through proper setup, monitoring, and parameter optimization.',
      quality_control: 'Essential checkpoints throughout the workflow to ensure data quality and prevent costly failures.',
      troubleshooting: 'Systematic approach to diagnosing and resolving common sequencing issues.',
      data_analysis: 'Proper basecalling, quality assessment, and downstream analysis for reliable results.',
      protocol_selection: 'Choose optimal protocols based on sample type, application, and resource constraints.',
      contamination_detection: 'Identify and prevent contamination that can compromise sequencing results.',
      yield_optimization: 'Maximize data output through sample optimization and protocol refinement.',
      read_length_optimization: 'Achieve optimal read lengths for your specific application requirements.'
    };
    return overviews[area as keyof typeof overviews] || 'Specialized nanopore sequencing guidance.';
  }

  private getLevelGuidance(level: string): string {
    const guidance = {
      beginner: 'Focus on fundamental techniques and critical practices. Master basic protocols before advancing to complex applications.',
      intermediate: 'Build on solid foundations with optimization techniques and troubleshooting skills. Begin exploring advanced applications.',
      advanced: 'Implement cutting-edge techniques, develop custom protocols, and mentor others in best practices.'
    };
    return guidance[level as keyof typeof guidance] || 'Tailored guidance for your experience level.';
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Nanopore Domain Expert MCP Server running on stdio');
  }
}

// Start the server
const server = new NanoporeDomainExpertServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 
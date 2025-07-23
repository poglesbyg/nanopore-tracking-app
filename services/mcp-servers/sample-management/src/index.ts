#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { WorkflowAnalyzer } from './tools/workflow-analyzer.js';
import { AssignmentOptimizer } from './tools/assignment-optimizer.js';
import { DatabaseConnection } from './database.js';

/**
 * Sample Management MCP Server
 * Provides intelligent tools for nanopore sample workflow management
 */
class SampleManagementMCPServer {
  private server: Server;
  private workflowAnalyzer: WorkflowAnalyzer;
  private assignmentOptimizer: AssignmentOptimizer;

  constructor() {
    this.server = new Server(
      {
        name: 'sample-management-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.workflowAnalyzer = new WorkflowAnalyzer();
    this.assignmentOptimizer = new AssignmentOptimizer();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_workflow_performance',
            description: 'Analyze workflow performance and identify bottlenecks over a time period',
            inputSchema: {
              type: 'object',
              properties: {
                timeRangeStart: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Start date for analysis (ISO 8601 format)',
                },
                timeRangeEnd: {
                  type: 'string',
                  format: 'date-time',
                  description: 'End date for analysis (ISO 8601 format)',
                },
                includeCompleted: {
                  type: 'boolean',
                  description: 'Whether to include completed samples in analysis',
                  default: true,
                },
              },
              required: ['timeRangeStart', 'timeRangeEnd'],
            },
          },
          {
            name: 'optimize_sample_schedule',
            description: 'Generate optimized scheduling recommendations for pending samples',
            inputSchema: {
              type: 'object',
              properties: {
                priorityWeights: {
                  type: 'object',
                  properties: {
                    urgent: { type: 'number', default: 4 },
                    high: { type: 'number', default: 3 },
                    normal: { type: 'number', default: 2 },
                    low: { type: 'number', default: 1 },
                  },
                  description: 'Priority weights for scheduling algorithm',
                },
                resourceConstraints: {
                  type: 'object',
                  properties: {
                    max_prep_capacity: { type: 'number', default: 10 },
                    max_sequencing_capacity: { type: 'number', default: 5 },
                  },
                  description: 'Resource capacity constraints',
                },
              },
              required: [],
            },
          },
          {
            name: 'generate_assignment_recommendations',
            description: 'Generate intelligent assignment recommendations for samples to operators',
            inputSchema: {
              type: 'object',
              properties: {
                sample_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific sample IDs to assign (optional - if not provided, assigns all unassigned samples)',
                },
                consider_workload: {
                  type: 'boolean',
                  default: true,
                  description: 'Consider current operator workload in assignments',
                },
                consider_skills: {
                  type: 'boolean',
                  default: true,
                  description: 'Consider operator skills match with sample requirements',
                },
                consider_efficiency: {
                  type: 'boolean',
                  default: true,
                  description: 'Consider operator efficiency ratings',
                },
              },
              required: [],
            },
          },
          {
            name: 'analyze_workload_balance',
            description: 'Analyze current workload balance across operators and suggest improvements',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'predict_completion_times',
            description: 'Predict completion times for samples based on current workflow state',
            inputSchema: {
              type: 'object',
              properties: {
                sample_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Sample IDs to predict completion for (optional - predicts for all active samples if not provided)',
                },
                include_confidence_intervals: {
                  type: 'boolean',
                  default: true,
                  description: 'Include confidence intervals in predictions',
                },
              },
              required: [],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_workflow_performance':
            return await this.handleAnalyzeWorkflowPerformance(args);

          case 'optimize_sample_schedule':
            return await this.handleOptimizeSampleSchedule(args);

          case 'generate_assignment_recommendations':
            return await this.handleGenerateAssignmentRecommendations(args);

          case 'analyze_workload_balance':
            return await this.handleAnalyzeWorkloadBalance(args);

          case 'predict_completion_times':
            return await this.handlePredictCompletionTimes(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleAnalyzeWorkflowPerformance(args: any) {
    const schema = z.object({
      timeRangeStart: z.string(),
      timeRangeEnd: z.string(),
      includeCompleted: z.boolean().default(true),
    });

    const params = schema.parse(args);
    const result = await this.workflowAnalyzer.analyzeWorkflowPerformance(params);

    return {
      content: [
        {
          type: 'text',
          text: `# Workflow Performance Analysis

## Overall Metrics
- **Total Samples**: ${result.overall_metrics.total_samples}
- **Average Processing Time**: ${result.overall_metrics.average_processing_time_hours} hours
- **Completion Rate**: ${result.overall_metrics.completion_rate}%
- **Bottleneck Stages**: ${result.overall_metrics.bottleneck_stages.join(', ') || 'None identified'}

## Stage Performance
${result.stage_performance.map(stage => 
  `- **${stage.step_id}**: ${stage.average_duration}min avg, ${Math.round(stage.success_rate * 100)}% success rate, ${Math.round(stage.bottleneck_score * 100)}% bottleneck score`
).join('\n')}

## Recommendations
${result.recommendations.map(rec => `- ${rec}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleOptimizeSampleSchedule(args: any) {
    const schema = z.object({
      priorityWeights: z.object({
        urgent: z.number(),
        high: z.number(),
        normal: z.number(),
        low: z.number(),
      }).optional(),
      resourceConstraints: z.object({
        max_prep_capacity: z.number(),
        max_sequencing_capacity: z.number(),
      }).optional(),
    });

    const params = schema.parse(args);
    const result = await this.workflowAnalyzer.optimizeSchedule(params);

    return {
      content: [
        {
          type: 'text',
          text: `# Optimized Sample Schedule

## Resource Utilization
- **Prep Capacity**: ${Math.round(result.resource_utilization.prep_utilization * 100)}%
- **Sequencing Capacity**: ${Math.round(result.resource_utilization.sequencing_utilization * 100)}%

## Top Priority Samples (Next ${result.optimized_queue.length})
${result.optimized_queue.map((item, index) => 
  `${index + 1}. **${item.sample_name}** (Score: ${item.priority_score})
   - Start: ${new Date(item.recommended_start_time).toLocaleDateString()}
   - Est. Completion: ${new Date(item.estimated_completion).toLocaleDateString()}`
).join('\n\n')}

## Scheduling Insights
${result.scheduling_insights.map(insight => `- ${insight}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleGenerateAssignmentRecommendations(args: any) {
    const schema = z.object({
      sample_ids: z.array(z.string()).optional(),
      consider_workload: z.boolean().default(true),
      consider_skills: z.boolean().default(true),
      consider_efficiency: z.boolean().default(true),
    });

    const params = schema.parse(args);
    const result = await this.assignmentOptimizer.generateAssignmentRecommendations(params);

    return {
      content: [
        {
          type: 'text',
          text: `# Assignment Recommendations

## Sample Assignments (${result.recommendations.length} samples)
${result.recommendations.map(rec => 
  `- **Sample ${rec.sample_id}** → **${rec.recommended_operator}**
  - Confidence: ${Math.round(rec.confidence_score * 100)}%
  - Reasoning: ${rec.reasoning}
  - Est. Completion: ${new Date(rec.estimated_completion).toLocaleDateString()}`
).join('\n\n')}

## Workload Distribution After Assignments
${result.workload_distribution.map(wd => 
  `- **${wd.operator_name}**: ${wd.current_load} → ${wd.recommended_load} samples (${Math.round(wd.capacity_utilization * 100)}% capacity)`
).join('\n')}

## Optimization Insights
${result.optimization_insights.map(insight => `- ${insight}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleAnalyzeWorkloadBalance(args: any) {
    const result = await this.assignmentOptimizer.analyzeWorkloadBalance();

    return {
      content: [
        {
          type: 'text',
          text: `# Workload Balance Analysis

## Balance Score: ${Math.round(result.balance_score * 100)}%
${result.balance_score > 0.8 ? '✅ Well balanced' : result.balance_score > 0.6 ? '⚠️ Moderately balanced' : '❌ Poorly balanced'}

## Overloaded Operators
${result.overloaded_operators.length > 0 ? result.overloaded_operators.map(op => `- ${op}`).join('\n') : 'None'}

## Underutilized Operators
${result.underutilized_operators.length > 0 ? result.underutilized_operators.map(op => `- ${op}`).join('\n') : 'None'}

## Rebalancing Suggestions
${result.rebalancing_suggestions.map(suggestion => `- ${suggestion}`).join('\n')}`,
        },
      ],
    };
  }

  private async handlePredictCompletionTimes(args: any) {
    // Simplified prediction - in real implementation would use ML models
    return {
      content: [
        {
          type: 'text',
          text: `# Completion Time Predictions

This feature is currently in development. 

For now, use the assignment recommendations tool which includes estimated completion times based on:
- Operator efficiency ratings
- Current workload
- Sample type processing requirements
- Historical performance data

Future enhancements will include:
- Machine learning-based predictions
- Risk factor analysis
- Confidence intervals
- Resource availability forecasting`,
        },
      ],
    };
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await DatabaseConnection.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await DatabaseConnection.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Sample Management MCP Server running on stdio');
  }
}

// Start the server
const server = new SampleManagementMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 
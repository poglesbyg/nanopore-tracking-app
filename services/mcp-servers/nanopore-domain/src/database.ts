import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { DatabaseConfig, LogContext } from './types.js';

// Database schema interfaces (focusing on domain expertise needs)
export interface NanoporeSubmission {
  id: string;
  submission_number: string;
  submitter_name: string;
  submitter_email: string;
  lab_name: string | null;
  project_name: string | null;
  submission_date: Date;
  status: 'submitted' | 'processing' | 'completed' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  total_samples: number;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface NanoporeSample {
  id: string;
  submission_id: string;
  sample_number: number;
  sample_name: string;
  sample_type: 'DNA' | 'RNA' | 'Protein' | 'Other';
  sample_buffer: string | null;
  concentration: number | null;
  volume: number | null;
  total_amount: number | null;
  flow_cell_type: 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other' | null;
  flow_cell_count: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived';
  chart_field: string;
  special_instructions: string | null;
  assigned_to: string | null;
  library_prep_by: string | null;
  metadata: Record<string, any> | null;
  submitted_at: Date;
  updated_at: Date;
}

export interface ProcessingStep {
  id: string;
  sample_id: string;
  step_name: string;
  step_order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  started_at: Date | null;
  completed_at: Date | null;
  performed_by: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface QualityControl {
  id: string;
  sample_id: string;
  qc_type: string;
  qc_result: 'pass' | 'fail' | 'warning';
  measurements: Record<string, any> | null;
  performed_by: string | null;
  performed_at: Date;
  notes: string | null;
  created_at: Date;
}

// Database interface
export interface Database {
  nanopore_submissions: NanoporeSubmission;
  nanopore_samples: NanoporeSample;
  processing_steps: ProcessingStep;
  quality_control: QualityControl;
}

// Simple console logger
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || '')
};

export class DatabaseConnection {
  private db: Kysely<Database>;
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const dialect = new PostgresDialect({
      pool: this.pool
    });

    this.db = new Kysely<Database>({
      dialect,
      log: (event) => {
        if (event.level === 'query') {
          logger.debug('Database query executed', {
            sql: event.query.sql,
            parameters: event.query.parameters,
            duration: event.queryDurationMillis
          });
        }
      }
    });

    // Test connection
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.db.selectFrom('nanopore_samples').select('id').limit(1).execute();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to establish database connection', { error });
      throw error;
    }
  }

  // Domain-specific query methods
  async getSampleWithQualityData(sampleId: string, context?: LogContext): Promise<{
    sample: NanoporeSample;
    qualityControls: QualityControl[];
    processingSteps: ProcessingStep[];
  } | null> {
    try {
      const sample = await this.db
        .selectFrom('nanopore_samples')
        .selectAll()
        .where('id', '=', sampleId)
        .executeTakeFirst();

      if (!sample) {
        return null;
      }

      const [qualityControls, processingSteps] = await Promise.all([
        this.db
          .selectFrom('quality_control')
          .selectAll()
          .where('sample_id', '=', sampleId)
          .orderBy('performed_at', 'desc')
          .execute(),
        
        this.db
          .selectFrom('processing_steps')
          .selectAll()
          .where('sample_id', '=', sampleId)
          .orderBy('step_order', 'asc')
          .execute()
      ]);

      logger.info('Retrieved sample with quality data', {
        ...context,
        sampleId,
        qualityControlCount: qualityControls.length,
        processingStepCount: processingSteps.length
      });

      return {
        sample,
        qualityControls,
        processingSteps
      };
    } catch (error) {
      logger.error('Failed to retrieve sample with quality data', {
        ...context,
        sampleId,
        error
      });
      throw error;
    }
  }

  async getSamplesByType(sampleType: string, limit: number = 100, context?: LogContext): Promise<NanoporeSample[]> {
    try {
      const samples = await this.db
        .selectFrom('nanopore_samples')
        .selectAll()
        .where('sample_type', '=', sampleType as any)
        .orderBy('submitted_at', 'desc')
        .limit(limit)
        .execute();

      logger.info('Retrieved samples by type', {
        ...context,
        sampleType,
        count: samples.length,
        limit
      });

      return samples;
    } catch (error) {
      logger.error('Failed to retrieve samples by type', {
        ...context,
        sampleType,
        error
      });
      throw error;
    }
  }

  async getQualityTrends(
    timeframe: 'week' | 'month' | 'quarter',
    sampleType?: string,
    context?: LogContext
  ): Promise<Array<{
    date: string;
    pass_rate: number;
    average_concentration: number | null;
    sample_count: number;
  }>> {
    try {
      // Simplified implementation - in production would use proper time-based aggregation
      const samples = await this.db
        .selectFrom('nanopore_samples')
        .selectAll()
        .limit(100)
        .execute();

      // Mock quality trends for demonstration
      const trends = [
        {
          date: new Date().toISOString().split('T')[0],
          pass_rate: 85,
          average_concentration: 75.5,
          sample_count: samples.length
        }
      ];

      logger.info('Retrieved quality trends (simplified)', {
        ...context,
        timeframe,
        sampleType,
        resultCount: trends.length
      });

      return trends;
    } catch (error) {
      logger.error('Failed to retrieve quality trends', {
        ...context,
        timeframe,
        sampleType,
        error
      });
      throw error;
    }
  }

  async getFailurePatterns(
    timeframe: 'week' | 'month' | 'quarter',
    context?: LogContext
  ): Promise<Array<{
    failure_type: string;
    count: number;
    percentage: number;
    common_factors: string[];
  }>> {
    try {
      // Simplified implementation - in production would analyze real failure data
      const mockPatterns = [
        {
          failure_type: 'low_yield',
          count: 5,
          percentage: 45,
          common_factors: ['Low concentration (<10 ng/μL)', 'Predominantly DNA samples']
        },
        {
          failure_type: 'poor_quality',
          count: 3,
          percentage: 27,
          common_factors: ['High concentration (>1000 ng/μL)']
        },
        {
          failure_type: 'library_prep_failure',
          count: 3,
          percentage: 27,
          common_factors: ['Predominantly RNA samples']
        }
      ];

      logger.info('Retrieved failure patterns (simplified)', {
        ...context,
        timeframe,
        totalFailures: 11,
        patternCount: mockPatterns.length
      });

      return mockPatterns;
    } catch (error) {
      logger.error('Failed to retrieve failure patterns', {
        ...context,
        timeframe,
        error
      });
      throw error;
    }
  }

  private extractCommonFactors(samples: any[]): string[] {
    const factors = [];
    
    // Analyze concentration ranges
    const concentrations = samples.filter(s => s.concentration).map(s => s.concentration);
    if (concentrations.length > 0) {
      const avgConc = concentrations.reduce((a, b) => a + b, 0) / concentrations.length;
      if (avgConc < 10) factors.push('Low concentration (<10 ng/μL)');
      if (avgConc > 1000) factors.push('High concentration (>1000 ng/μL)');
    }

    // Analyze sample types
    const sampleTypes = samples.map(s => s.sample_type);
    const typeFreq = sampleTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantType = Object.keys(typeFreq).reduce((a, b) => 
      typeFreq[a] > typeFreq[b] ? a : b
    );
    
    if (typeFreq[dominantType] / samples.length > 0.7) {
      factors.push(`Predominantly ${dominantType} samples`);
    }

    return factors;
  }

  async close(): Promise<void> {
    try {
      await this.db.destroy();
      await this.pool.end();
      logger.info('Database connection closed successfully');
    } catch (error) {
      logger.error('Error closing database connection', { error });
      throw error;
    }
  }

  // Direct database access for complex queries
  get kysely(): Kysely<Database> {
    return this.db;
  }
}

// Database connection factory
export function createDatabaseConnection(config: DatabaseConfig): DatabaseConnection {
  return new DatabaseConnection(config);
} 
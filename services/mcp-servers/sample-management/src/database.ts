import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

// Database schema interface (matching our existing schema)
interface Database {
  nanopore_samples: {
    id: string;
    sample_name: string;
    submission_id: string;
    sample_number: number;
    sample_type: 'DNA' | 'RNA' | 'Protein' | 'Other';
    status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    concentration?: number;
    volume?: number;
    flow_cell_type?: 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other';
    assigned_to?: string;
    library_prep_by?: string;
    submitted_at: string;
    updated_at: string;
    created_at: string;
  };
  nanopore_submissions: {
    id: string;
    submission_number: string;
    submitter_name: string;
    submitter_email: string;
    lab_name?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    created_at: string;
    updated_at: string;
  };
}

class DatabaseConnection {
  private static instance: Kysely<Database> | null = null;

  static getInstance(): Kysely<Database> {
    if (!this.instance) {
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'nanopore_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.instance = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool,
        }),
      });
    }

    return this.instance;
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.destroy();
      this.instance = null;
    }
  }
}

export { DatabaseConnection };
export type { Database }; 
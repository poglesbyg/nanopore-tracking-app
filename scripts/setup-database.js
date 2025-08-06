#!/usr/bin/env node

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function setupDatabase() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/nanopore_db'
  const dbName = dbUrl.split('/').pop()
  const baseUrl = dbUrl.replace(`/${dbName}`, '/postgres')
  
  // First connect to postgres database to create our target database if needed
  const adminPool = new Pool({ connectionString: baseUrl })
  
  try {
    console.log('🔗 Connecting to PostgreSQL...')
    
    // Check if target database exists
    const result = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1', 
      [dbName]
    )
    
    if (result.rows.length === 0) {
      console.log(`🗄️ Creating database ${dbName}...`)
      await adminPool.query(`CREATE DATABASE "${dbName}"`)
      console.log('✅ Database created successfully')
    } else {
      console.log(`✅ Database ${dbName} already exists`)
    }
  } catch (error) {
    console.error('❌ Database creation failed:', error)
    throw error
  } finally {
    await adminPool.end()
  }
  
  // Now connect to the target database
  const pool = new Pool({ connectionString: dbUrl })
  
  try {
    console.log('🔗 Connecting to target database...')
    
    // Test connection
    await pool.query('SELECT NOW()')
    console.log('✅ Database connection successful')

    // Create users table first (referenced by nanopore_samples)
    console.log('👤 Creating users table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Insert demo user
    await pool.query(`
      INSERT INTO users (id, email, name) 
      VALUES (gen_random_uuid(), 'demo@example.com', 'Demo User') 
      ON CONFLICT (email) DO NOTHING;
    `)

    // Create trigger function for timestamps
    console.log('⏰ Creating timestamp trigger function...')
    await pool.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    // Read and execute migration files
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations')
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`)
      const migrationPath = path.join(migrationsDir, file)
      const migration = fs.readFileSync(migrationPath, 'utf8')
      
      try {
        await pool.query(migration)
        console.log(`✅ Migration ${file} completed successfully`)
      } catch (error) {
        console.log(`⚠️  Migration ${file} may have already been applied:`, error.message)
      }
    }

    console.log('🎉 Database setup completed successfully!')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

setupDatabase() 
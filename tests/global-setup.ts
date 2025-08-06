import { chromium, FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import { logger } from '../src/lib/logger'

async function globalSetup(config: FullConfig) {
  logger.info('🧪 Starting global test setup...')
  
  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/nanopore_test_db'
    process.env.LOG_LEVEL = 'error' // Reduce logging during tests
    
    // Setup test database
    logger.info('📊 Setting up test database...')
    try {
      execSync('npm run db:setup', { 
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      })
      logger.info('✅ Test database setup completed')
    } catch (error) {
      logger.error('❌ Test database setup failed', {}, error as Error)
      throw error
    }
    
    // Create test data
    logger.info('📝 Creating test data...')
    await createTestData()
    
    // Verify application is running
    logger.info('🔍 Verifying application startup...')
    const browser = await chromium.launch()
    const page = await browser.newPage()
    
    try {
      await page.goto(config.projects[0].use.baseURL || 'http://localhost:3001')
      await page.waitForLoadState('networkidle')
      logger.info('✅ Application is accessible')
    } catch (error) {
      logger.error('❌ Application startup verification failed', {}, error as Error)
      throw error
    } finally {
      await browser.close()
    }
    
    logger.info('🎉 Global test setup completed successfully')
    
  } catch (error) {
    logger.error('💥 Global test setup failed', {}, error as Error)
    throw error
  }
}

async function createTestData() {
  // Import database connection
  const { db } = await import('../src/lib/database')
  
  try {
    // Create minimal test users
    const testUser = {
      id: randomUUID(),
      email: 'e2e.test@example.com',
      name: 'E2E Test User',
      created_at: new Date(),
      updated_at: new Date()
    }
    
    await db
      .insertInto('users')
      .values(testUser)
      .onConflict((oc) => oc.column('email').doNothing())
      .execute()
    
    logger.info('✅ Minimal test data created successfully')
    
  } catch (error) {
    logger.error('❌ Test data creation failed', {}, error as Error)
    // Don't throw error - tests can still run without extensive test data
    logger.info('⚠️ Continuing with minimal test setup')
  }
}

export default globalSetup 
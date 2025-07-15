import { describe, it, expect, testFramework, sampleFixtures } from '../../src/lib/testing/TestFramework'
import { SampleService } from '../../src/services/implementations/SampleService'
import { cacheManager } from '../../src/lib/cache/CacheManager'
import type { TestContext } from '../../src/lib/testing/TestFramework'
import type { ISampleRepository } from '../../src/services/interfaces/ISampleRepository'
import type { IAuditLogger } from '../../src/services/interfaces/IAuditLogger'
import type { IEventEmitter } from '../../src/services/interfaces/IEventEmitter'
import type { CreateSampleData, UpdateSampleData } from '../../src/services/interfaces/ISampleService'

// Mock implementations
const mockSampleRepository: ISampleRepository = {
  create: async (data: CreateSampleData) => ({
    id: `sample-${Date.now()}`,
    sample_name: data.sampleName,
    project_id: data.projectId || null,
    submitter_name: data.submitterName,
    submitter_email: data.submitterEmail,
    lab_name: data.labName || null,
    sample_type: data.sampleType,
    sample_buffer: data.sampleBuffer || null,
    concentration: data.concentration || null,
    volume: data.volume || null,
    total_amount: data.totalAmount || null,
    flow_cell_type: data.flowCellType || null,
    flow_cell_count: data.flowCellCount || null,
    status: 'submitted',
    priority: data.priority || 'normal',
    assigned_to: data.assignedTo || null,
    library_prep_by: data.libraryPrepBy || null,
    chart_field: data.chartField || null,
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'test-user'
  }),
  findById: async (id: string) => null,
  findAll: async () => [],
  update: async (id: string, data: UpdateSampleData) => null,
  delete: async (id: string) => true,
  findByStatus: async (status: string) => [],
  findByPriority: async (priority: string) => [],
  search: async (criteria: any) => []
}

const mockAuditLogger: IAuditLogger = {
  log: async (entry: any) => {}
}

const mockEventEmitter: IEventEmitter = {
  emit: async (event: string, data: any) => {}
}

describe('SampleService', {
  name: 'SampleService Unit Tests',
  timeout: 5000,
  retries: 1,
  parallel: false,
  setup: async () => {
    // Clear cache before all tests
    await cacheManager.clear()
  },
  teardown: async () => {
    // Clear test results
    testFramework.clearResults()
  },
  beforeEach: async (context: TestContext) => {
    await testFramework.setupIntegrationTest(context)
  }
})

// Test sample creation
it('should create a new sample successfully', async (context: TestContext) => {
  const sampleService = new SampleService()
  const sampleData = {
    sample_name: 'Test Sample',
    project_id: 'TEST-001',
    submitter_name: 'John Doe',
    submitter_email: 'john@example.com',
    lab_name: 'Test Lab',
    sample_type: 'DNA',
    sample_buffer: 'TE',
    concentration: 10.5,
    volume: 50,
    total_amount: 525,
    flow_cell_type: 'R9.4',
    flow_cell_count: 1,
    status: 'submitted',
    priority: 'normal',
    chart_field: 'TEST-CHART',
    created_by: `test-${context.testId}`
  }

  const result = await testFramework.measurePerformance(
    'createSample',
    async () => {
      return await testFramework.withTestDatabase(async (db) => {
        return await sampleService.createSample(sampleData)
      }, context)
    },
    context
  )

  expect.truthy(result.result, 'Sample should be created')
  expect.truthy(result.result.id, 'Sample should have an ID')
  expect.equals(result.result.sample_name, sampleData.sample_name, 'Sample name should match')
  expect.equals(result.result.status, 'submitted', 'Initial status should be submitted')
  expect.truthy(result.duration < 1000, 'Creation should be fast')
  
  context.metadata.assertions = 5
})

// Test sample retrieval
it('should retrieve all samples with pagination', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  // Create test fixtures
  const fixture1 = sampleFixtures.basicSample(context.testId)
  const fixture2 = sampleFixtures.urgentSample(context.testId)
  
  await testFramework.createFixture(fixture1, context)
  await testFramework.createFixture(fixture2, context)

  const result = await testFramework.measurePerformance(
    'getAllSamples',
    async () => {
      return await testFramework.withTestDatabase(async (db) => {
        return await sampleService.getAllSamples()
      }, context)
    },
    context
  )

  expect.truthy(Array.isArray(result.result), 'Should return an array')
  expect.truthy(result.result.length >= 2, 'Should include test fixtures')
  expect.truthy(result.duration < 2000, 'Retrieval should be fast')
  
  context.metadata.assertions = 3
})

// Test sample update
it('should update sample status successfully', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  // Create test fixture
  const fixture = sampleFixtures.basicSample(context.testId)
  await testFramework.createFixture(fixture, context)

  const updateData = {
    status: 'prep',
    assigned_to: 'Test Technician',
    updated_by: `test-${context.testId}`
  }

  const result = await testFramework.measurePerformance(
    'updateSample',
    async () => {
      return await testFramework.withTestDatabase(async (db) => {
        return await sampleService.updateSample(fixture.data.id, updateData)
      }, context)
    },
    context
  )

  expect.truthy(result.result, 'Update should return result')
  expect.equals(result.result.status, 'prep', 'Status should be updated')
  expect.equals(result.result.assigned_to, updateData.assigned_to, 'Assignment should be updated')
  expect.truthy(result.duration < 500, 'Update should be fast')
  
  context.metadata.assertions = 4
})

// Test sample deletion
it('should delete sample successfully', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  // Create test fixture
  const fixture = sampleFixtures.basicSample(context.testId)
  await testFramework.createFixture(fixture, context)

  const result = await testFramework.measurePerformance(
    'deleteSample',
    async () => {
      return await testFramework.withTestDatabase(async (db) => {
        return await sampleService.deleteSample(fixture.data.id)
      }, context)
    },
    context
  )

  expect.truthy(result.result, 'Delete should return success')
  
  // Verify sample is actually deleted
  const samples = await sampleService.getAllSamples()
  const deletedSample = samples.find(s => s.id === fixture.data.id)
  expect.falsy(deletedSample, 'Sample should be deleted')
  
  context.metadata.assertions = 2
})

// Test error handling
it('should handle invalid sample data gracefully', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  const invalidData = {
    // Missing required fields
    sample_name: '',
    project_id: null,
    submitter_name: null
  }

  await expect.throws(
    async () => {
      await testFramework.withTestDatabase(async (db) => {
        return await sampleService.createSample(invalidData as any)
      }, context)
    },
    'Should throw error for invalid data'
  )
  
  context.metadata.assertions = 1
})

// Test caching behavior
it('should cache sample retrieval for performance', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  // Create test fixture
  const fixture = sampleFixtures.basicSample(context.testId)
  await testFramework.createFixture(fixture, context)

  // First call - should hit database
  const firstResult = await testFramework.measurePerformance(
    'firstGetAllSamples',
    async () => {
      return await sampleService.getAllSamples()
    },
    context
  )

  // Second call - should hit cache
  const secondResult = await testFramework.measurePerformance(
    'secondGetAllSamples',
    async () => {
      return await sampleService.getAllSamples()
    },
    context
  )

  expect.deepEquals(firstResult.result, secondResult.result, 'Results should be identical')
  expect.truthy(secondResult.duration < firstResult.duration, 'Second call should be faster (cached)')
  
  context.metadata.assertions = 2
})

// Test priority handling
it('should handle urgent samples with correct priority', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  const urgentSampleData = {
    sample_name: 'Urgent Test Sample',
    project_id: 'URGENT-001',
    submitter_name: 'Jane Doe',
    submitter_email: 'jane@example.com',
    lab_name: 'Emergency Lab',
    sample_type: 'RNA',
    status: 'submitted',
    priority: 'urgent',
    created_by: `test-${context.testId}`
  }

  const result = await testFramework.withTestDatabase(async (db) => {
    return await sampleService.createSample(urgentSampleData)
  }, context)

  expect.equals(result.priority, 'urgent', 'Priority should be set correctly')
  expect.truthy(result.id, 'Urgent sample should be created')
  
  // Verify urgent samples are returned first in queries
  const allSamples = await sampleService.getAllSamples()
  const urgentSamples = allSamples.filter(s => s.priority === 'urgent')
  expect.arrayIncludes(urgentSamples.map(s => s.id), result.id, 'Urgent sample should be in results')
  
  context.metadata.assertions = 3
})

// Test workflow status transitions
it('should validate status transitions correctly', async (context: TestContext) => {
  const sampleService = new SampleService()
  
  // Create test fixture
  const fixture = sampleFixtures.basicSample(context.testId)
  await testFramework.createFixture(fixture, context)

  // Valid transition: submitted -> prep
  const validUpdate = await testFramework.withTestDatabase(async (db) => {
    return await sampleService.updateSample(fixture.data.id, {
      status: 'prep',
      updated_by: `test-${context.testId}`
    })
  }, context)

  expect.equals(validUpdate.status, 'prep', 'Valid status transition should work')

  // Test another valid transition: prep -> sequencing
  const secondUpdate = await testFramework.withTestDatabase(async (db) => {
    return await sampleService.updateSample(fixture.data.id, {
      status: 'sequencing',
      updated_by: `test-${context.testId}`
    })
  }, context)

  expect.equals(secondUpdate.status, 'sequencing', 'Sequential status transition should work')
  
  context.metadata.assertions = 2
})

// Performance benchmark test
it('should handle bulk operations efficiently', async (context: TestContext) => {
  const sampleService = new SampleService()
  const bulkSize = 10
  
  const bulkCreateData = Array.from({ length: bulkSize }, (_, i) => ({
    sample_name: `Bulk Sample ${i}`,
    project_id: `BULK-${i}`,
    submitter_name: 'Bulk Tester',
    submitter_email: 'bulk@example.com',
    lab_name: 'Bulk Lab',
    sample_type: 'DNA',
    status: 'submitted',
    priority: 'normal',
    created_by: `test-${context.testId}`
  }))

  const bulkResult = await testFramework.measurePerformance(
    'bulkCreateSamples',
    async () => {
      const results = []
      for (const data of bulkCreateData) {
        const result = await testFramework.withTestDatabase(async (db) => {
          return await sampleService.createSample(data)
        }, context)
        results.push(result)
      }
      return results
    },
    context
  )

  expect.equals(bulkResult.result.length, bulkSize, 'All bulk samples should be created')
  expect.truthy(bulkResult.duration < 5000, 'Bulk creation should complete in reasonable time')
  expect.truthy(bulkResult.memoryUsage < 50 * 1024 * 1024, 'Memory usage should be reasonable')
  
  context.metadata.assertions = 3
})

// Export for test runner
export default {
  suiteName: 'SampleService Unit Tests',
  testFramework
} 
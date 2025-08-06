import { Page, expect } from '@playwright/test'

// Authentication helpers
export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string = 'test.user@example.com', password: string = 'demo') {
    await this.page.goto('/nanopore')
    
    // Wait for login form to appear
    await this.page.waitForSelector('input[type="email"]')
    
    // Fill login form
    await this.page.fill('input[type="email"]', email)
    await this.page.fill('input[type="password"]', password)
    
    // Submit form
    await this.page.click('button[type="submit"]')
    
    // Wait for dashboard to load
    await this.page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 })
    
    // Verify login success
    await expect(this.page.locator('text=Nanopore Tracking')).toBeVisible()
  }

  async loginAsAdmin() {
    await this.login('test.admin@example.com', 'demo')
  }

  async loginAsStaff() {
    await this.login('test.staff@example.com', 'demo')
  }

  async logout() {
    // Open user menu
    await this.page.click('[data-testid="user-menu-button"]')
    
    // Click logout
    await this.page.click('text=Sign Out')
    
    // Verify logout
    await expect(this.page.locator('text=Sign In')).toBeVisible()
  }
}

// PDF Submission helpers
export class PDFSubmissionHelper {
  constructor(private page: Page) {}

  async uploadPDF(pdfPath: string) {
    const fileChooserPromise = this.page.waitForEvent('filechooser')
    await this.page.click('label:has-text("Click to upload HTSF")')
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(pdfPath)
    
    // Wait for processing
    await expect(this.page.locator('text=/PDF uploaded and processed/')).toBeVisible({ timeout: 15000 })
  }

  async createProjectFromPDF(projectName: string) {
    await expect(this.page.locator('[data-testid="create-project-modal"]')).toBeVisible()
    await this.page.fill('input[name="name"]', projectName)
    await this.page.click('button:has-text("Create Project")')
    await expect(this.page.locator('[data-testid="create-project-modal"]')).not.toBeVisible()
  }

  async submitSubmission(submissionName: string) {
    await this.page.fill('input[name="submissionName"]', submissionName)
    await this.page.click('button:has-text("Create Submission")')
    
    // Wait for success
    await expect(this.page.locator('text=Submission Created Successfully!')).toBeVisible({ timeout: 10000 })
  }
}

// Workflow Management helpers
export class WorkflowHelper {
  constructor(private page: Page) {}

  async openSampleDetail(sampleId?: string) {
    const selector = sampleId ? `[data-sample-id="${sampleId}"]` : '[data-sample-id]'
    await this.page.locator(selector).first().click()
    await expect(this.page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()
  }

  async updateWorkflowStage(stage: string) {
    await this.page.click('button:has-text("Edit")')
    await this.page.selectOption('select[name="workflowStage"]', stage)
    await this.page.click('button:has-text("Save Changes")')
  }

  async verifyStageTransition(expectedStage: string) {
    await expect(this.page.locator('text=Sample updated successfully')).toBeVisible()
    await expect(this.page.locator('[data-testid="current-stage"]')).toContainText(expectedStage)
  }

  async closeSampleModal() {
    await this.page.click('button:has-text("Close")')
    await expect(this.page.locator('[data-testid="sample-detail-modal"]')).not.toBeVisible()
  }
}

// Bulk Operations helpers
export class BulkOperationsHelper {
  constructor(private page: Page) {}

  async enableBulkMode() {
    await this.page.click('button:has-text("Bulk Operations")')
    await expect(this.page.locator('input[type="checkbox"][data-sample-checkbox]').first()).toBeVisible()
  }

  async selectSamples(count: number) {
    for (let i = 0; i < count; i++) {
      await this.page.locator('input[type="checkbox"][data-sample-checkbox]').nth(i).check()
    }
    await expect(this.page.locator(`text=/${count} samples selected/`)).toBeVisible()
  }

  async applyBulkOperation(operation: string, value?: string) {
    await this.page.click('button:has-text("Apply Operations")')
    await expect(this.page.locator('[data-testid="bulk-operations-modal"]')).toBeVisible()
    
    await this.page.selectOption('select[name="operation"]', operation)
    if (value) {
      await this.page.selectOption('select[name="priority"], select[name="status"], select[name="workflowStage"]', value)
    }
    
    await this.page.click('button:has-text("Apply to Selected Samples")')
    await expect(this.page.locator('text=Bulk operation completed successfully')).toBeVisible()
  }

  async selectAllVisible() {
    await this.page.click('button:has-text("Select All Visible")')
  }

  async clearAllSelections() {
    await this.page.click('button:has-text("Clear All")')
    await expect(this.page.locator('text=/0 samples selected/')).toBeVisible()
  }
}

// Export helpers
export class ExportHelper {
  constructor(private page: Page) {}

  async openExportModal() {
    await this.page.click('button:has-text("📊 Export Data")')
    await expect(this.page.locator('[data-testid="export-modal"]')).toBeVisible()
  }

  async configureExport(entityType: string, format: string, fields: string[]) {
    await this.page.selectOption('select[name="entityType"]', entityType)
    await this.page.selectOption('select[name="format"]', format)
    
    for (const field of fields) {
      await this.page.check(`input[name="fields"][value="${field}"]`)
    }
  }

  async executeExport() {
    const downloadPromise = this.page.waitForEvent('download')
    await this.page.click('button:has-text("Export Data")')
    return await downloadPromise
  }
}

// Hierarchy Dashboard helpers
export class HierarchyHelper {
  constructor(private page: Page) {}

  async waitForDashboardLoad() {
    await this.page.waitForSelector('[data-testid="hierarchical-dashboard"]', { timeout: 10000 })
  }

  async expandProject(projectName?: string) {
    const selector = projectName ? `[data-testid="project-row"]:has-text("${projectName}")` : '[data-testid="project-row"]'
    await this.page.locator(selector).first().click()
  }

  async expandSubmission(submissionName?: string) {
    const selector = submissionName ? `[data-testid="submission-row"]:has-text("${submissionName}")` : '[data-testid="submission-row"]'
    await this.page.locator(selector).first().click()
  }

  async verifySampleCount(expectedCount: number) {
    const actualCount = await this.page.locator('[data-testid="sample-row"]').count()
    expect(actualCount).toBe(expectedCount)
  }

  async verifyStatistics() {
    await expect(this.page.locator('[data-testid="total-projects"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="total-submissions"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="total-samples"]')).toBeVisible()
  }
}

// Sample management helpers
export class SampleHelper {
  constructor(private page: Page) {}

  async createSample(sampleData: {
    sampleName: string
    submitterName: string
    submitterEmail: string
    sampleType: string
    chartField: string
    concentration?: number
    volume?: number
  }) {
    // Open create sample modal
    await this.page.click('text=New Sample')
    
    // Wait for modal to appear
    await this.page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Fill required fields
    await this.page.fill('input[name="sampleName"]', sampleData.sampleName)
    await this.page.fill('input[name="submitterName"]', sampleData.submitterName)
    await this.page.fill('input[name="submitterEmail"]', sampleData.submitterEmail)
    await this.page.selectOption('select[name="sampleType"]', sampleData.sampleType)
    await this.page.selectOption('select[name="chartField"]', sampleData.chartField)
    
    // Fill optional fields if provided
    if (sampleData.concentration) {
      await this.page.fill('input[name="concentration"]', sampleData.concentration.toString())
    }
    if (sampleData.volume) {
      await this.page.fill('input[name="volume"]', sampleData.volume.toString())
    }
    
    // Submit form
    await this.page.click('button[type="submit"]')
    
    // Wait for success message
    await expect(this.page.locator('text=Sample created successfully')).toBeVisible()
    
    // Wait for modal to close
    await this.page.waitForSelector('[data-testid="create-sample-modal"]', { state: 'hidden' })
  }

  async searchSamples(searchTerm: string) {
    await this.page.fill('input[placeholder*="Search samples"]', searchTerm)
    
    // Wait for search results
    await this.page.waitForTimeout(500) // Debounce
  }

  async filterByStatus(status: string) {
    await this.page.selectOption('select[name="statusFilter"]', status)
    
    // Wait for filter to apply
    await this.page.waitForTimeout(500)
  }

  async filterByPriority(priority: string) {
    await this.page.selectOption('select[name="priorityFilter"]', priority)
    
    // Wait for filter to apply
    await this.page.waitForTimeout(500)
  }

  async getSampleCount(): Promise<number> {
    const countText = await this.page.textContent('[data-testid="sample-count"]')
    return parseInt(countText?.match(/\d+/)?.[0] || '0')
  }

  async verifySampleExists(sampleName: string) {
    await expect(this.page.locator(`text=${sampleName}`)).toBeVisible()
  }

  async updateSampleStatus(sampleName: string, newStatus: string) {
    // Find sample row
    const sampleRow = this.page.locator(`[data-testid="sample-row"]:has-text("${sampleName}")`)
    
    // Click manage button
    await sampleRow.locator('button:has-text("Manage")').click()
    
    // Update status (this would depend on your actual UI)
    // Implementation depends on your status update modal/dropdown
    await this.page.selectOption('select[name="status"]', newStatus)
    await this.page.click('button:has-text("Update")')
    
    // Wait for success message
    await expect(this.page.locator('text=Sample updated successfully')).toBeVisible()
  }
}

// Dashboard helpers
export class DashboardHelper {
  constructor(private page: Page) {}

  async waitForDashboardLoad() {
    await this.page.waitForSelector('[data-testid="dashboard"]')
    await this.page.waitForSelector('[data-testid="stats-cards"]')
    await this.page.waitForLoadState('networkidle')
  }

  async getStatCardValue(statName: string): Promise<number> {
    const statCard = this.page.locator(`[data-testid="stat-card-${statName}"]`)
    const valueText = await statCard.locator('.text-2xl').textContent()
    return parseInt(valueText || '0')
  }

  async verifyStatsCards() {
    await expect(this.page.locator('[data-testid="stat-card-total"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="stat-card-submitted"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="stat-card-in-progress"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="stat-card-completed"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="stat-card-urgent"]')).toBeVisible()
  }

  async verifyHeaderElements() {
    await expect(this.page.locator('text=Nanopore Tracking')).toBeVisible()
    await expect(this.page.locator('button:has-text("Export")')).toBeVisible()
    await expect(this.page.locator('button:has-text("Upload PDF")')).toBeVisible()
    await expect(this.page.locator('button:has-text("New Sample")')).toBeVisible()
  }
}

// AI/Form processing helpers
export class AIHelper {
  constructor(private page: Page) {}

  async testAISuggestions() {
    // Open create sample modal
    await this.page.click('text=New Sample')
    
    // Wait for modal
    await this.page.waitForSelector('[data-testid="create-sample-modal"]')
    
    // Fill sample type to trigger AI suggestions
    await this.page.selectOption('select[name="sampleType"]', 'Genomic DNA')
    
    // Click AI assistance button
    await this.page.click('button:has-text("Suggest Settings")')
    
    // Wait for AI processing
    await this.page.waitForSelector('text=AI suggested optimal settings', { timeout: 10000 })
    
    // Verify suggestions were applied
    const flowCellValue = await this.page.inputValue('select[name="flowCellType"]')
    expect(flowCellValue).toBeTruthy()
  }

  async testPDFUpload() {
    // This would test PDF upload functionality
    // Implementation depends on your PDF upload component
    await this.page.click('button:has-text("Upload PDF")')
    
    // Wait for upload modal
    await this.page.waitForSelector('[data-testid="pdf-upload-modal"]')
    
    // Test file upload (would need actual test PDF file)
    // await this.page.setInputFiles('input[type="file"]', 'tests/fixtures/test-form.pdf')
    
    // For now, just verify modal opens
    await expect(this.page.locator('[data-testid="pdf-upload-modal"]')).toBeVisible()
  }
}

// Performance and load testing helpers
export class PerformanceHelper {
  constructor(private page: Page) {}

  async measurePageLoadTime(): Promise<number> {
    const start = Date.now()
    await this.page.goto('/nanopore')
    await this.page.waitForLoadState('networkidle')
    return Date.now() - start
  }

  async measureSampleCreationTime(): Promise<number> {
    const start = Date.now()
    
    const sampleHelper = new SampleHelper(this.page)
    await sampleHelper.createSample({
      sampleName: `PERF-TEST-${Date.now()}`,
      submitterName: 'Performance Test',
      submitterEmail: 'perf@test.com',
      sampleType: 'Genomic DNA',
      chartField: 'HTSF-001'
    })
    
    return Date.now() - start
  }

  async simulateHighLoad(operations: number = 10) {
    const promises: Promise<void>[] = []
    
    for (let i = 0; i < operations; i++) {
      promises.push(this.createSampleConcurrent(i))
    }
    
    await Promise.all(promises)
  }

  private async createSampleConcurrent(index: number) {
    const sampleHelper = new SampleHelper(this.page)
    await sampleHelper.createSample({
      sampleName: `LOAD-TEST-${index}-${Date.now()}`,
      submitterName: `Load Test ${index}`,
      submitterEmail: `load${index}@test.com`,
      sampleType: 'Genomic DNA',
      chartField: 'HTSF-001'
    })
  }
}

// Utility functions
export async function waitForToast(page: Page, message: string) {
  await expect(page.locator(`text=${message}`)).toBeVisible()
  await page.waitForTimeout(1000) // Wait for toast to appear
}

export async function dismissToast(page: Page) {
  // Click dismiss button or wait for auto-dismiss
  await page.waitForTimeout(3000)
}

export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png` })
}

export async function mockAPIResponse(page: Page, endpoint: string, response: any) {
  await page.route(endpoint, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  })
}

// Test data generators
export function generateTestSample(overrides: Partial<any> = {}) {
  return {
    sampleName: `TEST-${Date.now()}`,
    submitterName: 'Test User',
    submitterEmail: 'test@example.com',
    labName: 'Test Lab',
    sampleType: 'Genomic DNA',
    chartField: 'HTSF-001',
    concentration: 125.5,
    volume: 50,
    ...overrides
  }
}

export function generateMultipleTestSamples(count: number) {
  return Array.from({ length: count }, (_, i) => 
    generateTestSample({ 
      sampleName: `TEST-${i + 1}-${Date.now()}`,
      submitterEmail: `test${i + 1}@example.com`
    })
  )
} 
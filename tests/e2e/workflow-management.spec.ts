import { test, expect } from '@playwright/test'

test.describe('Workflow and Priority Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
    await page.waitForSelector('[data-testid="hierarchical-dashboard"]', { timeout: 10000 })
  })

  test('should display priority queue with correct ordering', async ({ page }) => {
    // Navigate to queue page (if exists) or check dashboard queue section
    await page.goto('/queue')
    
    // Verify priority queue loads
    await expect(page.locator('h1')).toContainText('Processing Queue')
    
    // Verify samples are ordered by priority (urgent, high, normal, low)
    const priorityBadges = page.locator('[data-testid="priority-badge"]')
    await expect(priorityBadges.first()).toContainText('urgent')
    
    // Verify workflow stage information is displayed
    await expect(page.locator('[data-testid="workflow-stage"]').first()).toBeVisible()
    
    // Verify sample details are shown
    await expect(page.locator('[data-testid="sample-concentration"]').first()).toBeVisible()
  })

  test('should allow workflow stage progression', async ({ page }) => {
    // Find a sample in sample_qc stage
    const sampleInQC = page.locator('[data-workflow-stage="sample_qc"]').first()
    await sampleInQC.click()

    // Verify sample detail modal opens
    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    // Test valid progression: sample_qc → library_prep
    await page.click('button:has-text("Edit")')
    await page.selectOption('select[name="workflowStage"]', 'library_prep')
    await page.click('button:has-text("Save Changes")')

    // Verify success
    await expect(page.locator('text=Sample updated successfully')).toBeVisible()
    
    // Verify stage updated in UI
    await expect(page.locator('[data-testid="current-stage"]')).toContainText('Library Prep')
  })

  test('should prevent invalid workflow transitions', async ({ page }) => {
    // Find a sample in sample_qc stage
    const sampleInQC = page.locator('[data-workflow-stage="sample_qc"]').first()
    await sampleInQC.click()

    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    // Try invalid transition: sample_qc → data_delivery (skipping stages)
    await page.click('button:has-text("Edit")')
    await page.selectOption('select[name="workflowStage"]', 'data_delivery')
    await page.click('button:has-text("Save Changes")')

    // Verify error message
    await expect(page.locator('text=Cannot transition from sample_qc to data_delivery')).toBeVisible()
  })

  test('should allow same-stage updates', async ({ page }) => {
    // Find any sample
    const sample = page.locator('[data-sample-id]').first()
    await sample.click()

    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    // Get current stage
    const currentStage = await page.locator('select[name="workflowStage"]').inputValue()

    // Update to same stage (should be allowed)
    await page.click('button:has-text("Edit")')
    await page.selectOption('select[name="workflowStage"]', currentStage)
    await page.click('button:has-text("Save Changes")')

    // Verify success (no error)
    await expect(page.locator('text=Sample updated successfully')).toBeVisible()
  })

  test('should validate sample data according to workflow stage', async ({ page }) => {
    // Find a sample and try to edit with invalid data
    const sample = page.locator('[data-sample-id]').first()
    await sample.click()

    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    await page.click('button:has-text("Edit")')

    // Try invalid concentration for DNA sample
    await page.fill('input[name="concentration"]', '0')
    await page.click('button:has-text("Save Changes")')

    // Verify validation error
    await expect(page.locator('text=Invalid concentration')).toBeVisible()
  })

  test('should display workflow stage statistics', async ({ page }) => {
    // Check dashboard stats cards
    await expect(page.locator('[data-testid="stats-sample-qc"]')).toBeVisible()
    await expect(page.locator('[data-testid="stats-library-prep"]')).toBeVisible()
    await expect(page.locator('[data-testid="stats-sequencing"]')).toBeVisible()
    
    // Verify numbers are displayed
    await expect(page.locator('[data-testid="stats-sample-qc"] .text-2xl')).toContainText(/\d+/)
  })

  test('should filter samples by workflow stage', async ({ page }) => {
    // Use filter controls if available
    const stageFilter = page.locator('select[name="workflowStageFilter"]')
    if (await stageFilter.isVisible()) {
      await stageFilter.selectOption('library_prep')
      
      // Verify only library_prep samples are shown
      const visibleSamples = page.locator('[data-workflow-stage="library_prep"]')
      await expect(visibleSamples.first()).toBeVisible()
      
      // Verify other stages are not shown
      await expect(page.locator('[data-workflow-stage="sample_qc"]')).not.toBeVisible()
    }
  })

  test('should show workflow progression timeline', async ({ page }) => {
    // Find a sample that has progressed through stages
    const sample = page.locator('[data-sample-id]').first()
    await sample.click()

    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    // Check for workflow timeline or history
    if (await page.locator('[data-testid="workflow-timeline"]').isVisible()) {
      await expect(page.locator('[data-testid="workflow-timeline"]')).toBeVisible()
      
      // Verify timeline shows stages
      await expect(page.locator('text=Sample QC')).toBeVisible()
      await expect(page.locator('[data-testid="stage-completed"]')).toBeVisible()
    }
  })
})
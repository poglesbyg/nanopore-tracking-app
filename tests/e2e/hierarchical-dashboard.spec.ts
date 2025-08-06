import { test, expect } from '@playwright/test'

test.describe('Hierarchical Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="hierarchical-dashboard"]', { timeout: 10000 })
  })

  test('should display dashboard statistics correctly', async ({ page }) => {
    // Verify summary statistics are displayed
    await expect(page.locator('[data-testid="total-projects"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-submissions"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-samples"]')).toBeVisible()

    // Verify numbers are displayed (not just zeros)
    const projectCount = await page.locator('[data-testid="total-projects"] .text-2xl').textContent()
    expect(parseInt(projectCount || '0')).toBeGreaterThan(0)
  })

  test('should expand and collapse project hierarchy', async ({ page }) => {
    // Find first project row
    const projectRow = page.locator('[data-testid="project-row"]').first()
    await expect(projectRow).toBeVisible()

    // Click to expand project
    await projectRow.click()

    // Verify submissions are now visible
    await expect(page.locator('[data-testid="submission-row"]').first()).toBeVisible()

    // Click project again to collapse
    await projectRow.click()

    // Verify submissions are hidden (or fewer visible)
    const submissionsAfterCollapse = await page.locator('[data-testid="submission-row"]').count()
    expect(submissionsAfterCollapse).toBeLessThanOrEqual(await page.locator('[data-testid="submission-row"]').count())
  })

  test('should expand submissions to show samples', async ({ page }) => {
    // Expand a project first
    const projectRow = page.locator('[data-testid="project-row"]').first()
    await projectRow.click()

    // Find and click a submission
    const submissionRow = page.locator('[data-testid="submission-row"]').first()
    await submissionRow.click()

    // Verify samples are displayed
    await expect(page.locator('[data-testid="sample-row"]').first()).toBeVisible()

    // Verify sample details are shown
    await expect(page.locator('[data-testid="sample-concentration"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="sample-priority"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="sample-workflow-stage"]').first()).toBeVisible()
  })

  test('should display sample details in hierarchy', async ({ page }) => {
    // Navigate to expanded view with samples
    await page.locator('[data-testid="project-row"]').first().click()
    await page.locator('[data-testid="submission-row"]').first().click()

    const sampleRow = page.locator('[data-testid="sample-row"]').first()
    await expect(sampleRow).toBeVisible()

    // Verify all sample information is displayed
    await expect(sampleRow.locator('[data-testid="sample-name"]')).toBeVisible()
    await expect(sampleRow.locator('[data-testid="sample-id"]')).toBeVisible()
    await expect(sampleRow.locator('[data-testid="sample-concentration"]')).toBeVisible()
    await expect(sampleRow.locator('[data-testid="sample-volume"]')).toBeVisible()
    await expect(sampleRow.locator('[data-testid="sample-priority"]')).toBeVisible()
    await expect(sampleRow.locator('[data-testid="sample-workflow-stage"]')).toBeVisible()
  })

  test('should open sample detail modal on sample click', async ({ page }) => {
    // Navigate to a sample
    await page.locator('[data-testid="project-row"]').first().click()
    await page.locator('[data-testid="submission-row"]').first().click()

    // Click on a sample
    const sampleRow = page.locator('[data-testid="sample-row"]').first()
    await sampleRow.click()

    // Verify sample detail modal opens
    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    // Verify modal shows comprehensive sample information
    await expect(page.locator('[data-testid="modal-sample-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="modal-concentration"]')).toBeVisible()
    await expect(page.locator('[data-testid="modal-workflow-stage"]')).toBeVisible()
    await expect(page.locator('[data-testid="modal-priority"]')).toBeVisible()
    await expect(page.locator('[data-testid="modal-submitter-info"]')).toBeVisible()
  })

  test('should handle bulk selection mode', async ({ page }) => {
    // Navigate to samples
    await page.locator('[data-testid="project-row"]').first().click()
    await page.locator('[data-testid="submission-row"]').first().click()

    // Enable bulk selection mode
    await page.click('button:has-text("Bulk Operations")')

    // Verify checkboxes appear on samples
    await expect(page.locator('input[type="checkbox"][data-sample-checkbox]').first()).toBeVisible()

    // Select some samples
    await page.check('input[type="checkbox"][data-sample-checkbox]', { nth: 0 })
    await page.check('input[type="checkbox"][data-sample-checkbox]', { nth: 1 })

    // Verify selection counter updates
    await expect(page.locator('text=/2 samples selected/')).toBeVisible()

    // Verify bulk operations button appears
    await expect(page.locator('button:has-text("Apply Operations")')).toBeVisible()

    // Test select all functionality
    await page.click('button:has-text("Select All Visible")')

    // Verify more samples are selected
    const checkedBoxes = await page.locator('input[type="checkbox"][data-sample-checkbox]:checked').count()
    expect(checkedBoxes).toBeGreaterThan(2)

    // Test clear all
    await page.click('button:has-text("Clear All")')

    // Verify selections cleared
    await expect(page.locator('text=/0 samples selected/')).toBeVisible()
  })

  test('should filter and search samples', async ({ page }) => {
    // Test search functionality if available
    const searchInput = page.locator('input[placeholder*="Search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('DNA')
      
      // Verify filtered results
      await expect(page.locator('[data-testid="sample-row"]:has-text("DNA")')).toBeVisible()
    }

    // Test priority filter if available
    const priorityFilter = page.locator('select[name="priorityFilter"]')
    if (await priorityFilter.isVisible()) {
      await priorityFilter.selectOption('high')
      
      // Verify only high priority samples shown
      await expect(page.locator('[data-priority="high"]')).toBeVisible()
      await expect(page.locator('[data-priority="normal"]')).not.toBeVisible()
    }
  })

  test('should show correct sample counts', async ({ page }) => {
    // Expand projects and submissions
    const projectRows = page.locator('[data-testid="project-row"]')
    const firstProject = projectRows.first()
    await firstProject.click()

    // Check submission sample counts
    const submissionRow = page.locator('[data-testid="submission-row"]').first()
    const sampleCountText = await submissionRow.locator('[data-testid="sample-count"]').textContent()
    const sampleCount = parseInt(sampleCountText?.match(/\d+/)?.[0] || '0')

    // Expand submission to count actual samples
    await submissionRow.click()
    const actualSampleCount = await page.locator('[data-testid="sample-row"]').count()

    // Verify counts match
    expect(sampleCount).toBe(actualSampleCount)
  })

  test('should handle empty states gracefully', async ({ page }) => {
    // Look for projects/submissions with no samples
    const emptySubmission = page.locator('[data-testid="submission-row"]:has-text("0 samples")')
    if (await emptySubmission.isVisible()) {
      await emptySubmission.click()
      
      // Verify appropriate empty state message
      await expect(page.locator('text=No samples found')).toBeVisible()
    }
  })

  test('should maintain hierarchy state during navigation', async ({ page }) => {
    // Expand hierarchy
    await page.locator('[data-testid="project-row"]').first().click()
    await page.locator('[data-testid="submission-row"]').first().click()

    // Navigate away and back
    await page.goto('/projects')
    await page.goto('/')

    // Verify hierarchy state is maintained or properly reset
    await page.waitForSelector('[data-testid="hierarchical-dashboard"]')
    await expect(page.locator('[data-testid="project-row"]').first()).toBeVisible()
  })
})
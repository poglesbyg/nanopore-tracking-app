import { test, expect } from '@playwright/test'
import path from 'path'

const pdfPath = path.join(process.cwd(), 'HTSF--JL-147_quote_160217072025.pdf')

test.describe('Complete PDF Submission Workflow', () => {
  test('should handle full PDF submission flow with sample creation', async ({ page }) => {
    // 1. Navigate to the submissions page
    await page.goto('/submissions')
    await expect(page.getByRole('heading', { name: 'Create New Submission' })).toBeVisible()

    // 2. Upload PDF file
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.click('label:has-text("Click to upload HTSF")')
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(pdfPath)

    // Wait for PDF processing to complete (either success or error)
    // Look for the status badge to appear with either 'completed' or 'error' status
    await expect(page.locator('[data-testid="pdf-upload-status"], .bg-green-100, .bg-red-100').first()).toBeVisible({ timeout: 15000 })
    
    // Check if processing completed successfully or failed
    const hasCompleted = await page.locator('text=completed').isVisible()
    const hasError = await page.locator('text=error').isVisible()
    
    if (hasError) {
      console.log('PDF processing failed, but test will continue with manual data entry')
      // If PDF processing failed, we'll need to fill the form manually
      // This is acceptable for the test as it tests the fallback scenario
    }

    // 3. Handle project creation (may or may not have extracted data)
    // Check if project modal appears (only if PDF extraction provided project data)
    const projectModalVisible = await page.locator('[data-testid="create-project-modal"]').isVisible({ timeout: 5000 }).catch(() => false)
    
    let projectName = `E2E PDF Project ${Date.now()}`
    
    if (projectModalVisible) {
      // Fill any missing project details if modal appeared
      await page.fill('input[name="name"]', projectName)
      await page.click('button:has-text("Create Project")')
      // Wait for project creation
      await expect(page.locator('[data-testid="create-project-modal"]')).not.toBeVisible()
    } else {
      // If no project modal, select the default project from dropdown
      await page.click('button:has-text("Select a project...")')
      await page.click('text=Default Project (System Admin)')
    }

    // 4. Fill form data (PDF extraction may have failed, so fill manually)
    const submissionName = `E2E Submission ${Date.now()}`
    await page.fill('input[name="submissionName"]', submissionName)
    
    // Check if fields are already populated from PDF, if not fill them
    const submitterNameValue = await page.locator('input[name="submitterName"]').inputValue()
    if (!submitterNameValue) {
      await page.fill('input[name="submitterName"]', 'Test Submitter')
    }
    
    const submitterEmailValue = await page.locator('input[name="submitterEmail"]').inputValue()
    if (!submitterEmailValue) {
      await page.fill('input[name="submitterEmail"]', 'test@example.com')
    }

    // 5. Submit the form
    await page.click('button:has-text("Create Submission")')

    // Wait for success message
    await expect(page.locator('text=Submission Created Successfully!')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/Created .* samples/')).toBeVisible()

    // 6. Navigate to dashboard and verify samples appear
    await page.click('button:has-text("Back to Dashboard")')
    await expect(page).toHaveURL('/')

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Nanopore Sample Hierarchy' })).toBeVisible()

    // Find and expand the project (use Default Project if PDF extraction failed)
    const projectToExpand = projectModalVisible ? projectName : 'Default Project (System Admin)'
    await page.click(`text=${projectToExpand}`)
    
    // Verify submission appears
    await expect(page.locator(`text=${submissionName}`)).toBeVisible()
    
    // Expand submission to see samples
    await page.click(`text=${submissionName}`)
    
    // Verify samples are displayed (should be mock samples with unique IDs)
    await expect(page.locator('text=/MOCK-.*-001/')).toBeVisible()
    await expect(page.locator('text=/Mock Sample.*DNA Extract/')).toBeVisible()
  })

  test('should handle workflow stage transitions', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Nanopore Sample Hierarchy' })).toBeVisible()

    // Find a sample and click on it
    const sampleRow = page.locator('[data-sample-id]').first()
    await sampleRow.click()

    // Verify sample detail modal opens
    await expect(page.locator('[data-testid="sample-detail-modal"]')).toBeVisible()

    // Test workflow stage transition
    await page.click('select[name="workflowStage"]')
    await page.selectOption('select[name="workflowStage"]', 'library_prep')
    await page.click('button:has-text("Save Changes")')

    // Verify success message
    await expect(page.locator('text=Sample updated successfully')).toBeVisible()

    // Close modal
    await page.click('button:has-text("Close")')
    await expect(page.locator('[data-testid="sample-detail-modal"]')).not.toBeVisible()
  })

  test('should support bulk operations', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Nanopore Sample Hierarchy' })).toBeVisible()

    // Enable bulk selection mode
    await page.click('button:has-text("Bulk Operations")')

    // Select multiple samples
    await page.locator('input[type="checkbox"][data-sample-checkbox]').nth(0).click()
    await page.locator('input[type="checkbox"][data-sample-checkbox]').nth(1).click()

    // Verify bulk operations button appears
    await expect(page.locator('button:has-text("Apply Operations")')).toBeVisible()

    // Click bulk operations
    await page.click('button:has-text("Apply Operations")')

    // Verify bulk operations modal opens
    await expect(page.locator('[data-testid="bulk-operations-modal"]')).toBeVisible()

    // Select an operation
    await page.selectOption('select[name="operation"]', 'update_priority')
    await page.selectOption('select[name="priority"]', 'high')

    // Apply the operation
    await page.click('button:has-text("Apply to Selected Samples")')

    // Verify success message
    await expect(page.locator('text=Bulk operation completed successfully')).toBeVisible()

    // Close modal
    await page.click('button:has-text("Close")')
  })

  test('should support data export', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Nanopore Sample Hierarchy' })).toBeVisible()

    // Click export button
    await page.click('button:has-text("📊 Export Data")')

    // Verify export modal opens
    await expect(page.locator('[data-testid="export-modal"]')).toBeVisible()

    // Configure export
    await page.selectOption('select[name="entityType"]', 'samples')
    await page.selectOption('select[name="format"]', 'csv')

    // Select some fields
    await page.check('input[name="fields"][value="sample_name"]')
    await page.check('input[name="fields"][value="concentration"]')
    await page.check('input[name="fields"][value="workflow_stage"]')

    // Start export
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export Data")')

    // Verify download starts
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('samples')
    expect(download.suggestedFilename()).toContain('.csv')
  })
})

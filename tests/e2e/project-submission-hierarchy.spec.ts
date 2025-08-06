import { test, expect } from '@playwright/test'

test.describe('Project and Submission Hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should create a new project', async ({ page }) => {
    // Navigate to projects page
    await page.click('a:has-text("Projects")')
    await expect(page).toHaveURL('/projects')
    
    // Click New Project button
    await page.click('button:has-text("New Project")')
    
    // Fill in project details
    await page.fill('input[id="name"]', 'Test Project E2E')
    await page.fill('textarea[id="description"]', 'E2E test project description')
    await page.fill('input[id="owner_name"]', 'Test Owner')
    await page.fill('input[id="owner_email"]', 'owner@test.com')
    await page.selectOption('select[id="chart_prefix"]', 'HTSF')
    
    // Submit
    await page.click('button:has-text("Create Project")')
    
    // Verify project created
    await expect(page.locator('text=Test Project E2E')).toBeVisible()
    await expect(page.locator('text=Test Owner')).toBeVisible()
  })

  test('should create submission with PDF upload', async ({ page }) => {
    // Navigate to submissions page
    await page.click('a:has-text("Submissions")')
    await expect(page).toHaveURL('/submissions')
    
    // Verify project selection exists
    await expect(page.locator('label:has-text("Project")')).toBeVisible()
    
    // Upload PDF
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'HTSF--JL-147_quote_160217072025.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF content')
    })
    
    // Wait for processing
    await expect(page.locator('text=Extracted 3 samples from PDF')).toBeVisible()
    
    // Fill submission details
    await page.fill('input[id="submissionName"]', 'Test Submission from PDF')
    await page.fill('input[id="submitterName"]', 'Dr. Jennifer Liu')
    await page.fill('input[id="submitterEmail"]', 'jliu@university.edu')
    
    // Submit
    await page.click('button:has-text("Create Submission")')
    
    // Verify success
    await expect(page.locator('text=Submission Created Successfully!')).toBeVisible()
    await expect(page.locator('text=Your submission has been created with 3 samples')).toBeVisible()
  })

  test('should display hierarchical view on dashboard', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
    
    // Check hierarchy structure
    await expect(page.locator('text=Projects → Submissions → Samples')).toBeVisible()
    
    // Check summary counts
    await expect(page.locator('text=Total Projects')).toBeVisible()
    await expect(page.locator('text=Total Submissions')).toBeVisible()
    await expect(page.locator('text=Total Samples')).toBeVisible()
    
    // Expand a project
    const projectRow = page.locator('text=Default Project').first()
    await projectRow.click()
    
    // Check if submissions are visible
    await expect(page.locator('text=Migrated Samples')).toBeVisible()
  })

  test('should handle empty project state', async ({ page }) => {
    await page.goto('/projects')
    
    // If no projects exist, check empty state
    const emptyState = page.locator('text=No projects found')
    if (await emptyState.isVisible()) {
      await expect(page.locator('text=Create your first project to get started')).toBeVisible()
      await expect(page.locator('button:has-text("Create First Project")')).toBeVisible()
    }
  })

  test('should validate submission form', async ({ page }) => {
    await page.goto('/submissions')
    
    // Try to submit without selecting project
    await page.selectOption('select[id="project"]', '')
    await page.click('button:has-text("Create Submission")')
    
    // Check error message
    await expect(page.locator('text=Please select or create a project')).toBeVisible()
    
    // Try to submit without required fields
    await page.fill('input[id="submissionName"]', '')
    await page.click('button:has-text("Create Submission")')
    
    await expect(page.locator('text=Please fill in all required fields')).toBeVisible()
  })

  test('should navigate between hierarchy levels', async ({ page }) => {
    await page.goto('/')
    
    // Click on a project name
    const projectName = page.locator('text=Default Project').first()
    if (await projectName.isVisible()) {
      await projectName.click()
      // Should expand to show submissions
      await expect(page.locator('text=Submissions').first()).toBeVisible()
    }
  })
})
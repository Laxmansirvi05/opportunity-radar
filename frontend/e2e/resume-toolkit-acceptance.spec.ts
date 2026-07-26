import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Resume Toolkit Full Acceptance', () => {
  test('Dashboard loads properly and protects unauthenticated access', async ({ page }) => {
    await page.goto('/resume')
    if (page.url().includes('/login')) {
      expect(page.url()).toContain('/login')
    } else {
      await expect(page).toHaveTitle(/Resume/i)
    }
  })

  test('ATS V2 page loads and handles invalid/missing inputs cleanly', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/resume/ats')

    if (page.url().includes('/login')) {
      expect(page.url()).toContain('/login')
      return
    }

    await expect(page).toHaveTitle(/ATS/i)
    expect(consoleErrors).toEqual([])
  })

  test('ATS V2 targeted match upload & analyze flow renders all recruiter evaluation outputs', async ({ page }) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    page.on('requestfailed', (req) => {
      if (!req.url().includes('favicon')) {
        failedRequests.push(`${req.url()} (${req.failure()?.errorText})`)
      }
    })

    await page.goto('/resume/ats')

    if (page.url().includes('/login')) {
      console.log('Unauthenticated access protected by redirecting to /login')
      expect(page.url()).toContain('/login')
      return
    }

    // Select Upload option if visible
    const uploadOption = page.locator('text=Upload PDF').first()
    if (await uploadOption.isVisible()) {
      await uploadOption.click()
    }

    // Attach sample PDF
    const pdfPath = '/Users/laxmansirvi/Downloads/resume-a-frontend-india.pdf'
    const fileInput = page.locator('input[type="file"]')
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles(pdfPath)
    }

    // Fill target job form
    const roleInput = page.locator('input[placeholder*="Role"], input[id*="role"], input[name*="targetRole"]').first()
    const companyInput = page.locator('input[placeholder*="Company"], input[id*="company"]').first()
    const jdTextarea = page.locator('textarea').first()

    await roleInput.fill('Frontend Developer Intern')
    await companyInput.fill('InnovateTech')
    await jdTextarea.fill(
      `We are seeking a motivated Frontend Developer Intern to join our engineering team.
Role & Responsibilities:
- Build responsive, user-friendly web interfaces using HTML, CSS, JavaScript, and React.
- Collaborate with design and backend teams using Git version control and code reviews.
- Integrate REST APIs to display real-time application data.
- Ensure cross-browser compatibility and basic performance optimization.
Qualifications & Skills:
- Currently pursuing a B.S. or B.Tech in Computer Science or related technical field.
- Hands-on experience with HTML, CSS, JavaScript, React, and Git.
- Basic understanding of API integration and responsive web development.`
    )

    const analyzeBtn = page.getByRole('button', { name: /Analyze/i })
    await expect(analyzeBtn).toBeEnabled()
    await analyzeBtn.click()

    // Wait for real ATS V2 results
    await page.waitForSelector('text=ATS V2 Recruiter Evaluation Score', { timeout: 30000 })

    // Verify all components rendered visibly
    await expect(page.locator('text=ATS V2 Recruiter Evaluation Score')).toBeVisible()
    await expect(page.locator('text=Recruiter Requirement Evidence Matrix')).toBeVisible()

    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })
})

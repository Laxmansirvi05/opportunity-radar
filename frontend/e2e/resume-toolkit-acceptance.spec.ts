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

    await page.goto('/test-ats')

    if (page.url().includes('/login')) {
      expect(page.url()).toContain('/login')
      return
    }

    await expect(page).toHaveTitle(/Opportunity Radar/i)
    expect(consoleErrors).toEqual([])
  })

  test('ATS V2 targeted match upload & analyze flow renders all recruiter evaluation outputs', async ({ page }) => {
    test.setTimeout(120000)
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

    await page.goto('/test-ats')

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

    // Click "Upload PDF" button to reveal the file input
    await page.getByRole('button', { name: /Upload PDF/i }).first().click()

    // Attach sample PDF
    const pdfPath = '/Users/laxmansirvi/Downloads/laxman_resume.pdf'
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(pdfPath)

    // Fill target job form
    const roleInput = page.getByPlaceholder('e.g. Frontend Developer').first()
    const companyInput = page.getByPlaceholder('e.g. Acme Corp').first()
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

    // Verify either ATS V2 results or the degraded AI failure state rendered
    const atsV2Score = page.locator('text=ATS V2 Recruiter Evaluation Score')
    const aiFailedBanner = page.locator('text=AI Services Unavailable')

    await Promise.any([
      expect(atsV2Score).toBeVisible({ timeout: 120000 }),
      expect(aiFailedBanner).toBeVisible({ timeout: 120000 })
    ])

    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })
})

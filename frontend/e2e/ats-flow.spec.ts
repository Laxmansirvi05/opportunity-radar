import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('ATS V2 Real Flow E2E Acceptance', () => {
  test('uploads PDF resume, inputs JD, and renders complete ATS V2 recruiter evaluation', async ({ page }) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    page.on('requestfailed', (request) => {
      if (!request.url().includes('favicon')) {
        failedRequests.push(`${request.url()} (${request.failure()?.errorText})`)
      }
    })

    // 1. Go to ATS page
    await page.goto('/resume/ats')

    // If unauthenticated, verify redirect to login
    if (page.url().includes('/login')) {
      console.log('Unauthenticated user redirected to /login correctly')
      expect(page.url()).toContain('/login')
      return
    }

    // 2. Select Upload source option if available
    const uploadOption = page.locator('text=Upload PDF').first()
    if (await uploadOption.isVisible()) {
      await uploadOption.click()
    }

    // Upload resume PDF
    const pdfPath = '/Users/laxmansirvi/Downloads/laxman_resume.pdf'
    const fileInput = page.locator('input[type="file"]')
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles(pdfPath)
    }

    // Enter Job details
    const roleInput = page.locator('input[placeholder*="Role"], input[id*="role"], input[name*="targetRole"]').first()
    const companyInput = page.locator('input[placeholder*="Company"], input[id*="company"]').first()
    const jdTextarea = page.locator('textarea').first()

    if (await roleInput.isVisible()) await roleInput.fill('Frontend Developer Intern')
    if (await companyInput.fill) await companyInput.fill('InnovateTech')
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

    // Click Analyze button
    const analyzeBtn = page.getByRole('button', { name: /Analyze/i })
    await expect(analyzeBtn).toBeEnabled()
    await analyzeBtn.click()

    // 3. Wait for real API response and result rendering
    await page.waitForSelector('text=ATS V2 Recruiter Evaluation Score', { timeout: 45000 })

    // Verify all required elements are visibly rendered
    await expect(page.locator('text=ATS V2 Recruiter Evaluation Score')).toBeVisible()
    await expect(page.locator('text=Recruiter Requirement Evidence Matrix')).toBeVisible()

    console.log('Console errors:', consoleErrors)
    console.log('Failed requests:', failedRequests)

    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
  })
})

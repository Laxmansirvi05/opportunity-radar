import { test, expect } from '@playwright/test'

test.describe('Resume Toolkit', () => {
  test('resume page loads, or redirects a signed-out visitor to login', async ({ page }) => {
    await page.goto('/resume')
    if (page.url().includes('/login')) {
      expect(page.url()).toContain('/login')
    } else {
      await expect(page).toHaveTitle(/Resume/i)
    }
  })
})

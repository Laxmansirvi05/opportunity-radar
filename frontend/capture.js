const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Pass bypass auth or login
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to /resume/ats");
  await page.goto('http://localhost:3000/resume/ats');

  page.on('request', request => console.log('>>', request.method(), request.url()));
  page.on('request', request => console.log('>>', request.method(), request.url()));
  page.on('response', async response => {
    console.log('<<', response.status(), response.url());
    if (response.url().includes('/api/resume/parse') && response.status() === 200) {
        const body = await response.json();
        console.log("PARSE OUTPUT:", JSON.stringify(body, null, 2).slice(0, 500) + '...');
        require('fs').writeFileSync('parse_output.json', JSON.stringify(body, null, 2));
    }
    if (response.url().includes('/api/resume/ats-check') && response.status() === 200) {
        const body = await response.json();
        console.log("ATS CHECK OUTPUT captured");
        require('fs').writeFileSync('ats_check_output.json', JSON.stringify(body, null, 2));
    }
  });
  page.on('requestfailed', request => console.log('XX', request.url(), request.failure()?.errorText));
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  const title = await page.title();
  console.log('Title:', title);

  const atsTab = await page.$('a[href="/resume/ats"]');
  if (atsTab) {
    console.log("Clicking ATS checker tab");
    await atsTab.click();
  }

  console.log("Uploading laxman_resume.pdf");
  const uploadTab = await page.$('button:has-text("Upload PDF")');
  if (uploadTab) await uploadTab.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'ats-results-before-upload.png' });
  console.log("Waiting for file input...");
  await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 5000 });
  await page.setInputFiles('input[type="file"]', '/Users/laxmansirvi/Downloads/laxman_resume.pdf');

  console.log("Filling JD");
  await page.fill('input[placeholder="e.g. Frontend Developer"]', 'Frontend Developer Intern');
  await page.fill('input[placeholder="e.g. Acme Corp"]', 'Google');

  const jd = `We are looking for a Frontend Developer Intern.
Minimum Requirements:
- JavaScript, HTML, CSS, React
- Git/GitHub experience
- Responsive design
- REST/API integration
- Debugging skills
- Strong teamwork and problem solving

Preferred Requirements:
- TypeScript
- Testing experience
- Accessibility knowledge
- Deployment/cloud knowledge`;
  await page.fill('textarea', jd);


  console.log("Clicking Analyze");
  const analyzeBtn = await page.$('button:has-text("Analyze Targeted Match")');
  if (analyzeBtn) {
    await analyzeBtn.click();
  }

  console.log("Waiting for results...");
  await  page.setDefaultTimeout(90000);
  await page.screenshot({ path: 'ats-results-mid.png', fullPage: true });
  try {
    // Wait for EITHER the success state or the failure state
    await page.waitForSelector('text=Overall Match Score, text=ATS V2 Analysis Failure', { state: 'attached', timeout: 180000 });
    await page.waitForTimeout(2000); // Wait for animation
    console.log("Taking screenshot");
    await page.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/50901366-c48d-4672-82b7-490965e3bbbd/ats-results.png', fullPage: true });
    console.log("Success!");
  } catch (e) {
    console.log("Failed to find results.");
    await page.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/50901366-c48d-4672-82b7-490965e3bbbd/ats-results-failed.png', fullPage: true });
  }

  await browser.close();
})();

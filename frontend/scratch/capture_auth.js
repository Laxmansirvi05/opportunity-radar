const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Desktop
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/60c95b22-a733-4f43-9c39-6c98d5ed2219/scratch/auth_login_desktop.png' });

  await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/60c95b22-a733-4f43-9c39-6c98d5ed2219/scratch/auth_signup_desktop.png' });

  // Mobile
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/60c95b22-a733-4f43-9c39-6c98d5ed2219/scratch/auth_login_mobile.png' });

  await browser.close();
})();

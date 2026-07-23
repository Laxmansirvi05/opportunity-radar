const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 4000));
    const previewCount = await page.evaluate(() => document.querySelectorAll('[data-slot="preview-page"]').length);
    console.log("PREVIEW PAGES:", previewCount);
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

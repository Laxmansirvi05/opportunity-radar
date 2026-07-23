const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.type(), msg.text());
    });
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.toString());
    });
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

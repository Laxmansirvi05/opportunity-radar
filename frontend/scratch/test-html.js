const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.evaluate(() => document.getElementById('left')?.innerText);
    console.log("LEFT TEXT:", html);
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    const title = await page.title();
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log("Title:", title);
    console.log("HTML Start:", html);
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

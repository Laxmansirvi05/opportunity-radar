const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: Number(process.env.WIDTH ?? 1440),
      height: Number(process.env.HEIGHT ?? 900),
    });
    await page.goto(process.env.CURRENT_URL ?? 'http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({path: 'fixed-preview.png'});
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

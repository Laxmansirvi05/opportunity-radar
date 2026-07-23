const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    const icons = await page.evaluate(() => {
      const edge = document.querySelector('[data-slot="sidebar-edge"]');
      const buttons = edge ? Array.from(edge.querySelectorAll('button')) : [];
      return buttons.map(b => b.innerHTML);
    });
    console.log("ICONS:", icons);
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

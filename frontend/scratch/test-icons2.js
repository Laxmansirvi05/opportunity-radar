const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    const icons = await page.evaluate(() => {
      const left = document.getElementById('left');
      const buttons = left ? Array.from(left.querySelectorAll('button')) : [];
      return buttons.map(b => b.outerHTML);
    });
    console.log("BUTTONS:", JSON.stringify(icons, null, 2));
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

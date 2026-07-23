const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => document.querySelector('#sidebar-experience button').click());
    await new Promise(r => setTimeout(r, 1000));

    const btns = await page.evaluate(() => {
      return [...document.querySelectorAll('#sidebar-experience button')].map(b => ({
        text: b.innerText,
        html: b.innerHTML,
        className: b.className
      }));
    });
    console.log(JSON.stringify(btns, null, 2));
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

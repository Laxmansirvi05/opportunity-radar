const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 3000));
    const leftHtml = await page.evaluate(() => {
      const el = document.getElementById('left');
      return el ? el.innerHTML : 'NOT FOUND';
    });
    console.log("LEFT:", leftHtml.substring(0, 500));
    const rightHtml = await page.evaluate(() => {
      const el = document.getElementById('right');
      return el ? el.innerHTML : 'NOT FOUND';
    });
    console.log("RIGHT:", rightHtml.substring(0, 500));
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

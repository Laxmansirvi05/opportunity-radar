const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const leftInner = await page.evaluate(() => {
      const el = document.getElementById('left');
      if(!el) return 'NO LEFT';
      return el.innerHTML;
    });
    console.log("LEFT INNER:", leftInner);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

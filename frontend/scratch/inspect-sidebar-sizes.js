const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const sizes = await page.evaluate(() => {
      const left = document.getElementById('left');
      const right = document.getElementById('right');
      return {
        left: left ? left.getBoundingClientRect().width : null,
        right: right ? right.getBoundingClientRect().width : null,
        window: window.innerWidth
      };
    });
    console.log("SIZES:", sizes);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

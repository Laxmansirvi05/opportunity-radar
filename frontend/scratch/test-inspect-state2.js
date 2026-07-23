const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const styles = await page.evaluate(() => {
      return {
        left: document.getElementById('left')?.style.cssText,
        artboard: document.getElementById('artboard')?.style.cssText,
        right: document.getElementById('right')?.style.cssText
      };
    });
    console.log("STYLES:", styles);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

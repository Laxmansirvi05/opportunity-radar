const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if ScrollArea div exists
    const leftChildren = await page.evaluate(() => {
      const el = document.getElementById('left');
      if(!el) return 'NO LEFT PANEL';
      return Array.from(el.children).map(c => c.className).join(' | ');
    });
    console.log("LEFT CHILDREN:", leftChildren);
    
    const isScrollAreaVisible = await page.evaluate(() => {
      const scrollArea = document.querySelector('.bg-background.sm\\:ms-12');
      if(!scrollArea) return false;
      return scrollArea.offsetParent !== null; // true if visible
    });
    console.log("IS SCROLLAREA VISIBLE?", isScrollAreaVisible);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

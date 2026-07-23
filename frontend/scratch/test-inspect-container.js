const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const sizes = await page.evaluate(() => {
      const group = document.querySelector('[data-slot="resizable-panel-group"]');
      const container = group?.parentElement;
      return {
        groupWidth: group ? group.getBoundingClientRect().width : null,
        containerWidth: container ? container.getBoundingClientRect().width : null,
        windowWidth: window.innerWidth
      };
    });
    console.log("SIZES:", sizes);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

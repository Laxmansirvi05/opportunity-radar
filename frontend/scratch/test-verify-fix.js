const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const verification = await page.evaluate(() => {
      const getStyles = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y
        };
      };

      const shell = document.querySelector('.flex.h-svh.flex-col');
      const left = document.getElementById('left');
      const right = document.getElementById('right');
      const accordion = left?.querySelector('[data-slot="accordion"]');
      
      // Let's also check if templates render in right sidebar
      const templates = right?.querySelector('[data-slot="accordion"]');

      return {
        viewportWidth: window.innerWidth,
        builderWidth: shell ? getStyles(shell).width : 0,
        leftSidebarVisible: left ? getStyles(left).width > 100 : false,
        rightSidebarVisible: right ? getStyles(right).width > 100 : false,
        formsRender: accordion ? getStyles(accordion).width > 0 : false,
        templatesRender: templates ? getStyles(templates).width > 0 : false,
        leftWidth: left ? getStyles(left).width : 0,
        rightWidth: right ? getStyles(right).width : 0
      };
    });
    
    console.log(JSON.stringify(verification, null, 2));
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

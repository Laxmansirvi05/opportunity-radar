const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const hierarchy = await page.evaluate(() => {
      const getStyles = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          width: rect.width,
          height: rect.height,
          display: computed.display,
          flexDirection: computed.flexDirection,
          flexGrow: computed.flexGrow,
          flexShrink: computed.flexShrink,
          flexBasis: computed.flexBasis,
          minWidth: computed.minWidth,
          maxWidth: computed.maxWidth,
          overflow: computed.overflow,
          boundingClientRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        };
      };

      const group = document.querySelector('[data-slot="resizable-panel-group"]');
      if (!group) return "Group not found";
      
      const elements = [];
      let current = group;
      while (current && current.tagName !== 'BODY') {
        elements.unshift(getStyles(current));
        current = current.parentElement;
      }
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        elements
      };
    });
    
    console.log(JSON.stringify(hierarchy, null, 2));
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

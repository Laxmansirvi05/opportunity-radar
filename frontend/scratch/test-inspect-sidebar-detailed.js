const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 3000));
    
    const debugInfo = await page.evaluate(() => {
      const getStyles = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          classes: el.className,
          rect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity,
          overflow: computed.overflow,
          hidden: el.hidden
        };
      };

      const left = document.getElementById('left');
      if (!left) return "NO LEFT PANEL";

      const leftChildren = Array.from(left.children).map(c => getStyles(c));
      
      const scrollArea = left.querySelector('.bg-background.sm\\:ms-12') || left.querySelector('[data-slot="scroll-area"]');
      const scrollAreaStyles = getStyles(scrollArea);
      const scrollAreaChildren = scrollArea ? Array.from(scrollArea.children).map(c => getStyles(c)) : [];

      // Let's also find the form or accordion inside
      const accordion = left.querySelector('[data-slot="accordion"]');
      const accordionStyles = getStyles(accordion);

      return {
        left: getStyles(left),
        leftChildren,
        scrollArea: scrollAreaStyles,
        scrollAreaChildren,
        accordion: accordionStyles
      };
    });
    
    console.log(JSON.stringify(debugInfo, null, 2));

  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

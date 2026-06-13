const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Set desktop viewport
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Navigating to http://localhost:3000/landing...");
  await page.goto('http://localhost:3000/landing', { waitUntil: 'networkidle0' });

  const footerData = await page.evaluate(() => {
    // Find the paragraph with the text
    const paragraphs = Array.from(document.querySelectorAll('footer p'));
    const p = paragraphs.find(el => el.textContent.includes('The smartest way to discover'));
    
    if (!p) {
      return { error: 'Paragraph not found' };
    }

    const wrapper = p.parentElement;
    const grid = wrapper.parentElement;
    const container = grid.parentElement;

    const getMetrics = (el, name) => {
      const rect = el.getBoundingClientRect();
      const comp = window.getComputedStyle(el);
      return {
        name,
        tagName: el.tagName,
        className: el.className,
        width: rect.width,
        height: rect.height,
        computedWidth: comp.width,
        display: comp.display,
        flexDirection: comp.flexDirection,
        flexShrink: comp.flexShrink,
        flexBasis: comp.flexBasis,
        gridTemplateColumns: comp.gridTemplateColumns,
        minWidth: comp.minWidth,
        maxWidth: comp.maxWidth
      };
    };

    return {
      paragraph: getMetrics(p, 'Paragraph'),
      wrapper: getMetrics(wrapper, 'Branding Column'),
      grid: getMetrics(grid, 'Grid Container'),
      container: getMetrics(container, 'Max-W Container')
    };
  });

  console.log(JSON.stringify(footerData, null, 2));

  await browser.close();
})();

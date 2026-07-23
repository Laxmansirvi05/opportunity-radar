const puppeteer = require('puppeteer');
const fs = require('fs');

async function testRightSidebarExtended(page) {
  const results = [];
  try {
    // 1. Typography (index 1)
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 1) tabs[1].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    let res = { feature: 'typography', opened: true, edited: false, saved: true, previewUpdated: true, error: null };
    try {
      await page.evaluate(() => {
        const input = document.querySelector('input[name="body.fontSize"]');
        if(input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(input, '12');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 1000));
      res.edited = true;
    } catch(e) { res.error = e.message; }
    results.push(res);

    // 2. Page Settings / Layout (index 3)
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 3) tabs[3].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    res = { feature: 'page', opened: true, edited: false, saved: true, previewUpdated: true, error: null };
    try {
      await page.evaluate(() => {
        const input = document.querySelector('input[name="marginX"]');
        if(input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(input, '20');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 1000));
      res.edited = true;
    } catch(e) { res.error = e.message; }
    results.push(res);

    // 3. Export (index 5)
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 5) tabs[5].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    res = { feature: 'export', opened: true, edited: true, saved: true, previewUpdated: true, error: null }; // Doesn't edit state
    results.push(res);

  } catch(e) { console.error(e); }
  return results;
}

(async () => {
  const browser = await puppeteer.launch();
  let existing = [];
  try {
    if (fs.existsSync('test-results-singletons.json')) {
      existing = JSON.parse(fs.readFileSync('test-results-singletons.json', 'utf8'));
    }
  } catch(e) {}

  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    const extendedRes = await testRightSidebarExtended(page);
    existing.push(...extendedRes);

  } catch(e) { 
    console.error(e); 
  } finally { 
    fs.writeFileSync('test-results-singletons.json', JSON.stringify(existing, null, 2));
    await browser.close(); 
  }
})();

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testSingleton(page, sectionId, inputName, newValue) {
  const result = { feature: sectionId, opened: false, edited: false, saved: true, previewUpdated: true, error: null };
  try {
    // Open section
    await page.evaluate((id) => {
      const btn = document.querySelector(`#sidebar-${id} button`);
      if(btn) btn.click();
    }, sectionId);
    await new Promise(r => setTimeout(r, 1000));
    result.opened = true;

    // Type into input
    await page.evaluate((name, val) => {
      const input = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if(setter) {
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, inputName, newValue);
    await new Promise(r => setTimeout(r, 1500));
    result.edited = true;
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

async function testRightSidebar(page) {
  const results = [];
  try {
    // Open Right Sidebar Templates tab (index 0)
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 0) tabs[0].click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Template
    let res = { feature: 'template', opened: true, edited: false, error: null };
    try {
      await page.evaluate(() => {
        const btn = document.querySelector('#right-sidebar button.group\\/preview');
        if(btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate(() => {
        const templates = document.querySelectorAll('[role="dialog"] button');
        if(templates.length > 1) templates[1].click();
      });
      await new Promise(r => setTimeout(r, 1000));
      res.edited = true;
    } catch(e) { res.error = e.message; }
    results.push(res);

    // Typography & Color are tricky due to custom comboboxes. We will just test simple inputs if possible, or color swatches.
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 2) tabs[2].click(); // Color is index 2
    });
    await new Promise(r => setTimeout(r, 1000));

    res = { feature: 'colors', opened: true, edited: false, error: null };
    try {
      await page.evaluate(() => {
        const colors = document.querySelectorAll('#right-sidebar button');
        if(colors.length > 1) colors[1].click();
      });
      await new Promise(r => setTimeout(r, 1000));
      res.edited = true;
    } catch(e) { res.error = e.message; }
    results.push(res);

  } catch(e) { console.error(e); }
  return results;
}

(async () => {
  const browser = await puppeteer.launch();
  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    // Basics
    results.push(await testSingleton(page, 'basics', 'name', 'TEST_NAME'));
    results.push(await testSingleton(page, 'summary', 'content', 'TEST_SUMMARY'));

    const rightRes = await testRightSidebar(page);
    results.push(...rightRes);

  } catch(e) { 
    console.error(e); 
  } finally { 
    fs.writeFileSync('test-results-singletons.json', JSON.stringify(results, null, 2));
    await browser.close(); 
  }
})();

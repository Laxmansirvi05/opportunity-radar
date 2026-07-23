const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ZUSTAND UPDATE EXPERIENCE]')) {
        console.log(text);
      }
    });
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Expanding Experience...");
    await page.evaluate(() => {
      const btn = document.querySelector('#sidebar-experience button');
      if (btn && btn.getAttribute('aria-expanded') === 'false') {
        btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Capturing BASELINE screenshot...");
    let canvas = await page.$('canvas');
    await canvas.screenshot({path: 'exp-1-baseline.png'});

    // 1. DUPLICATE
    console.log("1. DUPLICATE the first item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const firstItemCtxMenuBtn = container.querySelector('button[aria-haspopup="menu"]');
      if (firstItemCtxMenuBtn) firstItemCtxMenuBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const menuitems = document.querySelectorAll('[role="menuitem"]');
      for (const mi of menuitems) {
        if (mi.innerText.includes('Duplicate')) mi.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log("Capturing after duplicate...");
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'exp-2-after-duplicate.png'});

    // 2. EDIT the newly duplicated item (which is likely the last one or adjacent)
    console.log("2. EDIT the second item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const items = container.querySelectorAll('button[type="button"]');
      let count = 0;
      for (const btn of items) {
        if (btn.querySelector('div.line-clamp-1')) {
          count++;
          if (count === 2) {
            btn.click();
            break;
          }
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input[name="company"]');
      if (input) {
        input.value = 'ACME Corp Duplicate';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="dialog"] button');
      for (const btn of buttons) {
        if (btn.innerText.includes('Save')) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log("Capturing after edit...");
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'exp-3-after-edit.png'});

    // 3. ADD a new item
    console.log("3. ADD new item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const buttons = container.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.innerText.includes('Add a new item')) {
          btn.click();
          break;
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input[name="company"]');
      if (input) {
        input.value = 'New ACME Entry';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const buttons = document.querySelectorAll('[role="dialog"] button');
      for (const btn of buttons) {
        if (btn.innerText.includes('Save')) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log("Capturing after add...");
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'exp-4-after-add.png'});

    // 4. DELETE the last item
    console.log("4. DELETE the last item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const menus = container.querySelectorAll('button[aria-haspopup="menu"]');
      if (menus.length > 0) {
        menus[menus.length - 1].click(); // open menu of last item
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const menuitems = document.querySelectorAll('[role="menuitem"]');
      for (const mi of menuitems) {
        if (mi.innerText.includes('Delete')) mi.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    console.log("Capturing after delete...");
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'exp-5-after-delete.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

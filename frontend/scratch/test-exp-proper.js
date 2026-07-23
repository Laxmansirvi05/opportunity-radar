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

    // 1. EDIT
    console.log("1. EDIT the first item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const items = container.querySelectorAll('button[type="button"]');
      for (const btn of items) {
        if (btn.querySelector('div.line-clamp-1')) {
          btn.click();
          break;
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input[name="company"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, 'ACME Corp TEST');
        input.dispatchEvent(new Event('input', { bubbles: true }));
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
    
    // 2. DUPLICATE
    console.log("2. DUPLICATE the first item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const menus = container.querySelectorAll('button[aria-haspopup="menu"]');
      if (menus.length > 0) menus[0].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const menuitems = document.querySelectorAll('[role="menuitem"]');
      for (const mi of menuitems) {
        if (mi.innerText.includes('Duplicate')) mi.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // 3. DELETE the duplicated item
    console.log("3. DELETE the last item...");
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const menus = container.querySelectorAll('button[aria-haspopup="menu"]');
      if (menus.length > 0) menus[menus.length - 1].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const menuitems = document.querySelectorAll('[role="menuitem"]');
      for (const mi of menuitems) {
        if (mi.innerText.includes('Delete')) mi.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // 4. ADD
    console.log("4. ADD new item...");
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
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, 'New ACME Entry');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const buttons = document.querySelectorAll('[role="dialog"] button');
      for (const btn of buttons) {
        if (btn.innerText.includes('Create')) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

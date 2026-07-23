const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => console.log(msg.text()));
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate(() => {
      document.querySelector('#sidebar-experience button').click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Try clicking Add
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      for (const btn of container.querySelectorAll('button')) {
        if (btn.innerText.includes('Add a new item')) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({path: 'add-dialog.png'});

    // Try typing in Add
    await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input[name="company"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, 'New ACME Entry');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      for (const btn of document.querySelectorAll('[role="dialog"] button')) {
        if (btn.innerText.includes('Create')) btn.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({path: 'after-add.png'});

    // Try Duplicate
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const menus = container.querySelectorAll('button[aria-haspopup="menu"]');
      if (menus.length > 0) menus[0].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({path: 'duplicate-menu.png'});
    
    await page.evaluate(() => {
      for (const mi of document.querySelectorAll('[role="menuitem"]')) {
        if (mi.innerText.includes('Duplicate')) mi.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({path: 'after-duplicate.png'});

    // Try Delete
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const menus = container.querySelectorAll('button[aria-haspopup="menu"]');
      if (menus.length > 0) menus[menus.length - 1].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      for (const mi of document.querySelectorAll('[role="menuitem"]')) {
        if (mi.innerText.includes('Delete')) mi.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({path: 'after-delete.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

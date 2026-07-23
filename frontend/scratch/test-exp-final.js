const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ZUSTAND UPDATE EXPERIENCE]')) console.log(text);
    });
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Expanding Experience...");
    await page.evaluate(() => document.querySelector('#sidebar-experience button').click());
    await new Promise(r => setTimeout(r, 1000));

    // EDIT
    console.log("1. EDIT...");
    await page.evaluate(() => document.querySelector('#sidebar-experience button[type="button"] div.line-clamp-1').click());
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input[name="company"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, 'ACME Corp Edited');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('[role="dialog"] button')].find(b => b.innerText.includes('Save')).click();
    });
    await new Promise(r => setTimeout(r, 1500));
    let canvas = await page.$('canvas');
    await canvas.screenshot({path: 'experience-1-edit.png'});

    // DUPLICATE
    console.log("2. DUPLICATE...");
    await page.evaluate(() => {
      const menus = document.querySelectorAll('#sidebar-experience button[aria-haspopup="menu"]');
      menus[0].click();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      [...document.querySelectorAll('[role="menuitem"]')].find(mi => mi.innerText.includes('Duplicate')).click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // The duplicate opens the Create Dialog pre-filled!
    // We need to click "Create" to save it!
    console.log("Saving duplicated entry...");
    await page.evaluate(() => {
      [...document.querySelectorAll('[role="dialog"] button')].find(b => b.innerText.includes('Create')).click();
    });
    await new Promise(r => setTimeout(r, 1500));
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'experience-2-duplicate.png'});

    // ADD
    console.log("3. ADD...");
    await page.evaluate(() => {
      [...document.querySelectorAll('#sidebar-experience button')].find(b => b.innerText.includes('Add an experience')).click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const input = document.querySelector('[role="dialog"] input[name="company"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, 'New ACME Entry');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('[role="dialog"] button')].find(b => b.innerText.includes('Create')).click();
    });
    await new Promise(r => setTimeout(r, 1500));
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'experience-3-add.png'});

    // DELETE
    console.log("4. DELETE...");
    await page.evaluate(() => {
      const menus = document.querySelectorAll('#sidebar-experience button[aria-haspopup="menu"]');
      menus[menus.length - 1].click();
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      [...document.querySelectorAll('[role="menuitem"]')].find(mi => mi.innerText.includes('Delete')).click();
    });
    await new Promise(r => setTimeout(r, 500));
    // Accept confirm dialog if there is one
    await page.evaluate(() => {
      const dialogButtons = document.querySelectorAll('[role="alertdialog"] button');
      if (dialogButtons.length > 0) {
        [...dialogButtons].find(b => b.innerText.includes('Delete') || b.innerText.includes('Confirm')).click();
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    canvas = await page.$('canvas');
    await canvas.screenshot({path: 'experience-4-delete.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

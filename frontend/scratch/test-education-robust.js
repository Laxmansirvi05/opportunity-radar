const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ZUSTAND UPDATE SECTION')) console.log(text);
    });
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Expanding Education...");
    await page.evaluate(() => document.querySelector('#sidebar-education button').click());
    await new Promise(r => setTimeout(r, 1000));

    // 1. EDIT
    console.log("1. EDIT...");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#sidebar-education button[type="button"]')].find(b => b.querySelector('div.line-clamp-1'));
      if(btn) btn.click();
    });
    
    // Wait until the modal actually appears by looking for the input
    await page.waitForSelector('input[name="institution"]', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
      const input = document.querySelector('input[name="institution"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, 'MIT University TEST');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
      // Find the submit button
      const submit = [...document.querySelectorAll('button[type="submit"]')].pop();
      if(submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await (await page.$('canvas')).screenshot({path: 'edu-1-edit.png'});

    // 2. DUPLICATE
    console.log("2. DUPLICATE...");
    await page.evaluate(() => {
      document.querySelectorAll('#sidebar-education button[aria-haspopup="menu"]')[0].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      [...document.querySelectorAll('[role="menuitem"]')].find(mi => mi.innerText.includes('Duplicate')).click();
    });
    await page.waitForSelector('input[name="institution"]', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500)); 
    await page.evaluate(() => {
      const submit = [...document.querySelectorAll('button[type="submit"]')].pop();
      if(submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await (await page.$('canvas')).screenshot({path: 'edu-2-duplicate.png'});

    // 3. ADD
    console.log("3. ADD...");
    await page.evaluate(() => {
      [...document.querySelectorAll('#sidebar-education button')].find(b => b.innerText.includes('Add an education')).click();
    });
    await page.waitForSelector('input[name="institution"]', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const input = document.querySelector('input[name="institution"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, 'New University');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const submit = [...document.querySelectorAll('button[type="submit"]')].pop();
      if(submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await (await page.$('canvas')).screenshot({path: 'edu-3-add.png'});

    // 4. DELETE
    console.log("4. DELETE...");
    await page.evaluate(() => {
      const menus = document.querySelectorAll('#sidebar-education button[aria-haspopup="menu"]');
      menus[menus.length - 1].click(); 
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      [...document.querySelectorAll('[role="menuitem"]')].find(mi => mi.innerText.includes('Delete')).click();
    });
    await new Promise(r => setTimeout(r, 1000)); 
    await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="alertdialog"] button');
      [...btns].find(b => b.innerText.includes('Delete') || b.innerText.includes('Confirm') || b.innerText.includes('Continue') || b.innerText === 'Delete').click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await (await page.$('canvas')).screenshot({path: 'edu-4-delete.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

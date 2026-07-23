const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ZUSTAND UPDATE]')) {
        console.log(text);
      }
    });
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    
    // Wait for canvas to render
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

    console.log("Capturing BEFORE screenshot...");
    const canvas = await page.$('canvas');
    await canvas.screenshot({path: 'experience-edit-before.png'});

    console.log("Clicking the first Experience item...");
    // Find the button inside the accordion content
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      if (!container) return;
      // Reorder.Item has a button with the title inside
      const items = container.querySelectorAll('button[type="button"]');
      // The first item should be the first experience entry
      for (const btn of items) {
        if (btn.querySelector('div.line-clamp-1')) {
          btn.click();
          break;
        }
      }
    });
    
    // Wait for Dialog to open
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Checking if dialog opened...");
    const dialogTitle = await page.evaluate(() => {
      const h2 = document.querySelector('[role="dialog"] h2');
      return h2 ? h2.innerText : null;
    });
    console.log("Dialog title:", dialogTitle);

    if (dialogTitle) {
      console.log("Modifying Company name...");
      await page.evaluate(() => {
        const input = document.querySelector('[role="dialog"] input[name="company"]');
        if (input) {
          input.value = 'ACME Corp TEST';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 500));
      
      console.log("Clicking Save...");
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('[role="dialog"] button');
        for (const btn of buttons) {
          if (btn.innerText.includes('Save')) {
            btn.click();
            break;
          }
        }
      });
      await new Promise(r => setTimeout(r, 2000));
      
      console.log("Capturing AFTER screenshot...");
      const canvasAfter = await page.$('canvas');
      await canvasAfter.screenshot({path: 'experience-edit-after.png'});
    }

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

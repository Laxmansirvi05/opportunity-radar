const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
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
    
    const count = await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      if (!container) return 0;
      return container.querySelectorAll('button[type="button"]').length;
    });
    console.log("Found experience items count:", count);
    
    await page.evaluate(() => {
      const container = document.querySelector('#sidebar-experience');
      const items = container.querySelectorAll('button[type="button"]');
      for (const btn of items) {
        if (btn.querySelector('div.line-clamp-1')) {
          console.log("Found an item button, clicking...");
          btn.click();
          break;
        }
      }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    const dialogTitle = await page.evaluate(() => {
      const h2 = document.querySelector('[role="dialog"] h2');
      return h2 ? h2.innerText : null;
    });
    console.log("Dialog title:", dialogTitle);

    if (dialogTitle) {
      await page.evaluate(() => {
        const input = document.querySelector('[role="dialog"] input[name="company"]');
        if (input) {
          console.log("Found company input, typing...");
          input.value = 'ACME Corp Duplicate';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          console.log("Could NOT find company input");
        }
      });
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('[role="dialog"] button');
        for (const btn of buttons) {
          if (btn.innerText.includes('Save')) {
            console.log("Clicking Save...");
            btn.click();
          }
        }
      });
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

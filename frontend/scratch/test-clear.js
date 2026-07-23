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
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    
    // Wait for canvas to render
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Expanding Basics...");
    await page.evaluate(() => {
      const btn = document.querySelector('#sidebar-basics button');
      if (btn && btn.getAttribute('aria-expanded') === 'false') {
        btn.click();
      }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Clearing input reliably...");
    await page.focus('input[name="name"]');
    await page.evaluate(() => {
      const input = document.querySelector('input[name="name"]');
      input.value = '';
      // Dispatch input event so React knows it changed
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    console.log("Typing 'David Kowalski TEST'...");
    await page.type('input[name="name"]', 'David Kowalski TEST');
    
    await new Promise(r => setTimeout(r, 2000));
    
    const valAfter = await page.$eval('input[name="name"]', el => el.value);
    console.log("Input value AFTER:", valAfter);
    
    const canvasAfter = await page.$('canvas');
    await canvasAfter.screenshot({path: 'basics-after-reliable.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

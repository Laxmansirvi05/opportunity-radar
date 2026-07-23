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
    await new Promise(r => setTimeout(r, 2000)); // wait for full render

    console.log("Capturing BEFORE screenshot...");
    const canvas = await page.$('canvas');
    await canvas.screenshot({path: 'basics-before.png'});

    const valBefore = await page.$eval('input[name="name"]', el => el.value);
    console.log("Input value BEFORE:", valBefore);

    console.log("Expanding Basics...");
    await page.evaluate(() => {
      const btn = document.querySelector('#sidebar-basics button');
      if (btn && btn.getAttribute('aria-expanded') === 'false') {
        btn.click();
      }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Typing into 'name' input...");
    // clear input first
    await page.click('input[name="name"]', {clickCount: 3});
    await page.type('input[name="name"]', 'David Kowalski TEST');
    
    // Wait for debounce and PDF generation
    await new Promise(r => setTimeout(r, 2000));
    
    const valAfter = await page.$eval('input[name="name"]', el => el.value);
    console.log("Input value AFTER:", valAfter);

    console.log("Capturing AFTER screenshot...");
    const canvasAfter = await page.$('canvas');
    await canvasAfter.screenshot({path: 'basics-after.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ZUSTAND UPDATE METADATA]')) console.log(text);
    });
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log("Switching to Template Panel...");
    // The right sidebar has icons for Template, Typography, Colors.
    // Template is index 0.
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 0) tabs[0].click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 1. TEMPLATE
    console.log("1. Change Template...");
    await page.evaluate(() => {
      const btn = document.querySelector('#right-sidebar button.group\\/preview');
      if(btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    // Click a template that is NOT the active one
    await page.evaluate(() => {
      const templates = document.querySelectorAll('[role="dialog"] button');
      // The first one is probably active, click the second one
      if(templates.length > 1) templates[1].click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await (await page.$('canvas')).screenshot({path: 'right-1-template.png'});

    // 2. DESIGN (Colors)
    console.log("2. Change Color...");
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('#right-sidebar [role="tab"]');
      if (tabs.length > 2) tabs[2].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
      // Click one of the QuickColorCircles (e.g., the second one)
      const colors = document.querySelectorAll('#right-sidebar button');
      if(colors.length > 1) colors[1].click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await (await page.$('canvas')).screenshot({path: 'right-2-color.png'});

  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

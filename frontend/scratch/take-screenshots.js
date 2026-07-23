const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  
  try {
    console.log("Capturing Opportunity Radar Builder...");
    const page1 = await browser.newPage();
    page1.on('console', msg => console.log('OR LOG:', msg.text()));
    await page1.setViewport({ width: 1440, height: 900 });
    await page1.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 4000));
    await page1.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/076d74e7-bf68-43b7-b233-f679c6d84a64/opportunity-radar-screenshot.png' });
    
    console.log("Capturing Reactive Resume Builder...");
    const page2 = await browser.newPage();
    page2.on('console', msg => console.log('RR LOG:', msg.text()));
    await page2.setViewport({ width: 1440, height: 900 });
    await page2.goto('http://localhost:3001/builder/mock-test');
    await new Promise(r => setTimeout(r, 5000));
    await page2.screenshot({ path: '/Users/laxmansirvi/.gemini/antigravity-ide/brain/076d74e7-bf68-43b7-b233-f679c6d84a64/reactive-resume-screenshot.png' });
    console.log("Screenshots saved.");
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

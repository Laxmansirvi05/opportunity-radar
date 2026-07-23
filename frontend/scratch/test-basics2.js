const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 4000));
    
    console.log("Expanding Basics...");
    // The accordion header for basics is #sidebar-basics. The trigger is inside it.
    await page.evaluate(() => {
      const btn = document.querySelector('#sidebar-basics button');
      if (btn && btn.getAttribute('aria-expanded') === 'false') {
        btn.click();
      }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Typing into 'name' input...");
    await page.type('input[name="name"]', ' TEST');
    
    await new Promise(r => setTimeout(r, 1000));
    
    const val = await page.$eval('input[name="name"]', el => el.value);
    console.log("Input value is now:", val);
    
    await page.screenshot({path: 'basics-test2.png'});
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    // Inject a function to read Zustand state
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log("Typing into 'name' input...");
    // Find the input with name="name"
    await page.type('input[name="name"]', ' TEST');
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Check if store updated
    // The Zustand store might not be easily accessible globally unless we expose it.
    // Let's just check the form value.
    const val = await page.$eval('input[name="name"]', el => el.value);
    console.log("Input value is now:", val);
    
    // Check if any errors occurred
    await page.screenshot({path: 'basics-test.png'});
  } catch(e) { console.error(e); } finally { await browser.close(); }
})();

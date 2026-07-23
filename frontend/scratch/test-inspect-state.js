const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check localstorage or any state we can expose, or just log the react-resizable-panels style
    const style = await page.evaluate(() => {
      const left = document.getElementById('left');
      if(!left) return null;
      return left.style.cssText;
    });
    console.log("LEFT STYLE:", style);
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

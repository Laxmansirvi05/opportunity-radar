const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await new Promise(r => setTimeout(r, 2000));
    
    const evidence = await page.evaluate(() => {
      const shell = document.querySelector('.flex.h-svh.flex-col');
      const parent = shell?.parentElement;
      return {
        shellTag: shell?.tagName,
        shellClasses: shell?.className,
        shellWidth: shell?.getBoundingClientRect().width,
        parentTag: parent?.tagName,
        parentClasses: parent?.className,
        parentWidth: parent?.getBoundingClientRect().width,
        windowWidth: window.innerWidth
      };
    });
    console.log(JSON.stringify(evidence, null, 2));
    
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();

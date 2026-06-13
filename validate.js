const puppeteer = require('puppeteer');

async function getStyles(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  const styles = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector('main');
    
    function getProps(el) {
      if (!el) return null;
      const comp = window.getComputedStyle(el);
      return {
        backgroundColor: comp.backgroundColor,
        color: comp.color,
        varBackground: comp.getPropertyValue('--background').trim(),
        varColorBackground: comp.getPropertyValue('--color-background').trim(),
        varForeground: comp.getPropertyValue('--foreground').trim(),
        varCard: comp.getPropertyValue('--card').trim(),
        varColorSurface: comp.getPropertyValue('--color-surface').trim()
      };
    }

    return {
      html: getProps(html),
      body: getProps(body),
      main: getProps(main)
    };
  });

  await browser.close();
  return styles;
}

async function run() {
  console.log("Validating Integrated Frontend (http://localhost:3000)...");
  try {
    const front = await getStyles('http://localhost:3000');
    console.log("Frontend Styles:", JSON.stringify(front, null, 2));
  } catch(e) {
    console.error("Error reading frontend:", e.message);
  }

  console.log("\nValidating Original Hero (http://localhost:3001)...");
  try {
    const hero = await getStyles('http://localhost:3001');
    console.log("Original Hero Styles:", JSON.stringify(hero, null, 2));
  } catch(e) {
    console.error("Error reading hero:", e.message);
  }
}

run();

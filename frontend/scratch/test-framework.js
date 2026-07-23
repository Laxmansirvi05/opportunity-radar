const puppeteer = require('puppeteer');
const fs = require('fs');

const SECTIONS = [
  { id: 'experience', type: 'list', inputName: 'company', addText: 'Add a new experience' },
  { id: 'education', type: 'list', inputName: 'school', addText: 'Add a new education' },
  { id: 'skills', type: 'list', inputName: 'name', addText: 'Add a new skill' },
  { id: 'projects', type: 'list', inputName: 'name', addText: 'Add a new project' },
  { id: 'profiles', type: 'list', inputName: 'network', addText: 'Add a new profile' },
  { id: 'certifications', type: 'list', inputName: 'title', addText: 'Add a new certification' },
  { id: 'awards', type: 'list', inputName: 'title', addText: 'Add a new award' },
  { id: 'publications', type: 'list', inputName: 'title', addText: 'Add a new publication' },
  { id: 'volunteer', type: 'list', inputName: 'organization', addText: 'Add a new volunteer' },
  { id: 'references', type: 'list', inputName: 'name', addText: 'Add a new reference' },
  { id: 'interests', type: 'list', inputName: 'name', addText: 'Add a new interest' },
  { id: 'languages', type: 'list', inputName: 'language', addText: 'Add a new language' },
];

async function runListSectionTest(page, section) {
  const result = { feature: section.id, opened: true, added: false, edited: false, duplicated: false, deleted: false, error: null };
  try {
    // Scroll to the section to ensure it is in view
    await page.evaluate((id) => {
      document.querySelector(`#sidebar-${id}`).scrollIntoView();
    }, section.id);
    await new Promise(r => setTimeout(r, 500));

    // ADD
    await page.evaluate((id) => {
      const addBtn = [...document.querySelectorAll(`#sidebar-${id} button`)].find(b => b.innerText.includes('Add a'));
      if(addBtn) addBtn.click();
    }, section.id);
    await page.waitForSelector(`input[name="${section.inputName}"]`, { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate((name) => {
      const input = document.querySelector(`input[name="${name}"]`);
      if(input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, 'TEST_' + name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submit = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.type === 'submit' || b.innerText.includes('Create') || b.innerText.includes('Save'));
      if(submit) submit.click();
    }, section.inputName);
    await new Promise(r => setTimeout(r, 1500));
    result.added = true;

    // EDIT
    await page.evaluate((id) => {
      const btn = [...document.querySelectorAll(`#sidebar-${id} button[type="button"]`)].find(b => b.querySelector('div.line-clamp-1'));
      if(btn) btn.click();
    }, section.id);
    await page.waitForSelector(`input[name="${section.inputName}"]`, { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate((name) => {
      const input = document.querySelector(`input[name="${name}"]`);
      if(input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, 'EDITED_' + name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submit = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.type === 'submit' || b.innerText.includes('Save'));
      if(submit) submit.click();
    }, section.inputName);
    await new Promise(r => setTimeout(r, 1500));
    result.edited = true;

    // DUPLICATE
    await page.evaluate((id) => {
      const menus = document.querySelectorAll(`#sidebar-${id} button[aria-haspopup="menu"]`);
      if(menus.length > 0) menus[menus.length - 1].click(); // click the last item's dropdown
    }, section.id);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const dup = [...document.querySelectorAll('[role="menuitem"]')].find(mi => mi.innerText.includes('Duplicate'));
      if(dup) dup.click();
    });
    await page.waitForSelector(`input[name="${section.inputName}"]`, { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const submit = [...document.querySelectorAll('[role="dialog"] button')].find(b => b.type === 'submit' || b.innerText.includes('Create'));
      if(submit) submit.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    result.duplicated = true;

    // DELETE
    await page.evaluate((id) => {
      const menus = document.querySelectorAll(`#sidebar-${id} button[aria-haspopup="menu"]`);
      if(menus.length > 0) menus[menus.length - 1].click(); 
    }, section.id);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const del = [...document.querySelectorAll('[role="menuitem"]')].find(mi => mi.innerText.includes('Delete'));
      if(del) del.click();
    });
    await new Promise(r => setTimeout(r, 500)); 
    await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="alertdialog"] button');
      const confirmBtn = [...btns].find(b => b.innerText.includes('Delete') || b.innerText.includes('Confirm') || b.innerText.includes('Continue') || b.innerText === 'Delete');
      if(confirmBtn) confirmBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    result.deleted = true;
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

(async () => {
  const browser = await puppeteer.launch();
  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1440, height: 900});
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[ZUSTAND UPDATE SECTION')) {
        console.log(text);
      }
    });
    await page.goto('http://localhost:3000/resume/builder/local-test');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    for (const section of SECTIONS) {
      console.log(`Testing ${section.id}...`);
      if (section.type === 'list') {
        const res = await runListSectionTest(page, section);
        results.push(res);
        console.log(res);
      }
    }
  } catch(e) { 
    console.error(e); 
  } finally { 
    fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
    await browser.close(); 
  }
})();

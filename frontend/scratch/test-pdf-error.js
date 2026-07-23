const fs = require('fs');
const file = 'features/resume/preview/preview.browser.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  '} catch {}',
  '} catch (e) { console.error("PDF ERROR:", e); }'
);
fs.writeFileSync(file, content);

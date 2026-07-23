const fs = require('fs');
const file = 'features/resume/builder/draft.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'console.log("USE PARAMS:", params);',
  'console.log("USE PARAMS:", JSON.stringify(params));'
);
fs.writeFileSync(file, content);

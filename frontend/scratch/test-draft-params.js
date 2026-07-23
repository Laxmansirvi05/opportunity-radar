const fs = require('fs');
const file = 'features/resume/builder/draft.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'const params = useParams() as { resumeId?: string };',
  'const params = useParams() as { resumeId?: string }; console.log("USE PARAMS:", params);'
);
fs.writeFileSync(file, content);

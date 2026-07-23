const fs = require('fs');
const file = 'features/resume/builder/draft.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'const builderResumeData = useResumeData();',
  'const builderResumeData = useResumeData(); console.log("RESUME DATA:", builderResumeData ? "EXISTS" : "UNDEFINED", "IS_READY:", useResumeStore.getState().isReady);'
);
fs.writeFileSync('features/resume/preview/preview.tsx', fs.readFileSync('features/resume/preview/preview.tsx', 'utf8').replace(
  'const builderResumeData = useResumeData();',
  'const builderResumeData = useResumeData(); console.log("PREVIEW RESUME DATA:", builderResumeData ? "EXISTS" : "UNDEFINED");'
));

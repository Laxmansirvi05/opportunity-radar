const fs = require('fs');

// This uses a quick custom globber or just paths
const files = [
  'frontend/hooks/use-form-blocker.tsx',
  'frontend/features/resume/dialogs/resume/sections/certification.tsx',
  'frontend/features/resume/dialogs/resume/template/gallery.tsx',
  'frontend/features/resume/dialogs/resume/sections/education.tsx',
  'frontend/features/resume/dialogs/resume/sections/cover-letter.tsx',
  'frontend/features/resume/dialogs/resume/sections/interest.tsx',
  'frontend/features/resume/dialogs/resume/sections/award.tsx',
  'frontend/features/resume/dialogs/resume/template/gallery.test.tsx',
  'frontend/features/resume/dialogs/resume/sections/project.tsx',
  'frontend/features/resume/dialogs/resume/sections/summary-item.tsx',
  'frontend/features/resume/dialogs/resume/sections/language.tsx',
  'frontend/features/resume/dialogs/resume/sections/publication.tsx',
  'frontend/features/resume/dialogs/resume/sections/reference.tsx',
  'frontend/features/resume/dialogs/resume/sections/profile.tsx',
  'frontend/features/resume/dialogs/resume/sections/skill.tsx',
  'frontend/features/resume/dialogs/resume/sections/volunteer.tsx',
  'frontend/features/resume/dialogs/resume/sections/experience.tsx',
  'frontend/features/resume/dialogs/resume/sections/custom.tsx'
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  if (content.includes('@/dialogs/store')) {
    content = content.replace(/@\/dialogs\/store/g, '@/features/resume/dialogs/store');
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  }
}

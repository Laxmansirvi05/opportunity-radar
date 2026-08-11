import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walk(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

walk('./lib/resume-toolkit', (file) => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Replace Lingui macros
    content = content.replace(/@lingui\/core\/macro/g, '@/lib/resume-toolkit/lingui-dummy');
    content = content.replace(/@lingui\/react\/macro/g, '@/lib/resume-toolkit/lingui-dummy');
    content = content.replace(/@lingui\/core/g, '@/lib/resume-toolkit/lingui-dummy');
    content = content.replace(/@lingui\/react/g, '@/lib/resume-toolkit/lingui-dummy');

    // Replace alias paths for utils, schema, fonts etc to compatibility layers or actual packages
    content = content.replace(/@reactive-resume\/utils/g, '@/lib/resume-toolkit/utils');
    content = content.replace(/@reactive-resume\/schema/g, '@/lib/resume-toolkit/schema');
    content = content.replace(/@reactive-resume\/fonts/g, '@/lib/resume-toolkit/fonts');
    
    // Replace UI components to use our shadcn folder
    content = content.replace(/@reactive-resume\/ui\/components\//g, '@/components/ui/');

    // Replace generic feature imports
    content = content.replace(/@\/features\/resume\/builder\/draft/g, '@/lib/resume-toolkit/draft');
    content = content.replace(/@\/hooks\/use-mobile/g, '@/hooks/use-mobile');

    fs.writeFileSync(file, content);
  }
});

import os
import glob

replacements = {
    '@reactive-resume/schema': '@/lib/reactive-resume/schema/src',
    '@reactive-resume/utils': '@/lib/reactive-resume/utils/src',
    '@reactive-resume/fonts': '@/lib/reactive-resume/fonts/src',
    '@reactive-resume/resume': '@/lib/reactive-resume/resume/src'
}

for root, _, files in os.walk('frontend/src/lib/reactive-resume'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            modified = False
            for old, new in replacements.items():
                if old in content:
                    content = content.replace(old, new)
                    modified = True
            
            if modified:
                with open(filepath, 'w') as f:
                    f.write(content)
                print(f"Updated {filepath}")

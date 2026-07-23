#!/bin/bash
compare_file() {
  echo "--- DIFF for $3 ---"
  diff -u "$1" "$2"
  echo "-------------------"
}

RR="/Users/laxmansirvi/reactive-resume/apps/web/src"
OR="/Users/laxmansirvi/Opportunity radar/frontend/features/resume"

# BuilderPageClient & BuilderLayoutShell
compare_file "$RR/routes/builder/\$resumeId/route.tsx" "$OR/builder/page-client.tsx" "BuilderPageClient"
compare_file "$RR/routes/builder/\$resumeId/route.tsx" "$OR/builder/layout-shell.tsx" "BuilderLayoutShell"

# BuilderSidebarLeft
compare_file "$RR/routes/builder/\$resumeId/-sidebar/left/index.tsx" "$OR/builder/sidebar/left/index.tsx" "BuilderSidebarLeft"

# BuilderSidebarRight
compare_file "$RR/routes/builder/\$resumeId/-sidebar/right/index.tsx" "$OR/builder/sidebar/right/index.tsx" "BuilderSidebarRight"

# BuilderDock (Wait, where is BuilderDock?)
# In RR: apps/web/src/routes/builder/$resumeId/-components/dock.tsx ?
# Or is it in bottom-dock? Let's check where dock is.

# PreviewPage
compare_file "$RR/routes/builder/\$resumeId/-components/preview-page.tsx" "$OR/builder/components/preview-page.tsx" "PreviewPage"

# Draft Store & Resume Store
compare_file "$RR/store/resume.ts" "$OR/builder/draft.ts" "ResumeStore"

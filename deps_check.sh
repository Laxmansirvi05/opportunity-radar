#!/bin/bash

deps=(
  "@base-ui/react" "@google/generative-ai" "@hookform/resolvers"
  "@react-three/drei" "@react-three/fiber" "@supabase/ssr" "@supabase/supabase-js"
  "cheerio" "class-variance-authority" "clsx" "framer-motion" "groq-sdk"
  "lucide-react" "next" "pdfjs-dist" "pg" "react" "react-dom" "react-hook-form"
  "sanitize-html" "shadcn" "tailwind-merge" "three" "tw-animate-css" "zod" "zxcvbn"
)

for dep in "${deps[@]}"; do
  count=$(grep -RE "(from |require\()['\"]${dep}(/.*)?['\"]" frontend --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=archive --exclude=package*.json --exclude=*.config.js --exclude=*.config.ts 2>/dev/null | wc -l)
  echo "$dep: $count"
done

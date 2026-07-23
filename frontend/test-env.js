require('dotenv').config({ path: '.env.local' });
require('child_process').execSync('npx tsx scripts/verify-extraction.ts', { stdio: 'inherit', env: process.env });

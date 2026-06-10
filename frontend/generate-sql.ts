import { YCProvider } from '../src/providers/opportunities/providers/YCProvider';
import * as fs from 'fs';
import * as path from 'path';

async function generateSQL() {
  const provider = new YCProvider();
  const rawJobs = await provider.fetch();
  // Target 15 records
  const jobs = rawJobs.slice(0, 15);

  let sql = `-- Validation Data Insert\n\n`;
  sql += `INSERT INTO public.opportunities (title, company_name, description, apply_url, location, category, status, source, source_id, posted_at, updated_at) VALUES\n`;

  const values = jobs.map(raw => {
    const opp = provider.normalize(raw);
    return `(
      '${opp.title.replace(/'/g, "''")}',
      '${opp.company.replace(/'/g, "''")}',
      '${opp.description.replace(/'/g, "''")}',
      '${opp.apply_url.replace(/'/g, "''")}',
      '${opp.location.replace(/'/g, "''")}',
      '${opp.category.replace(/'/g, "''")}',
      'Published',
      '${opp.source.replace(/'/g, "''")}',
      '${opp.source_id.replace(/'/g, "''")}',
      NOW(),
      NOW()
    )`;
  });

  sql += values.join(',\n') + ';\n';

  const outputPath = path.join(__dirname, '../supabase/migrations/20260610000004_insert_validation_data.sql');
  fs.writeFileSync(outputPath, sql);
  console.log(`Wrote ${jobs.length} records to migration file`);
}

generateSQL().catch(console.error);

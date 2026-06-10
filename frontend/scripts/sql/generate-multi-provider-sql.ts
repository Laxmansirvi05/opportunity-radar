import { UnstopProvider } from '../../../src/providers/opportunities/providers/UnstopProvider';
import { WellfoundProvider } from '../../../src/providers/opportunities/providers/WellfoundProvider';
import { InternshalaProvider } from '../../../src/providers/opportunities/providers/InternshalaProvider';
import { YCProvider } from '../../../src/providers/opportunities/providers/YCProvider';
import { DevfolioProvider } from '../../../src/providers/opportunities/providers/DevfolioProvider';
import { GSoCProvider } from '../../../src/providers/opportunities/providers/GSoCProvider';
import { OutreachyProvider } from '../../../src/providers/opportunities/providers/OutreachyProvider';
import { LFXProvider } from '../../../src/providers/opportunities/providers/LFXProvider';
import { AmazonProvider } from '../../../src/providers/opportunities/providers/AmazonProvider';
import { GitHubProvider } from '../../../src/providers/opportunities/providers/GitHubProvider';
import { AtlassianProvider } from '../../../src/providers/opportunities/providers/AtlassianProvider';
import { OpportunityIngestionService } from '../../../src/providers/opportunities/ingestion/OpportunityIngestionService';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkfghzeeyqngpquaspuz.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_u-kGLYM5RkJE4IECpRix0Q_PvTlBbCm';
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateSQL() {
  const providers = [
    new YCProvider(),
    new UnstopProvider(),
    new WellfoundProvider(),
    new InternshalaProvider(),
    new DevfolioProvider(),
    new GSoCProvider(),
    new OutreachyProvider(),
    new LFXProvider(),
    new AmazonProvider(),
    new GitHubProvider(),
    new AtlassianProvider()
  ];

  // We use a mock DB client to intercept upserts and write them to SQL
  const generatedQueries: string[] = [];
  let skipped_dup = 0;

  const fingerprintSet = new Set<string>();

  // Generate a simplistic fingerprint
  const generateFingerprint = (title: string, company: string) => {
    const normalizeString = (str: string) =>
      str.toLowerCase()
        .replace(/\(.*\)/g, '') // remove parentheticals
        .replace(/\\b(intern|internship|role|at|inc|llc|ltd)\\b/g, '') // remove stop words
        .replace(/[^a-z0-9]/g, '') // strip special chars and spaces
        .trim();

    return `${normalizeString(company)}:${normalizeString(title)}`;
  };

  // Pre-load from DB (read-only is allowed with anon key for published jobs if RLS allows, but let's just do it in memory for the run)
  const { data: existingRecords } = await supabase.from('opportunities').select('title, company_name');
  if (existingRecords) {
    existingRecords.forEach((record: any) => {
      if (record.title && record.company_name) {
        fingerprintSet.add(generateFingerprint(record.title, record.company_name));
      }
    });
  }

  for (const provider of providers) {
    const rawData = await provider.fetch();
    for (const raw of rawData) {
      const normalized = provider.normalize(raw);
      if (!normalized.title || !normalized.company) continue;

      const fingerprint = generateFingerprint(normalized.title, normalized.company);
      if (fingerprintSet.has(fingerprint)) {
        skipped_dup++;
        continue;
      }
      fingerprintSet.add(fingerprint);

      // Map to DB columns
      const payload = {
        title: normalized.title,
        company_name: normalized.company,
        location: normalized.location,
        description: normalized.description,
        apply_url: normalized.apply_url,
        category: normalized.category,
        source: normalized.source,
        source_id: normalized.source_id,
        status: 'Published',
        event_date: normalized.event_date || null,
        registration_deadline: normalized.registration_deadline || null,
        program_duration: normalized.program_duration || null
      };

      generatedQueries.push(`INSERT INTO public.opportunities (title, company_name, description, apply_url, location, category, status, source, source_id, event_date, registration_deadline, program_duration, posted_at, updated_at)
      SELECT 
        '${payload.title.replace(/'/g, "''")}',
        '${payload.company_name.replace(/'/g, "''")}',
        '${payload.description?.replace(/'/g, "''") || ''}',
        '${payload.apply_url.replace(/'/g, "''")}',
        '${payload.location.replace(/'/g, "''")}',
        '${payload.category.replace(/'/g, "''")}',
        '${payload.status}',
        '${payload.source.replace(/'/g, "''")}',
        '${payload.source_id.replace(/'/g, "''")}',
        ${payload.event_date ? `'${payload.event_date}'` : 'NULL'},
        ${payload.registration_deadline ? `'${payload.registration_deadline}'` : 'NULL'},
        ${payload.program_duration ? `'${payload.program_duration.replace(/'/g, "''")}'` : 'NULL'},
        NOW(),
        NOW()
      WHERE NOT EXISTS (SELECT 1 FROM public.opportunities WHERE source_id = '${payload.source_id.replace(/'/g, "''")}')`);
    }
  }

  if (generatedQueries.length === 0) {
    console.log('No new records to insert.');
    return;
  }

  let sql = `-- Phase 1H Multi-Source Ecosystem Validation Data Insert\n\n`;
  sql += generatedQueries.join(';\n') + ';\n';

  const outputPath = path.join(__dirname, '../../../supabase/migrations/20260610000009_insert_enterprise_data.sql');
  fs.writeFileSync(outputPath, sql);

  console.log(`Wrote ${generatedQueries.length} records to migration file. Skipped ${skipped_dup} duplicates.`);
}

generateSQL().catch(console.error);

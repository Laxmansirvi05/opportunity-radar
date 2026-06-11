import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function executeDeletions() {
  console.log("Connecting to Supabase to execute cleanup...");

  // First, verify initial count
  const { data: initialData, error: initialError } = await supabase
    .from('opportunities')
    .select('id');

  if (initialError) {
    console.error("Error fetching initial count:", initialError);
    return;
  }

  const initialCount = initialData.length;
  console.log(`Total opportunities before cleanup: ${initialCount}`);

  // Read the cleanup script
  const sqlPath = path.join(process.cwd(), 'final_cleanup.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error("final_cleanup.sql not found!");
    return;
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  const lines = sqlContent.split('\n');

  let weakDesc = 0;
  let brokenLink = 0;
  let duplicate = 0;
  let missingUrl = 0;
  let demo = 0;
  let expired = 0;

  let successfulDeletes = 0;
  let failedDeletes = 0;

  for (const line of lines) {
    if (line.includes('DELETE FROM opportunities WHERE id =')) {
      const match = line.match(/id = '([^']+)'/);
      if (match) {
        const id = match[1];

        // Count reasons
        if (line.includes('Weak description')) weakDesc++;
        else if (line.includes('Broken link')) brokenLink++;
        else if (line.includes('Duplicate')) duplicate++;
        else if (line.includes('Missing URL')) missingUrl++;
        else if (line.includes('Demo')) demo++;
        else if (line.includes('Expired')) expired++;

        // Execute DELETE via API
        const { error } = await supabase
          .from('opportunities')
          .delete()
          .eq('id', id);

        if (error) {
          console.error(`Failed to delete ${id}:`, error.message);
          failedDeletes++;
        } else {
          successfulDeletes++;
        }
      }
    }
  }

  console.log(`\nDeletion Attempt Complete.`);
  console.log(`Successfully deleted: ${successfulDeletes}`);
  if (failedDeletes > 0) {
    console.log(`Failed to delete (RLS or other error): ${failedDeletes}`);
  }

  // Also execute the skills update script if it exists
  const skillsSqlPath = path.join(process.cwd(), 'skills_update.sql');
  if (fs.existsSync(skillsSqlPath)) {
    console.log(`\nExecuting skills_update.sql...`);
    const skillsSqlContent = fs.readFileSync(skillsSqlPath, 'utf-8');
    const skillsLines = skillsSqlContent.split('\n');
    let successfulSkills = 0;

    // Check if skills column exists
    const { error: columnError } = await supabase.from('opportunities').select('skills').limit(1);
    if (columnError && columnError.code === '42703') {
      console.log('Cannot update skills because the skills column does not exist on the database yet. (Requires ALTER TABLE which anon key cannot do).');
    } else {
      for (const line of skillsLines) {
        if (line.includes('UPDATE opportunities SET skills =')) {
          const idMatch = line.match(/id = '([^']+)'/);
          const skillsMatch = line.match(/skills = '([^']+)'::jsonb/);

          if (idMatch && skillsMatch) {
            const id = idMatch[1];
            try {
              const skillsArray = JSON.parse(skillsMatch[1].replace(/''/g, "'"));
              const { error: updateError } = await supabase
                .from('opportunities')
                .update({ skills: skillsArray })
                .eq('id', id);

              if (!updateError) successfulSkills++;
            } catch (e) {
              // Parse error
            }
          }
        }
      }
      console.log(`Successfully updated skills for ${successfulSkills} opportunities.`);
    }
  }

  // Final count
  const { data: finalData, error: finalError } = await supabase
    .from('opportunities')
    .select('id');

  if (finalError) {
    console.error("Error fetching final count:", finalError);
    return;
  }

  const finalCount = finalData.length;

  console.log('\n--- FINAL REPORT ---');
  console.log(`Total opportunities before cleanup: ${initialCount}`);
  console.log(`Total opportunities after cleanup: ${finalCount}`);
  console.log(`Broken links removed: ${brokenLink}`);
  console.log(`Duplicate records removed: ${duplicate}`);
  console.log(`Weak records removed: ${weakDesc}`);
  console.log(`Final live database count: ${finalCount}`);
}

executeDeletions();

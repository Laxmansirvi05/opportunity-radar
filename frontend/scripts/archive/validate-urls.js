import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkfghzeeyqngpquaspuz.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_ANON_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function checkUrl(url) {
  if (!url) return false
  if (url.includes('localhost') || url.includes('example.com') || url === '#') {
    return false
  }
  if (!url.startsWith('http')) {
    return false
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    // Some sites block HEAD requests, so we use GET with a range header to just fetch headers if possible
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Range': 'bytes=0-0' },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // We consider 2xx, 3xx and 403 (often anti-bot protection) as "reachable"
    if (response.ok || response.status < 400 || response.status === 403) {
      return true
    }
    
    // If it's a 404 or 500, it's likely dead
    if (response.status === 404 || response.status >= 500) {
      return false
    }
    
    return true
  } catch (error) {
    // If there's a timeout or DNS error, it's likely dead
    return false
  }
}

async function main() {
  console.log('Fetching all opportunities...')
  
  // We need to fetch all, Supabase limits to 1000 per request by default
  let allOpps = []
  let from = 0
  let to = 999
  let hasMore = true
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, title, apply_url, company_id, companies(name)')
      .range(from, to)
      
    if (error) {
      console.error('Error fetching opportunities:', error)
      break
    }
    
    if (data.length > 0) {
      allOpps = [...allOpps, ...data]
      from += 1000
      to += 1000
    } else {
      hasMore = false
    }
  }
  
  console.log(`Found ${allOpps.length} opportunities. Validating URLs...`)
  
  const invalidOpps = []
  const demoCompanies = ['Demo', 'Placeholder', 'Test Company'] // Based on common seed data
  
  let i = 0;
  for (const opp of allOpps) {
    i++;
    if (i % 10 === 0) console.log(`Progress: ${i} / ${allOpps.length}`)
    
    const companyName = opp.companies?.name || ''
    const isDemo = demoCompanies.some(d => companyName.includes(d)) || opp.title.includes('Demo') || opp.title.includes('Test ')
    
    if (isDemo) {
      console.log(`❌ [DEMO DATA] ${opp.title} at ${companyName}`)
      invalidOpps.push(opp.id)
      continue
    }
    
    const isValid = await checkUrl(opp.apply_url)
    if (!isValid) {
      console.log(`❌ [INVALID URL] ${opp.title} - ${opp.apply_url}`)
      invalidOpps.push(opp.id)
    }
  }
  
  console.log(`\nValidation complete. Found ${invalidOpps.length} invalid or demo opportunities.`)
  
  if (invalidOpps.length > 0) {
    // Generate SQL file
    const sql = `-- Run this in your Supabase SQL Editor to clean up demo and broken links\n\n` +
      `DELETE FROM opportunities WHERE id IN (\n` +
      invalidOpps.map(id => `  '${id}'`).join(',\n') +
      `\n);`
      
    fs.writeFileSync('cleanup.sql', sql)
    console.log(`\n✅ Generated cleanup.sql with DELETE statements.`)
    console.log(`Please run cleanup.sql in your Supabase SQL Editor.`)
  } else {
    console.log(`\n✅ All opportunities are valid! No cleanup needed.`)
  }
}

main().catch(console.error)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      Authorization: `Bearer YOUR_ACCESS_TOKEN`
    }
  }
})

// I need to get a real token. Wait, I have the service role key!
// I can sign a JWT for user 7f60c6d9-c3e3-49aa-a271-f46170b5b065.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  // We don't have the user's JWT, but we can sign in or use service role to generate one
  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  // Create a temp user
  const { data: { user }, error: err1 } = await admin.auth.admin.createUser({
    email: 'test' + Date.now() + '@example.com',
    password: 'password123',
    email_confirm: true
  })
  
  if (err1) {
    console.error('Err1', err1)
    return
  }

  // Sign in to get JWT
  const { data: { session }, error: err2 } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: 'password123'
  })

  if (err2) {
    console.error('Err2', err2)
    return
  }

  console.log('Got session for:', session.user.id)

  const payload = {
    user_id: session.user.id,
    data: {},
    status: 'uploaded',
    file_name: 'Test'
  }

  const { data, error: err3 } = await supabase
    .from('resumes')
    .insert(payload)
    .select('id')
    .single()

  if (err3) {
    console.error('INSERT ERROR:', err3)
  } else {
    console.log('INSERT SUCCESS:', data)
  }
}
test()

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient('http://localhost:54321', 'anon-key')
try {
  supabase.from('test').select('*').eq('col', null).then(r => console.log('success', r)).catch(e => console.log('promise error', e.message))
} catch(e) {
  console.log('sync error', e.message)
}

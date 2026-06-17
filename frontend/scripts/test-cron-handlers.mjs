import { GET as refreshGet } from '../app/api/cron/refresh-opportunities/route.js';
import { GET as maintenanceGet } from '../app/api/cron/maintenance/route.js';

async function test() {
  process.env.CRON_SECRET = 'test_secret';
  
  // Test 1: Missing auth header
  const req1 = new Request('http://localhost/api/cron/maintenance');
  const res1 = await maintenanceGet(req1);
  console.log('Maintenance without auth:', res1.status);

  // Test 2: Valid auth header, missing SUPABASE_SERVICE_ROLE_KEY
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const req2 = new Request('http://localhost/api/cron/maintenance', {
    headers: { 'authorization': 'Bearer test_secret' }
  });
  const res2 = await maintenanceGet(req2);
  console.log('Maintenance with auth, missing key:', res2.status, await res2.json());

  // Restore key
  process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
}

test().catch(console.error);

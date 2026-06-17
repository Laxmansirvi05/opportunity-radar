import { GET as getUnstop } from '../app/api/cron/refresh-unstop/route';
import { GET as getInternshala } from '../app/api/cron/refresh-internshala/route';
import { GET as getProviders } from '../app/api/cron/refresh-providers/route';
import { GET as getMaintenance } from '../app/api/cron/maintenance/route';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testRoute(name: string, handler: any) {
  console.log(`\n--- Testing ${name} ---`);
  const req = new Request(`http://localhost/api/cron/${name}`, {
    headers: {
      'authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  });

  const start = performance.now();
  const res = await handler(req);
  const end = performance.now();

  const data = await res.json();
  const timeMs = (end - start).toFixed(2);
  
  console.log(`Status: ${res.status}`);
  console.log(`Runtime: ${timeMs} ms`);
  console.log('Response:', JSON.stringify(data, null, 2));
}

async function run() {
  await testRoute('refresh-providers', getProviders);
  await testRoute('maintenance', getMaintenance);
  
  // Running these will take 10+ minutes each. 
  // I will trigger them using tsx directly.
  // Wait, I should do them one by one.
  await testRoute('refresh-unstop', getUnstop);
  await testRoute('refresh-internshala', getInternshala);
}

run();

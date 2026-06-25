// Test InternshalaProvider changes before making them
import { InternshalaProvider } from '../src/providers/opportunities/providers/InternshalaProvider';

async function test() {
  const provider = new InternshalaProvider();
  const data = await provider.fetch();
  console.log(`Fetched ${data.length} listings. Preview of first 2:`);
  console.log(data.slice(0, 2));
}

test().catch(console.error);

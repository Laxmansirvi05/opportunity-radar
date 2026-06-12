import { QueueProducerService } from '../src/providers/opportunities/ingestion/QueueProducerService';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const service = new QueueProducerService();
  await service.runProducer();
}

main().catch(console.error);

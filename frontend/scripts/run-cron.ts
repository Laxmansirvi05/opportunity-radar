import { QueueConsumerService } from '../src/providers/opportunities/ingestion/QueueConsumerService';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  console.log("Starting Scheduled Queue Consumer...");
  const consumer = new QueueConsumerService();
  
  // Loop until the queue is completely empty
  while (true) {
    const stats = await consumer.processBatch(20);
    
    if (stats.processed === 0) {
      console.log("Queue is empty. Exiting successfully.");
      process.exit(0);
    }
    
    // Briefly yield to avoid any immediate tight loop spikes
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(err => {
  console.error("Cron failed:", err);
  process.exit(1);
});

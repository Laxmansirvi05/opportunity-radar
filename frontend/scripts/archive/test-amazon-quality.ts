import { AmazonProvider } from '../src/providers/opportunities/providers/AmazonProvider';

async function verifyAmazonDataQuality() {
  const provider = new AmazonProvider();
  
  const url = `https://www.amazon.jobs/en/search.json?offset=0&result_limit=20&country=IND`;
  const response = await fetch(url);
  const data = await response.json();
  const jobs = data.jobs || [];

  let total = jobs.length;
  let fullDescriptions = 0;
  let extractedSkills = 0;
  let extractedResponsibilities = 0;

  jobs.forEach((job: any) => {
    const normalized = provider.normalize(job);
    
    if (normalized.description && normalized.description.length > 500) {
      fullDescriptions++;
    }
    if (normalized.skills && normalized.skills.length > 0) {
      extractedSkills++;
    } else {
      console.log(`NO SKILLS EXTRACTED FOR: ${job.title}`);
      console.log(`Quals: ${job.basic_qualifications}`);
    }
    if (normalized.requirements && normalized.requirements.length > 0) {
      extractedResponsibilities++;
    }
  });

  console.log(`=== AMAZON DATA QUALITY METRICS ===`);
  console.log(`Total Opportunities Sampled: ${total}`);
  console.log(`Full Descriptions (>500 chars): ${fullDescriptions} (${Math.round((fullDescriptions/total)*100)}%)`);
  console.log(`Extracted Skills: ${extractedSkills} (${Math.round((extractedSkills/total)*100)}%)`);
  console.log(`Extracted Responsibilities: ${extractedResponsibilities} (${Math.round((extractedResponsibilities/total)*100)}%)`);
}

verifyAmazonDataQuality().catch(console.error);

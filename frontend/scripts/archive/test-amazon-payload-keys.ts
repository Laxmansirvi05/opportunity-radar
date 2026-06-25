async function fetchAmazonSample() {
  const url = `https://www.amazon.jobs/en/search.json?offset=0&result_limit=1&country=IND`;
  const response = await fetch(url);
  const data = await response.json();
  const job = data.jobs[0];
  
  console.log("KEYS:", Object.keys(job));
  console.log("description length:", job.description?.length);
  console.log("description_short length:", job.description_short?.length);
  console.log("basic_qualifications length:", job.basic_qualifications?.length);
  console.log("preferred_qualifications length:", job.preferred_qualifications?.length);
  console.log("basic_qualifications:", job.basic_qualifications);
  console.log("preferred_qualifications:", job.preferred_qualifications);
  console.log("description:", job.description.substring(0, 150) + "...");
}

fetchAmazonSample().catch(console.error);

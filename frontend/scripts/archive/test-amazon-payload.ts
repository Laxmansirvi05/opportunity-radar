async function fetchAmazonSample() {
  const url = `https://www.amazon.jobs/en/search.json?offset=0&result_limit=2&country=IND`;
  const response = await fetch(url);
  const data = await response.json();
  const job = data.jobs[0];
  
  console.log(JSON.stringify(job, null, 2));
}

fetchAmazonSample().catch(console.error);

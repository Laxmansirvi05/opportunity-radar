import * as dotenv from 'dotenv';
async function run() {
  const url = `https://www.amazon.jobs/en/search.json?offset=0&result_limit=1&country=IND`;
  const response = await fetch(url);
  const data = await response.json();
  const jobs = data.jobs || [];
  console.log(JSON.stringify(jobs[0], null, 2));
}
run();

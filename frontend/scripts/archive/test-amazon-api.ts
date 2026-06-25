import fetch from 'node-fetch';

async function testAmazonAPI() {
  try {
    const url = 'https://www.amazon.jobs/en/search.json?offset=0&result_limit=1';
    const res = await fetch(url);
    const data = await res.json();
    console.log("Global total jobs:", data.hits);

    const indiaUrl = 'https://www.amazon.jobs/en/search.json?offset=0&result_limit=1&country=IND';
    const resInd = await fetch(indiaUrl);
    const dataInd = await resInd.json();
    console.log("India total jobs:", dataInd.hits);

    const sampleUrl = 'https://www.amazon.jobs/en/search.json?offset=0&result_limit=2';
    const resSample = await fetch(sampleUrl);
    const dataSample = await resSample.json();
    console.log("Sample job:", JSON.stringify(dataSample.jobs[0], null, 2));

  } catch (error) {
    console.error("Error fetching Amazon API:", error);
  }
}

testAmazonAPI();

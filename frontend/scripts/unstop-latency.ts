import { fetchWithRetry } from '../src/providers/opportunities/utils/fetchWithRetry';

async function auditPages() {
  const categories = ['internships', 'jobs'];
  const pagesToTest = [1, 10, 25, 40, 50];

  for (const cat of categories) {
    console.log(`\nCategory: ${cat}`);
    for (const p of pagesToTest) {
      const start = performance.now();
      await fetchWithRetry(`https://unstop.com/api/public/opportunity/search-result?opportunity=${cat}&page=${p}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      const end = performance.now();
      console.log(`Page ${p}: ${(end - start).toFixed(2)} ms`);
    }
  }
}

auditPages();

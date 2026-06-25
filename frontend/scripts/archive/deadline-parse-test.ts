// Reproduce the parseInternshalaDeadline bug exactly as it exists in backfill-enrichment.ts

function parseInternshalaDeadlineBuggy(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase() === 'rolling') return null;
  // BUG: "Jun '26" → replace("'", "20") → "Jun 2026" BUT
  // "20 Jun '26" → "20 Jun 2026"  ← this works
  // "20 Jun'26"  → "20 Jun2026"   ← MALFORMED — new Date() fallback = 2020 epoch?
  const normalized = trimmed.replace(/'/g, '20');
  const d = new Date(normalized);
  console.log(`  Input: "${trimmed}"  →  normalized: "${normalized}"  →  parsed: ${d.toISOString()}`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// What does Internshala actually show? Common formats:
const testCases = [
  "20 Jun '26",    // correct space before '
  "20 Jun'26",     // no space before '
  "Jul 11 '26",    // month first
  "11 Jul'26",     // no space
  "2 Jul '26",     // single digit day
  "Rolling",
  "",
];

console.log("=== PARSING INTERNSHALA DEADLINE FORMATS ===");
testCases.forEach(t => parseInternshalaDeadlineBuggy(t));

// Cross-check: what did the migration inserts have for ClearTax?
// The audit shows "Integration Engineer" @ ClearTax has deadline 2020-07-04
// Let's check what "20" + "Jul" + "26" gives
console.log("\n=== SPECIFIC CASE: '4 Jul '26' ===");
const text1 = "4 Jul '26";
console.log(`  replace: "${text1.replace(/'/g, '20')}"  → ${new Date(text1.replace(/'/g, '20')).toISOString()}`);

// Check: what if Internshala uses a different apostrophe character (U+2019 curly quote)?
const curlyQuote = "4 Jul \u201926";
const straightQuote = "4 Jul '26";
console.log(`\n=== APOSTROPHE CHARACTER CHECK ===`);
console.log(`  Curly ' (U+2019):   "${curlyQuote}" → normalized: "${curlyQuote.replace(/'/g, '20').replace(/\u2019/g, '20')}"`);
console.log(`  Straight ' (U+0027): "${straightQuote}" → normalized: "${straightQuote.replace(/'/g, '20')}"`);

// Now re-examine: "4 Jul 2026" should parse fine...
const test = new Date("4 Jul 2026");
console.log(`  new Date("4 Jul 2026") = ${test.toISOString()}`);  // should be July 4 2026

// What gives 2020-07-04?
// "4 Jul '26".replace("'", "20") = "4 Jul 2026"  → July 4, 2026 ← CORRECT
// So the deadlines CANNOT be coming from parseInternshalaDeadline if they show 2020.
// The backfill only sets deadline if !record.deadline. If record already had a deadline 
// from the ORIGINAL ingestion run, it was not touched.
// The original ingestion run had: item.deadline = value (raw string from .other_detail_item)
// Then OpportunityNormalizer.normalize does: new Date(rawData.deadline).toISOString()
// "20 Jun '26" was passed as-is to new Date() WITHOUT the replace fix → new Date("20 Jun '26") = ?
console.log(`\n=== ORIGINAL INGESTION BUG: new Date() WITHOUT replace ===`);
const rawFormats = ["20 Jun '26", "11 Jul '26", "12 Jun '26", "17 Jun '26", "2 Jul '26"];
rawFormats.forEach(f => {
  const d = new Date(f);
  console.log(`  new Date("${f}") = ${isNaN(d.getTime()) ? 'Invalid Date' : d.toISOString()}`);
});

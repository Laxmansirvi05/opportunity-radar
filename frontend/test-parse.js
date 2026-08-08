const fs = require('fs');
const pdf = require('pdf-parse');

async function test() {
  const buffer = fs.readFileSync('/Users/laxmansirvi/Downloads/laxman_resume.pdf');
  const data = await pdf(buffer);
  fs.writeFileSync('parsed_pdf.txt', data.text);
  console.log("Done");
}
test();

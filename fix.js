const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/providers/opportunities/providers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('Provider.ts'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if already implemented
  if (content.includes('fetchListPages')) continue;

  // Add QueuePayload import if not present
  if (!content.includes('QueuePayload')) {
    content = content.replace(
      "import { OpportunityProvider } from '../base/OpportunityProvider';",
      "import { OpportunityProvider, QueuePayload } from '../base/OpportunityProvider';"
    );
  }

  // Insert methods after class declaration
  const classDeclarationRegex = /(export class \w+ extends OpportunityProvider \{)/;
  const methods = `
  async fetchListPages(): Promise<QueuePayload[]> {
    return [];
  }

  async fetchDetailPage(url: string, rawData?: any): Promise<any> {
    return null;
  }
`;
  content = content.replace(classDeclarationRegex, `$1${methods}`);

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}

import { sanitizeAndParseResumeJson } from '../features/resume-toolkit/services/ai/sanitize.js';

const mockAiResponse = {
  basics: {
    name: "Arjun Mehta",
    headline: "Frontend Developer",
    location: "Bengaluru, India",
    profiles: [
      { network: "LinkedIn", username: "arjunmehta", url: "https://linkedin.com/in/arjunmehta" },
      { network: "GitHub", username: "arjun-dev", url: "https://github.com/arjun-dev" }
    ],
    website: { url: "https://arjunmehta.dev" },
    url: "https://arjunmehta.dev",
    customFields: [
      { text: "My Portfolio", link: "https://arjunmehta.dev" }
    ]
  },
  sections: {
    profiles: {
      items: [
        { network: "Twitter", url: "https://twitter.com/arjun" }
      ]
    },
    education: {
      items: [
        { school: "IIIT", degree: "BTech", grade: "9.1/10" }
      ]
    }
  }
};

const { data } = sanitizeAndParseResumeJson(JSON.stringify(mockAiResponse));

console.log("Custom fields length:", data.basics.customFields?.length || 0);
console.log("Profiles section exists?", !!data.sections.profiles);
console.log("Basics website:", data.basics.website);
console.log("All Good? ", (data.basics.customFields?.length === 0 && !data.basics.website) ? "YES" : "NO");


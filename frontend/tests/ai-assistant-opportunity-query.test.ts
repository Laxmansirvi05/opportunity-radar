import { describe, expect, it } from "vitest";
import { extractSearchTerms, isOpportunityQuery } from "@/app/api/assistant/route";

describe("assistant opportunity-query routing", () => {
  it("recognizes concise opportunity searches without treating learning questions as searches", () => {
    expect(isOpportunityQuery("Internships for frontend developers")).toBe(true);
    expect(isOpportunityQuery("Show me remote jobs")).toBe(true);
    expect(isOpportunityQuery("What is an internship?")).toBe(false);
  });

  it("keeps category and meaningful internal-database search terms", () => {
    expect(extractSearchTerms("Find remote AI internships for students")).toEqual({
      category: "Internship",
      query: "remote students",
    });
  });
});

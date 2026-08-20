import { describe, it, expect } from 'vitest'
import {
  isOpportunityQuery,
  extractSearchTerms,
} from '@/features/ai-assistant/lib/opportunity-query'

/**
 * Why this classifier is worth testing carefully: when it says "not a search",
 * the database is never queried, and the model — ungrounded either way — has
 * been observed to answer "I couldn't find any machine learning internships in
 * our database" about rows that were sitting right there. A missed search is
 * how the assistant ends up asserting something untrue about the data.
 */
describe('isOpportunityQuery', () => {
  it('treats verb-led requests as searches', () => {
    for (const message of [
      'find internships for react',
      'show me remote data science internships',
      'list open hackathons',
      'recommend some scholarships',
      'looking for a frontend job',
    ]) {
      expect(isOpportunityQuery(message), message).toBe(true)
    }
  })

  /**
   * The regression this was rewritten for. A bare noun phrase has no search
   * verb and does not begin with the noun, so the old rule skipped the search
   * entirely — and the assistant then reported an empty database.
   */
  it('treats a bare noun phrase as a search', () => {
    for (const message of [
      'machine learning internships in Pune',
      'remote frontend jobs',
      'python internships for freshers',
    ]) {
      expect(isOpportunityQuery(message), message).toBe(true)
    }
  })

  it('keeps "match / suit / fit" phrasing as a search', () => {
    expect(isOpportunityQuery('what internships match a React developer?')).toBe(true)
    expect(isOpportunityQuery('which jobs suit a data analyst?')).toBe(true)
  })

  it('leaves definitional questions as ordinary chat', () => {
    for (const message of [
      'what is an internship?',
      'what are hackathons?',
      'how do I fit my resume to a job?',
      'why should I do an internship?',
      'explain what a scholarship covers',
      'tell me about internships',
    ]) {
      expect(isOpportunityQuery(message), message).toBe(false)
    }
  })

  it('still searches when a definitional phrasing carries a real search verb', () => {
    // "how do I find internships" is a request for listings, not a lesson.
    expect(isOpportunityQuery('how do I find internships in Bangalore?')).toBe(true)
  })

  it('treats a question about one specific listing as chat', () => {
    expect(isOpportunityQuery('is this role a good fit for me?')).toBe(false)
    expect(isOpportunityQuery('should I apply to this internship?')).toBe(false)
  })

  it('ignores messages that name no opportunity at all', () => {
    for (const message of [
      'help me improve my resume',
      'how should I prepare for a technical interview?',
      'what should I say in a cover letter?',
    ]) {
      expect(isOpportunityQuery(message), message).toBe(false)
    }
  })
})

describe('extractSearchTerms', () => {
  it('picks the category from the noun used', () => {
    expect(extractSearchTerms('find internships in pune').category).toBe('Internship')
    expect(extractSearchTerms('open hackathons').category).toBe('Hackathon')
    expect(extractSearchTerms('frontend jobs').category).toBe('Job')
    expect(extractSearchTerms('scholarships for women').category).toBe('Scholarship')
    expect(extractSearchTerms('improve my resume').category).toBeNull()
  })

  it('keeps only the meaningful terms', () => {
    expect(extractSearchTerms('find internships for react').terms).toEqual(['react'])
    expect(extractSearchTerms('show me remote data science internships').terms).toEqual([
      'remote', 'data', 'science',
    ])
  })

  /**
   * Terms are AND-ed by the caller, so a surviving filler word does not merely
   * add noise — it excludes every row. These are the exact strings that used
   * to leak through: "what internships match a React developer" produced the
   * term string "what match react developer".
   */
  it('drops question words and search verbs that used to leak into the query', () => {
    expect(extractSearchTerms('what internships match a React developer?').terms).toEqual([
      'react', 'developer',
    ])
    expect(extractSearchTerms('any open hackathons in Bangalore?').terms).toEqual(['bangalore'])
    expect(extractSearchTerms('how do I fit my resume to a job?').terms).toEqual(['resume'])
  })

  it('bounds how many terms an AND-match has to satisfy', () => {
    const { terms } = extractSearchTerms(
      'find remote python django postgres kubernetes internships'
    )
    expect(terms.length).toBeLessThanOrEqual(4)
  })

  it('returns no terms when the message is only filler', () => {
    expect(extractSearchTerms('show me some opportunities').terms).toEqual([])
  })

  it('treats punctuation as a separator rather than joining words', () => {
    expect(extractSearchTerms('internships in pune, bangalore').terms).toEqual([
      'pune', 'bangalore',
    ])
  })
})

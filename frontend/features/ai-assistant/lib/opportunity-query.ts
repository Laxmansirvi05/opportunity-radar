/**
 * Decides whether a chat message is asking for opportunity listings, and pulls
 * the search terms out of it.
 *
 * This matters more than a classifier usually would, because of what happens
 * when it is wrong. If the message asks for listings and this says no, the
 * database is never searched — and the model, with no grounding either way,
 * has been observed to answer "I couldn't find any … in our database" about
 * rows that are sitting right there. That is the fabrication risk in its
 * quieter form: not invented companies, but an invented search result.
 *
 * Extracted from the route so both halves are unit-testable without a request.
 */

/** Unambiguous "give me listings" verbs. These always mean a search. */
const STRONG_SEARCH =
  /\b(find|search|show|list|browse|recommend|recommendations|looking for|available|open|openings)\b/

/**
 * Note there is no separate "ambiguous verb" test any more. `match`, `suit`
 * and `fit` mean a search in "what internships match a React developer" and
 * something else entirely in "is this role a good fit for me" — the two are
 * separated by the demonstrative and definitional guards below, not by the
 * verb, which was never the part carrying the distinction.
 */

/** Nouns naming the thing being looked for. */
const OPPORTUNITY_NOUN =
  /\b(internship|internships|job|jobs|hackathon|hackathons|scholarship|scholarships|competition|competitions|workshop|workshops|opportunity|opportunities|opening|openings|position|positions|role|roles)\b/

/**
 * Phrasings that ask to be taught something rather than shown listings.
 * Checked only when no STRONG_SEARCH verb is present, so "how do I find
 * internships" is still a search.
 */
const DEFINITIONAL =
  /(\bwhat (is|are|was|were)\b|\bwhat's\b|\bhow (do|does|did|should|can|could|to)\b|\bwhy\b|\bexplain\b|\btell me about\b|\bdifference between\b|\bshould i\b)/

/**
 * A demonstrative points at one specific thing the user is already looking at,
 * so it is a question about that thing, not a request to list others.
 */
const DEMONSTRATIVE =
  /\bthis (role|job|internship|position|opportunity|company|listing|posting)\b/

export function isOpportunityQuery(message: string): boolean {
  const lower = message.toLowerCase().trim()

  if (!OPPORTUNITY_NOUN.test(lower)) return false

  const hasStrongVerb = STRONG_SEARCH.test(lower)

  // "Is this role a good fit for me?" names a role and says "fit", but is a
  // question about one listing rather than a request for more.
  if (DEMONSTRATIVE.test(lower) && !hasStrongVerb) return false

  // "What is an internship?" / "How do I fit my resume to a job?" — teach me,
  // don't list. A strong verb overrides ("how do I find internships").
  if (DEFINITIONAL.test(lower) && !hasStrongVerb) return false

  // Everything left names an opportunity and is not asking to be taught about
  // one, so treat it as a search — whether it is verb-led ("find
  // internships"), ambiguous ("what internships match React"), or a bare noun
  // phrase like "machine learning internships in Pune", which previously fell
  // through to no search at all because it has no verb and does not open with
  // the noun.
  //
  // Erring towards searching is deliberate. An unnecessary search costs one
  // indexed query and gives the model grounding it can ignore; a missed one
  // leaves it free to assert that nothing is in the database.
  return true
}

/** Category names as stored in `opportunities.category`. */
const CATEGORY_BY_KEYWORD: [RegExp, string][] = [
  [/\binternships?\b/, 'Internship'],
  [/\bhackathons?\b/, 'Hackathon'],
  [/\bscholarships?\b/, 'Scholarship'],
  [/\bcompetitions?\b/, 'Competition'],
  [/\bworkshops?\b/, 'Workshop'],
  [/\b(jobs?|positions?|roles?)\b/, 'Job'],
]

/**
 * Words that carry no signal in a title/location match.
 *
 * This list is load-bearing in a way it was not before: terms are now AND-ed,
 * so a leftover "what" or "any" does not merely add noise — it excludes every
 * row. It therefore includes the question words and the search verbs
 * themselves, both of which used to survive into the query ("what internships
 * match a React developer" became the term string "what match react
 * developer").
 */
const FILLER_WORDS = new Set([
  // Search verbs, including the ambiguous ones.
  'find', 'search', 'show', 'get', 'list', 'look', 'looking', 'browse',
  'recommend', 'recommendations', 'match', 'matches', 'matching', 'suit',
  'suits', 'suited', 'fit', 'fits', 'available', 'open', 'openings',
  // Question and filler words.
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'any', 'some', 'the', 'and', 'for', 'are', 'there', 'this', 'that',
  'these', 'those', 'you', 'your', 'can', 'could', 'would', 'should',
  'want', 'need', 'help', 'please', 'with', 'about', 'related', 'from',
  'have', 'has', 'had', 'been', 'was', 'were', 'will', 'near', 'into',
  'best', 'top', 'good', 'great', 'relevant', 'interesting', 'current',
  'latest', 'new', 'more', 'most', 'give', 'tell', 'know', 'anything',
  // The nouns themselves — they select the category, not the text match.
  'internship', 'internships', 'job', 'jobs', 'hackathon', 'hackathons',
  'scholarship', 'scholarships', 'competition', 'competitions',
  'workshop', 'workshops', 'opportunity', 'opportunities',
  'opening', 'position', 'positions', 'role', 'roles',
])

/** More terms than this and an AND-match is almost certainly over-constrained. */
const MAX_TERMS = 4

export interface ExtractedSearch {
  /** Meaningful terms, in order, already lowercased. */
  terms: string[]
  category: string | null
}

export function extractSearchTerms(message: string): ExtractedSearch {
  const lower = message.toLowerCase()

  let category: string | null = null
  for (const [pattern, name] of CATEGORY_BY_KEYWORD) {
    if (pattern.test(lower)) {
      category = name
      break
    }
  }

  const terms = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FILLER_WORDS.has(word))
    .slice(0, MAX_TERMS)

  return { terms, category }
}

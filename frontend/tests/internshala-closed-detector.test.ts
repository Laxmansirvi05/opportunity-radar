import { describe, it, expect } from 'vitest'
import { isInternshipClosed } from '../src/providers/opportunities/utils/internshalaClosedDetector'

describe('isInternshipClosed', () => {
  it('detects the real banner text captured from a closed Internshala posting', () => {
    const html = `
      <div class="heading_4_5 profile">
        Senior Instructor - Data Science, ML & GenAI - Internship (WFH)
      </div>
      <div class="status-inactive">
        Applications are closed for this internship. Click here to browse more internships.
      </div>
    `
    expect(isInternshipClosed(html)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isInternshipClosed('APPLICATIONS ARE CLOSED FOR THIS INTERNSHIP')).toBe(true)
  })

  it('does not flag an open posting', () => {
    const html = `
      <div class="profile_on_detail_page">Backend Development Internship</div>
      <div class="apply_now_button">Apply now</div>
      <div class="other_detail_item"><span>Apply By</span><span>12 Sep' 26</span></div>
    `
    expect(isInternshipClosed(html)).toBe(false)
  })

  it('does not false-positive on unrelated "closed" mentions', () => {
    const html = `<p>Applications close 12 Sep 2026. The office is closed on weekends.</p>`
    expect(isInternshipClosed(html)).toBe(false)
  })
})

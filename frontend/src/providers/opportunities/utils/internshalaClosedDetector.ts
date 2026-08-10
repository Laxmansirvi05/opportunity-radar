/**
 * Detects Internshala's closed-posting marker.
 *
 * Internshala does not 404 a closed internship's detail page — it returns 200
 * with this exact banner in place of the apply flow. Nothing else in the
 * pipeline noticed, so closed postings kept getting re-confirmed as live on
 * every ingestion run forever (DATA-02). Verified against the live site
 * before wiring in: 22 of 32 published Internshala rows showed this text.
 */
const CLOSED_MARKER = /applications are closed for this internship/i;

export function isInternshipClosed(detailHtml: string): boolean {
  return CLOSED_MARKER.test(detailHtml);
}

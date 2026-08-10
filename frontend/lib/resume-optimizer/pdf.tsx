import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { ParsedResume } from '@/types/resume'

/**
 * ATS-safe PDF export.
 *
 * Single column, no tables, no colour, real embedded text (not an image) — a
 * PDF a parser cannot read back defeats the entire feature. Helvetica is a
 * base-14 PDF font, so nothing needs to be embedded or fetched at render
 * time, and the layout deliberately looks plain rather than designed, per
 * the "must not look AI-generated" requirement.
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111111',
    lineHeight: 1.4,
  },
  name: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  contact: { fontSize: 9, color: '#333333', marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    borderBottom: '1pt solid #999999',
    paddingBottom: 2,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  itemTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  itemSubtitle: { fontSize: 9.5, marginBottom: 2 },
  itemMeta: { fontSize: 9, color: '#555555' },
  bullet: { fontSize: 9.5, marginBottom: 1.5, marginLeft: 10 },
  paragraph: { fontSize: 9.5, marginBottom: 2 },
  skills: { fontSize: 9.5 },
  block: { marginBottom: 6 },
})

function ContactLine({ resume }: { resume: ParsedResume }) {
  const parts = [resume.email, resume.phone, resume.linkedin, resume.github].filter(Boolean)
  if (parts.length === 0) return null
  return <Text style={styles.contact}>{parts.join('   |   ')}</Text>
}

export function ResumePdfDocument({ resume }: { resume: ParsedResume }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{resume.name}</Text>
        <ContactLine resume={resume} />

        {resume.summary && (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.paragraph}>{resume.summary}</Text>
          </View>
        )}

        {resume.experience && resume.experience.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            {resume.experience.map((exp, i) => (
              <View key={i} style={styles.block}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{exp.role}</Text>
                  <Text style={styles.itemMeta}>{exp.start_date} – {exp.end_date || 'Present'}</Text>
                </View>
                <Text style={styles.itemSubtitle}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</Text>
                {(exp.bullets ?? []).map((b, j) => (
                  <Text key={j} style={styles.bullet}>- {b}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {resume.projects && resume.projects.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Projects</Text>
            {resume.projects.map((p, i) => (
              <View key={i} style={styles.block}>
                <Text style={styles.itemTitle}>
                  {p.name}{p.technologies?.length ? ` — ${p.technologies.join(', ')}` : ''}
                </Text>
                {p.description && <Text style={styles.paragraph}>{p.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {resume.education && resume.education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {resume.education.map((ed, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{ed.institution}</Text>
                  {ed.graduation_year && <Text style={styles.itemMeta}>{ed.graduation_year}</Text>}
                </View>
                <Text style={styles.itemSubtitle}>
                  {ed.degree}{ed.field ? `, ${ed.field}` : ''}{ed.gpa ? `   •   GPA ${ed.gpa}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {resume.skills && resume.skills.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.skills}>{resume.skills.join('   •   ')}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export async function renderResumePdf(resume: ParsedResume): Promise<Buffer> {
  return renderToBuffer(<ResumePdfDocument resume={resume} />)
}

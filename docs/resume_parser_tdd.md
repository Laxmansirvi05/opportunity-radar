# Technical Design Document (TDD)
**Feature:** Resume Upload + Resume Parser + Resume Review Screen
**Stack:** Next.js 16, TypeScript, Tailwind, Supabase (PostgreSQL + Storage), Gemini 1.5 Flash

---

## SECTION 1: FEATURE OVERVIEW

**Purpose:** 
To seamlessly onboard a student's professional history into the Opportunity Radar V2 database by parsing their uploaded PDF resume via AI, while maintaining a strict human-in-the-loop review step to correct hallucinations and ensure data integrity.

**User Flow:**
1. Student Uploads Resume (PDF).
2. PDF is securely stored in Supabase Storage.
3. System extracts raw text from the PDF.
4. Gemini 1.5 Flash converts text into structured JSON.
5. Student is presented with the Resume Review Screen populated by the parsed JSON.
6. Student edits/corrects fields as needed.
7. Student clicks "Verify & Save".
8. Structured resume is committed to the database and linked to their Profile.

**Success Criteria:**
* > 90% of standard text-based PDFs parse successfully in under 15 seconds.
* The extracted JSON matches the required schema perfectly.
* The user can successfully edit all parsed fields before saving.

**Failure Criteria:**
* Parsing takes longer than 30 seconds.
* Image-only PDFs crash the system (must fallback gracefully).
* User saves hallucinatory data without review.

---

## SECTION 2: DATABASE DESIGN

**`resumes` Table Schema**

```sql
CREATE TYPE resume_status AS ENUM ('uploaded', 'parsing', 'review_required', 'verified', 'failed');

CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    parsed_data JSONB DEFAULT '{}',
    status resume_status NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    is_master BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
* `CREATE INDEX idx_resumes_user_id ON resumes(user_id);`
* `CREATE INDEX idx_resumes_status ON resumes(status);`

**Relationships:**
* A User (`profiles`) can have many `resumes`.
* `profiles` table will be updated with `primary_resume_id = resumes.id` upon status reaching `verified`.

**Workflow:**
`uploaded` -> `parsing` -> `review_required` -> (User Edits) -> `verified`.
If parsing throws an error: `uploaded` -> `parsing` -> `failed`.

---

## SECTION 3: STORAGE DESIGN

**Supabase Storage Bucket:** `resumes`

**File Naming Convention:**
`{user_id}/{uuidv4_timestamp}.pdf`
*Example:* `123e4567-e89b-12d3/a456-426614174000_1684340000.pdf`
*(Avoids using original file names to prevent injection attacks or PII leakage in URLs).*

**Security Model (RLS):**
* **Bucket Privacy:** Private (not accessible via public URL). Access requires signed URLs or direct Supabase authenticated client access.
* **Access Rules:**
    * `INSERT`: Authenticated users can only upload to their own `{user_id}/` folder.
    * `SELECT`: Authenticated users can only read their own files.
    * `DELETE`: Authenticated users can only delete their own files.

---

## SECTION 4: API DESIGN

**1. `POST /api/resume/upload`**
* **Request:** `FormData` containing the PDF `file`.
* **Processing:** Validates file size/mime type, uploads to Supabase Storage, creates `resumes` record with status `uploaded`.
* **Response:** `{ resume_id: uuid }`
* **Errors:** `400 Bad Request` (Invalid file type/size), `401 Unauthorized`.

**2. `POST /api/resume/parse`**
* **Request:** `{ resume_id: uuid }`
* **Processing:** Updates status to `parsing`. Downloads PDF into memory, extracts text using `pdf-parse` (or similar). Sends text to Gemini 1.5 Flash. Receives JSON. Updates `resumes` with `parsed_data` and status `review_required`.
* **Response:** `{ parsed_data: JSONSchema }`
* **Errors:** `422 Unprocessable Entity` (Image-only PDF / Text extraction failed), `500 Internal Server Error` (Gemini API timeout).

**3. `POST /api/resume/save`**
* **Request:** `{ resume_id: uuid, verified_data: JSONSchema }`
* **Processing:** Updates `resumes.parsed_data` with the user-verified JSON. Sets status to `verified`. Updates `profiles.primary_resume_id`.
* **Response:** `{ success: true }`
* **Errors:** `400 Bad Request` (JSON validation failed), `401 Unauthorized`.

**4. `GET /api/resume/:id`**
* **Request:** URL param `id`.
* **Response:** Returning the specific `resumes` row.

---

## SECTION 5: PARSING PIPELINE

1. **Text Extraction:** Use a fast Node.js library like `pdf-parse`. If text length < 50 characters, assume it's an image-only PDF and immediately throw a `422` error (triggering fallback).
2. **Gemini Prompt:**
   *"You are an expert resume parser. Extract the following raw text into the requested JSON schema. Be extremely accurate. Do not hallucinate. If a field is missing, leave it empty. Respond ONLY with valid JSON."*
3. **JSON Validation:** Use `zod` on the backend to validate the Gemini output before returning it to the client. If `zod` parsing fails, retry the LLM call exactly once.
4. **Retry Logic:** 1 automatic retry on LLM failure or schema mismatch.
5. **Fallback Logic:** If parsing completely fails (or is an image PDF), redirect the user to a manual entry form with the message: *"We couldn't read your PDF automatically. Please enter your details below."*

---

## SECTION 6: RESUME JSON SCHEMA

*(Strict Zod Schema enforced on API and UI)*

```typescript
const ResumeSchema = z.object({
  personal_info: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    linkedin_url: z.string().optional(),
    portfolio_url: z.string().optional()
  }),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    field_of_study: z.string(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    gpa: z.string().optional()
  })),
  experience: z.array(z.object({
    company: z.string(),
    role: z.string(),
    location: z.string().optional(),
    start_date: z.string(),
    end_date: z.string().optional(),
    is_current: z.boolean(),
    bullets: z.array(z.string())
  })),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    url: z.string().optional(),
    technologies: z.array(z.string())
  })),
  skills: z.array(z.string()),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string(),
    date_issued: z.string().optional()
  }))
});
```

---

## SECTION 7: UI DESIGN

**1. Upload Screen**
* **Components:** Drag-and-drop zone, "Browse Files" button, PDF icon.
* **State:** Idle, Uploading, Error.
* **Actions:** Select File -> Triggers `POST /api/resume/upload`.

**2. Loading Screen**
* **Components:** Skeleton loaders resembling a resume, animated progress bar.
* **State:** Triggers `POST /api/resume/parse` on mount. Polls or awaits response.
* **Actions:** Cancel parsing (abort request).

**3. Review Screen**
* **Components:** Form split into sections (Skills, Experience, Education). Editable input fields, textareas for bullets. Trash icons to delete hallucinated sections. "Add" buttons for missed sections.
* **State:** Pre-filled with `parsed_data`.
* **Actions:** "Verify & Save" -> Triggers `POST /api/resume/save`.

**4. Error/Fallback Screen**
* **Components:** Warning icon, "We couldn't read your PDF" message, "Enter manually" button.

---

## SECTION 8: SECURITY

* **File Validation:**
    * Server-side `mime-type` check (must be `application/pdf`).
    * Server-side magic number check (verify it actually is a PDF file header).
* **Size Limits:** Hard cap at 5MB via Next.js config and Supabase Storage limits.
* **Rate Limits:** Max 3 parsing requests per user per hour (prevent LLM token draining attacks).
* **RLS:** Supabase Row Level Security enforced on `resumes` table (`auth.uid() = user_id`).
* **API Auth:** All Next.js APIs use `@supabase/ssr` to verify the active JWT session before processing.

---

## SECTION 9: EDGE CASES

* **Bad/Corrupted PDF:** `pdf-parse` throws error -> Catch -> Update status to `failed` -> Show Fallback Screen.
* **Image-only PDF:** Text extraction yields < 50 chars -> Update status to `failed` -> Show Fallback Screen.
* **Large PDF (e.g., 50 pages):** Next.js route drops payload if > 5MB. If < 5MB but massive text, truncate text to first 10,000 characters before sending to Gemini to avoid context window blowouts.
* **Hallucinated Skills:** Gemini imagines a skill. Mitigated by the **Resume Review Screen** where the user deletes it.
* **Duplicate Uploads:** Check if `resumes` table has an existing active parsing job for the `user_id` before starting a new one.

---

## SECTION 10: IMPLEMENTATION ORDER

**Estimated Total Effort:** 2 Weeks (Small Team)

1. **Step 1: Database & Storage (Days 1-2)**
    * Execute SQL migrations for `resumes` table, enums, and RLS policies.
    * Create Supabase Storage `resumes` bucket with strict RLS.
    * Add `primary_resume_id` to `profiles`.
2. **Step 2: File Upload Pipeline (Days 3-4)**
    * Build the Drag-and-Drop UI Component.
    * Implement `POST /api/resume/upload`.
    * Wire UI to handle uploading state and Supabase upload.
3. **Step 3: Parsing Backend (Days 5-7)**
    * Install text extraction library (`pdf-parse`).
    * Implement `POST /api/resume/parse`.
    * Build Gemini 1.5 Flash prompt and Zod schema validation.
    * Implement Error/Fallback handlers.
4. **Step 4: Resume Review UI (Days 8-11)**
    * Build the editable Resume Review form using `react-hook-form` and `zod` resolver matching the exact schema.
    * Pre-populate form with Gemini output.
5. **Step 5: Finalization & Save (Days 12-14)**
    * Implement `POST /api/resume/save`.
    * Wire "Verify & Save" button to update database.
    * End-to-end testing with edge-case PDFs.

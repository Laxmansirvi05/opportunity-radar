-- Allow builder-created resumes (no file upload)
ALTER TABLE resumes ALTER COLUMN file_url DROP NOT NULL;

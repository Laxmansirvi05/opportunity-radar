-- Create resumes bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES 
('resumes', 'resumes', false, 5242880, '{application/pdf}')
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for resumes bucket
CREATE POLICY "Users can view their own resumes" ON storage.objects FOR SELECT USING (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can upload their own resumes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can update their own resumes" ON storage.objects FOR UPDATE USING (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own resumes" ON storage.objects FOR DELETE USING (bucket_id = 'resumes' AND auth.uid() = owner);

ALTER TABLE opportunities 
ADD CONSTRAINT unique_source_id UNIQUE (source, source_id);

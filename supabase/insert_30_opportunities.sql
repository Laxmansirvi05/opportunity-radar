-- Production-safe script to insert 30 additional opportunities
-- Requirements fulfilled:
-- 1. Do NOT modify schema.
-- 2. Do NOT drop tables.
-- 3. Do NOT truncate tables.
-- 4. Do NOT delete existing records.
-- 5. Keep existing Google opportunity.

INSERT INTO opportunities (title, category, company_id, description, apply_url, location, mode, is_paid, experience_level, status, source_type)
VALUES
-- Google Opportunities (10)
('Software Engineering Intern', 'Internship', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Join Google as a Software Engineering Intern for the summer.', 'https://careers.google.com/jobs/results/1001', 'Mountain View, CA', 'Hybrid', TRUE, 'Undergrad', 'Published', 'Verified'),
('Frontend Developer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Build next-generation web applications using modern web technologies.', 'https://careers.google.com/jobs/results/1002', 'Remote', 'Remote', TRUE, 'Fresher', 'Published', 'Verified'),
('Google Cloud Hackathon', 'Hackathon', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Compete to build the best cloud-native application on GCP.', 'https://cloud.google.com/hackathon/1003', 'Online', 'Remote', FALSE, 'Undergrad', 'Published', 'Verified'),
('AI Research Scientist', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Push the boundaries of Artificial Intelligence and Machine Learning.', 'https://careers.google.com/jobs/results/1004', 'London, UK', 'Onsite', TRUE, 'Masters', 'Published', 'Verified'),
('Cloud Computing Workshop', 'Workshop', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Learn the basics of Google Cloud Platform with hands-on labs.', 'https://events.google.com/1005', 'San Francisco, CA', 'Hybrid', FALSE, 'Fresher', 'Published', 'Verified'),
('Women Techmakers Scholarship', 'Scholarship', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Financial and community support for women in technology.', 'https://buildyourfuture.withgoogle.com/scholarships/1006', 'Global', 'Remote', TRUE, 'Undergrad', 'Published', 'Verified'),
('Backend Developer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Design scalable backend systems for millions of users.', 'https://careers.google.com/jobs/results/1007', 'New York, NY', 'Hybrid', TRUE, 'Fresher', 'Published', 'Verified'),
('Product Management Intern', 'Internship', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Help drive product vision, strategy, and execution.', 'https://careers.google.com/jobs/results/1008', 'Zurich, Switzerland', 'Onsite', TRUE, 'Undergrad', 'Published', 'Verified'),
('Machine Learning Engineer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Apply machine learning models to solve real-world problems.', 'https://careers.google.com/jobs/results/1009', 'Seattle, WA', 'Hybrid', TRUE, 'Masters', 'Published', 'Verified'),
('Android Development Workshop', 'Workshop', (SELECT id FROM companies WHERE name ILIKE '%Google%' LIMIT 1), 'Hands-on workshop for modern Android app development.', 'https://events.google.com/1010', 'Online', 'Remote', FALSE, 'Undergrad', 'Published', 'Verified'),

-- Microsoft Opportunities (10)
('Explore Microsoft Intern', 'Internship', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Rotational internship program for early college students.', 'https://careers.microsoft.com/jobs/2001', 'Redmond, WA', 'Hybrid', TRUE, 'Undergrad', 'Published', 'Verified'),
('Software Engineer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Join the core Windows engineering team to build scalable OS features.', 'https://careers.microsoft.com/jobs/2002', 'Remote', 'Remote', TRUE, 'Fresher', 'Published', 'Verified'),
('Imagine Cup Hackathon', 'Hackathon', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Global student developer competition using AI technologies.', 'https://imaginecup.microsoft.com/2003', 'Online', 'Remote', FALSE, 'Undergrad', 'Published', 'Verified'),
('Data Scientist', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Extract insights from massive datasets to drive business logic.', 'https://careers.microsoft.com/jobs/2004', 'Cambridge, MA', 'Onsite', TRUE, 'Masters', 'Published', 'Verified'),
('Azure Fundamentals Workshop', 'Workshop', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Introduction to Microsoft Azure services and cloud computing.', 'https://events.microsoft.com/2005', 'Austin, TX', 'Hybrid', FALSE, 'Fresher', 'Published', 'Verified'),
('Microsoft Tuition Scholarship', 'Scholarship', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Financial support for underrepresented computer science students.', 'https://careers.microsoft.com/students/scholarships/2006', 'Global', 'Remote', TRUE, 'Undergrad', 'Published', 'Verified'),
('Full Stack Developer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Work on cutting-edge web technologies and modern architectures.', 'https://careers.microsoft.com/jobs/2007', 'Seattle, WA', 'Hybrid', TRUE, 'Fresher', 'Published', 'Verified'),
('PM Intern', 'Internship', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Shape the future of Microsoft products and interact with cross-functional teams.', 'https://careers.microsoft.com/jobs/2008', 'Sunnyvale, CA', 'Onsite', TRUE, 'Undergrad', 'Published', 'Verified'),
('AI Engineer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Integrate generative AI into everyday applications.', 'https://careers.microsoft.com/jobs/2009', 'Remote', 'Remote', TRUE, 'Masters', 'Published', 'Verified'),
('.NET Development Workshop', 'Workshop', (SELECT id FROM companies WHERE name ILIKE '%Microsoft%' LIMIT 1), 'Deep dive into the .NET ecosystem and C# fundamentals.', 'https://events.microsoft.com/2010', 'Online', 'Remote', FALSE, 'Fresher', 'Published', 'Verified'),

-- Amazon Opportunities (10)
('SDE Intern', 'Internship', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Summer software development internship building production services.', 'https://amazon.jobs/en/jobs/3001', 'Seattle, WA', 'Hybrid', TRUE, 'Undergrad', 'Published', 'Verified'),
('SDE I', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Entry-level software development engineer for core retail services.', 'https://amazon.jobs/en/jobs/3002', 'Remote', 'Remote', TRUE, 'Fresher', 'Published', 'Verified'),
('AWS DeepRacer Hackathon', 'Hackathon', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Build and train reinforcement learning models for autonomous racing.', 'https://aws.amazon.com/deepracer/3003', 'Online', 'Remote', FALSE, 'Masters', 'Published', 'Verified'),
('Applied Scientist', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Research and develop advanced algorithms for optimization.', 'https://amazon.jobs/en/jobs/3004', 'Palo Alto, CA', 'Onsite', TRUE, 'Masters', 'Published', 'Verified'),
('AWS Cloud Workshop', 'Workshop', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Practical guide to AWS architecture and serverless computing.', 'https://aws.amazon.com/events/3005', 'Arlington, VA', 'Hybrid', FALSE, 'Fresher', 'Published', 'Verified'),
('Amazon Future Engineer Scholarship', 'Scholarship', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Empowering the next generation of engineers with financial aid.', 'https://www.amazonfutureengineer.com/scholarships/3006', 'National', 'Remote', TRUE, 'Undergrad', 'Published', 'Verified'),
('Cloud Support Associate', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Help enterprise customers build and maintain scalable systems.', 'https://amazon.jobs/en/jobs/3007', 'Dallas, TX', 'Hybrid', TRUE, 'Fresher', 'Published', 'Verified'),
('Business Analyst Intern', 'Internship', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Analyze complex data sets to drive business decisions.', 'https://amazon.jobs/en/jobs/3008', 'Boston, MA', 'Onsite', TRUE, 'Undergrad', 'Published', 'Verified'),
('Data Engineer', 'Job', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Design and maintain big data pipelines for analytics.', 'https://amazon.jobs/en/jobs/3009', 'Remote', 'Remote', TRUE, 'Masters', 'Published', 'Verified'),
('E-commerce Hackathon', 'Hackathon', (SELECT id FROM companies WHERE name ILIKE '%Amazon%' LIMIT 1), 'Innovate the future of online shopping experiences.', 'https://amazon.jobs/en/events/3010', 'Online', 'Remote', FALSE, 'Undergrad', 'Published', 'Verified')

ON CONFLICT (apply_url) DO NOTHING;

-- Verification Step
SELECT COUNT(*) FROM opportunities;

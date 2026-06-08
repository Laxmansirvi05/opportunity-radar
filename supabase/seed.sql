-- Seed file for Opportunity Radar

-- Clear existing data if necessary (to prevent uniqueness errors on re-seeding)
TRUNCATE TABLE public.companies CASCADE;

-- Insert 10 Companies
INSERT INTO public.companies (id, name, website_url, careers_url, industry, logo_url, description, headquarters, founded_year) VALUES
('11111111-1111-1111-1111-111111111111', 'Google', 'https://google.com', 'https://careers.google.com', 'Technology', 'https://logo.clearbit.com/google.com', 'Google specializes in Internet-related services and products, which include online advertising technologies, search engine, cloud computing, software, and hardware.', 'Mountain View, CA', 1998),
('22222222-2222-2222-2222-222222222222', 'Microsoft', 'https://microsoft.com', 'https://careers.microsoft.com', 'Technology', 'https://logo.clearbit.com/microsoft.com', 'Microsoft enables digital transformation for the era of an intelligent cloud and an intelligent edge. Its mission is to empower every person and every organization on the planet to achieve more.', 'Redmond, WA', 1975),
('33333333-3333-3333-3333-333333333333', 'OpenAI', 'https://openai.com', 'https://openai.com/careers', 'Artificial Intelligence', 'https://logo.clearbit.com/openai.com', 'OpenAI is an AI research and deployment company dedicated to ensuring that artificial general intelligence benefits all of humanity.', 'San Francisco, CA', 2015),
('44444444-4444-4444-4444-444444444444', 'Stripe', 'https://stripe.com', 'https://stripe.com/jobs', 'Financial Services', 'https://logo.clearbit.com/stripe.com', 'Stripe is a financial infrastructure platform for the internet. Millions of companies—from the world’s largest enterprises to the most ambitious startups—use Stripe to accept payments, grow their revenue, and accelerate new business opportunities.', 'San Francisco, CA', 2010),
('55555555-5555-5555-5555-555555555555', 'Vercel', 'https://vercel.com', 'https://vercel.com/careers', 'Cloud Computing', 'https://logo.clearbit.com/vercel.com', 'Vercel is the platform for frontend developers, providing the speed and reliability needed to create at the moment of inspiration.', 'San Francisco, CA', 2015),
('66666666-6666-6666-6666-666666666666', 'Figma', 'https://figma.com', 'https://figma.com/careers', 'Design Software', 'https://logo.clearbit.com/figma.com', 'Figma is a design platform for teams who build products together. Born on the Web, Figma helps teams brainstorm, design, and build better products—from start to finish.', 'San Francisco, CA', 2012),
('77777777-7777-7777-7777-777777777777', 'GitHub', 'https://github.com', 'https://github.com/about/careers', 'Software Development', 'https://logo.clearbit.com/github.com', 'GitHub is the complete developer platform to build, scale, and deliver secure software. Over 100 million people, including developers from 90 of the Fortune 100 companies, use GitHub to build amazing things together.', 'San Francisco, CA', 2008),
('88888888-8888-8888-8888-888888888888', 'Notion', 'https://notion.so', 'https://notion.so/careers', 'Productivity', 'https://logo.clearbit.com/notion.so', 'Notion is the connected workspace where better, faster work happens. Now with AI.', 'San Francisco, CA', 2016),
('99999999-9999-9999-9999-999999999999', 'Supabase', 'https://supabase.com', 'https://supabase.com/careers', 'Developer Tools', 'https://logo.clearbit.com/supabase.com', 'Supabase is an open source Firebase alternative. Start your project with a Postgres database, Authentication, instant APIs, Edge Functions, Realtime subscriptions, Storage, and Vector embeddings.', 'Remote', 2020),
('00000000-0000-0000-0000-000000000000', 'Meta', 'https://meta.com', 'https://metacareers.com', 'Technology', 'https://logo.clearbit.com/meta.com', 'Meta builds technologies that help people connect, find communities, and grow businesses. When Facebook launched in 2004, it changed the way people connect.', 'Menlo Park, CA', 2004);

-- Insert 30 Opportunities
INSERT INTO public.opportunities (title, category, company_id, description, apply_url, location, mode, is_paid, experience_level, posted_at, deadline, status, source_type) VALUES

-- Internships (10)
('Software Engineering Intern, Summer 2027', 'Internship', '11111111-1111-1111-1111-111111111111', 'Join our core engineering team for a 12-week immersive summer internship.', 'https://careers.google.com/intern/swe/2027', 'Mountain View, CA', 'Hybrid', TRUE, 'Undergrad', NOW() - INTERVAL '2 days', NOW() + INTERVAL '30 days', 'Published', 'Verified'),
('Data Science Intern', 'Internship', '22222222-2222-2222-2222-222222222222', 'Work with massive datasets to improve Azure infrastructure.', 'https://careers.microsoft.com/intern/data', 'Seattle, WA', 'Hybrid', TRUE, 'Undergrad', NOW() - INTERVAL '5 days', NOW() + INTERVAL '45 days', 'Published', 'Verified'),
('AI Research Intern', 'Internship', '33333333-3333-3333-3333-333333333333', 'Collaborate on cutting edge frontier models.', 'https://openai.com/careers/ai-intern', 'San Francisco, CA', 'Onsite', TRUE, 'Masters', NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days', 'Closing Soon', 'Verified'),
('Frontend Engineering Intern', 'Internship', '55555555-5555-5555-5555-555555555555', 'Help us build the next generation of Next.js tooling.', 'https://vercel.com/careers/frontend-intern', 'Remote', 'Remote', TRUE, 'Undergrad', NOW() - INTERVAL '10 days', NOW() + INTERVAL '60 days', 'Published', 'Verified'),
('Design Intern, Product', 'Internship', '66666666-6666-6666-6666-666666666666', 'Shape the future of collaborative design.', 'https://figma.com/careers/design-intern', 'New York, NY', 'Hybrid', TRUE, 'Undergrad', NOW() - INTERVAL '3 days', NOW() + INTERVAL '20 days', 'Published', 'Verified'),
('Backend Engineer Intern', 'Internship', '44444444-4444-4444-4444-444444444444', 'Scale financial APIs to handle millions of transactions.', 'https://stripe.com/jobs/backend-intern', 'Remote', 'Remote', TRUE, 'Masters', NOW() - INTERVAL '7 days', NOW() + INTERVAL '30 days', 'Published', 'Verified'),
('Security Research Intern', 'Internship', '77777777-7777-7777-7777-777777777777', 'Analyze vulnerabilities at scale across open source repositories.', 'https://github.com/careers/security-intern', 'Remote', 'Remote', TRUE, 'Undergrad', NOW() - INTERVAL '4 days', NOW() + INTERVAL '25 days', 'Published', 'Verified'),
('Product Management Intern', 'Internship', '88888888-8888-8888-8888-888888888888', 'Lead a core feature pod from ideation to launch.', 'https://notion.so/careers/pm-intern', 'San Francisco, CA', 'Hybrid', TRUE, 'Undergrad', NOW() - INTERVAL '15 days', NOW() + INTERVAL '10 days', 'Closing Soon', 'Verified'),
('Developer Advocacy Intern', 'Internship', '99999999-9999-9999-9999-999999999999', 'Create engaging technical content and help developers build cool things.', 'https://supabase.com/careers/devrel-intern', 'Remote', 'Remote', TRUE, 'Any', NOW() - INTERVAL '1 day', NOW() + INTERVAL '45 days', 'Published', 'Verified'),
('AR/VR Engineering Intern', 'Internship', '00000000-0000-0000-0000-000000000000', 'Work on Reality Labs hardware and software prototypes.', 'https://metacareers.com/arvr-intern', 'Menlo Park, CA', 'Onsite', TRUE, 'Masters', NOW() - INTERVAL '2 days', NOW() + INTERVAL '60 days', 'Published', 'Verified'),

-- Jobs (8)
('Junior Full Stack Engineer', 'Job', '55555555-5555-5555-5555-555555555555', 'Build and maintain core infrastructure for our edge network.', 'https://vercel.com/careers/fullstack-eng', 'Remote', 'Remote', TRUE, 'Fresher', NOW() - INTERVAL '5 days', NOW() + INTERVAL '30 days', 'Published', 'Verified'),
('New Grad Software Engineer', 'Job', '11111111-1111-1111-1111-111111111111', 'Entry level position for recent university graduates.', 'https://careers.google.com/newgrad', 'Austin, TX', 'Hybrid', TRUE, 'Fresher', NOW() - INTERVAL '10 days', NOW() + INTERVAL '60 days', 'Published', 'Verified'),
('Postgres Database Engineer', 'Job', '99999999-9999-9999-9999-999999999999', 'Help scale our managed Postgres offering.', 'https://supabase.com/careers/postgres-eng', 'Remote', 'Remote', TRUE, 'Any', NOW() - INTERVAL '2 days', NULL, 'Published', 'Verified'),
('Machine Learning Engineer', 'Job', '33333333-3333-3333-3333-333333333333', 'Train and deploy large language models.', 'https://openai.com/careers/ml-eng', 'San Francisco, CA', 'Onsite', TRUE, 'Masters', NOW() - INTERVAL '7 days', NULL, 'Published', 'Verified'),
('Product Designer', 'Job', '66666666-6666-6666-6666-666666666666', 'Design intuitive interfaces for creative professionals.', 'https://figma.com/careers/product-designer', 'Remote', 'Remote', TRUE, 'Any', NOW() - INTERVAL '4 days', NULL, 'Published', 'Verified'),
('Technical Support Engineer', 'Job', '44444444-4444-4444-4444-444444444444', 'Assist top tier merchants with integration challenges.', 'https://stripe.com/jobs/support', 'New York, NY', 'Hybrid', TRUE, 'Fresher', NOW() - INTERVAL '1 day', NOW() + INTERVAL '20 days', 'Published', 'Verified'),
('DevOps Engineer', 'Job', '77777777-7777-7777-7777-777777777777', 'Improve developer velocity and CI/CD reliability.', 'https://github.com/careers/devops', 'Remote', 'Remote', TRUE, 'Any', NOW() - INTERVAL '12 days', NULL, 'Published', 'Verified'),
('Growth Marketing Manager', 'Job', '88888888-8888-8888-8888-888888888888', 'Drive user acquisition and product adoption campaigns.', 'https://notion.so/careers/growth', 'San Francisco, CA', 'Hybrid', TRUE, 'Any', NOW() - INTERVAL '3 days', NULL, 'Published', 'Verified'),

-- Hackathons (4)
('Global AI Hackathon 2026', 'Hackathon', '33333333-3333-3333-3333-333333333333', 'Build the next breakout AI application. $100k prize pool.', 'https://openai.com/hackathon-2026', 'Remote', 'Remote', FALSE, 'Any', NOW() - INTERVAL '2 days', NOW() + INTERVAL '10 days', 'Closing Soon', 'Verified'),
('Stripe Payment Innovation Challenge', 'Hackathon', '44444444-4444-4444-4444-444444444444', 'Reinvent online commerce and checkout flows.', 'https://stripe.com/hackathon', 'New York, NY', 'Onsite', FALSE, 'Any', NOW() - INTERVAL '5 days', NOW() + INTERVAL '30 days', 'Published', 'Verified'),
('Next.js Open Source Jam', 'Hackathon', '55555555-5555-5555-5555-555555555555', 'Contribute to the Next.js ecosystem. Swag for all participants.', 'https://vercel.com/jam', 'Remote', 'Remote', FALSE, 'Any', NOW() - INTERVAL '1 day', NOW() + INTERVAL '15 days', 'Published', 'Verified'),
('Meta AR Creator Challenge', 'Hackathon', '00000000-0000-0000-0000-000000000000', 'Build immersive AR filters and effects.', 'https://metacareers.com/ar-challenge', 'Remote', 'Remote', FALSE, 'Any', NOW() - INTERVAL '8 days', NOW() + INTERVAL '25 days', 'Published', 'Verified'),

-- Workshops (4)
('Introduction to Cloud Computing', 'Workshop', '22222222-2222-2222-2222-222222222222', 'Learn the basics of Azure and cloud architecture.', 'https://microsoft.com/workshop/cloud', 'Remote', 'Remote', FALSE, 'Undergrad', NOW() - INTERVAL '3 days', NOW() + INTERVAL '5 days', 'Closing Soon', 'Verified'),
('Mastering Collaborative Design', 'Workshop', '66666666-6666-6666-6666-666666666666', 'Advanced Figma techniques for design systems.', 'https://figma.com/workshop/design', 'San Francisco, CA', 'Hybrid', FALSE, 'Any', NOW() - INTERVAL '7 days', NOW() + INTERVAL '14 days', 'Published', 'Verified'),
('GitHub Actions Deep Dive', 'Workshop', '77777777-7777-7777-7777-777777777777', 'Automate your workflows entirely in GitHub.', 'https://github.com/workshop/actions', 'Remote', 'Remote', FALSE, 'Any', NOW() - INTERVAL '1 day', NOW() + INTERVAL '20 days', 'Published', 'Verified'),
('Building with Supabase', 'Workshop', '99999999-9999-9999-9999-999999999999', 'From zero to full-stack application in 2 hours.', 'https://supabase.com/workshop', 'Remote', 'Remote', FALSE, 'Any', NOW() - INTERVAL '4 days', NOW() + INTERVAL '30 days', 'Published', 'Verified'),

-- Scholarships (3)
('Women in Tech Scholarship', 'Scholarship', '11111111-1111-1111-1111-111111111111', '$10,000 academic scholarship for women pursuing computer science.', 'https://buildyourfuture.withgoogle.com/scholarships', 'Remote', 'Remote', TRUE, 'Undergrad', NOW() - INTERVAL '10 days', NOW() + INTERVAL '60 days', 'Published', 'Verified'),
('Open Source Grant', 'Scholarship', '77777777-7777-7777-7777-777777777777', 'Funding for students actively maintaining open source projects.', 'https://github.com/scholarship/oss', 'Remote', 'Remote', TRUE, 'Any', NOW() - INTERVAL '5 days', NOW() + INTERVAL '45 days', 'Published', 'Verified'),
('AI Ethics Fellowship', 'Scholarship', '33333333-3333-3333-3333-333333333333', 'Full tuition coverage and research grant for AI ethics.', 'https://openai.com/fellowship', 'Remote', 'Remote', TRUE, 'Masters', NOW() - INTERVAL '1 day', NOW() + INTERVAL '20 days', 'Published', 'Verified'),

-- Competitions (1)
('Competitive Programming Championship', 'Competition', '11111111-1111-1111-1111-111111111111', 'Solve algorithmic puzzles and win a trip to Google HQ.', 'https://codingcompetitions.withgoogle.com/', 'Remote', 'Remote', FALSE, 'Any', NOW() - INTERVAL '15 days', NOW() + INTERVAL '5 days', 'Closing Soon', 'Verified');

-- Insert Some Tags
INSERT INTO public.opportunity_tags (opportunity_id, tag_name) 
SELECT id, 'React' FROM public.opportunities WHERE title ILIKE '%Frontend%' OR title ILIKE '%Full Stack%';

INSERT INTO public.opportunity_tags (opportunity_id, tag_name) 
SELECT id, 'Python' FROM public.opportunities WHERE title ILIKE '%Data%' OR title ILIKE '%Machine Learning%' OR title ILIKE '%AI%';

INSERT INTO public.opportunity_tags (opportunity_id, tag_name) 
SELECT id, 'PostgreSQL' FROM public.opportunities WHERE title ILIKE '%Backend%' OR title ILIKE '%Database%';

-- Update newly added fields with realistic demo data
UPDATE public.opportunities
SET 
  skills = CASE 
    WHEN title ILIKE '%Frontend%' OR title ILIKE '%Full Stack%' THEN ARRAY['React', 'TypeScript', 'Next.js', 'Git', 'Tailwind']
    WHEN title ILIKE '%Backend%' OR title ILIKE '%Database%' THEN ARRAY['Node.js', 'PostgreSQL', 'Docker', 'System Design', 'Redis']
    WHEN title ILIKE '%Machine Learning%' OR title ILIKE '%Data%' OR title ILIKE '%AI%' THEN ARRAY['Python', 'Machine Learning', 'TensorFlow', 'PyTorch', 'Statistics', 'SQL']
    WHEN title ILIKE '%Design%' OR title ILIKE '%AR%' THEN ARRAY['Figma', 'UI/UX', 'Prototyping', 'User Research', 'Creative Problem Solving']
    WHEN title ILIKE '%Security%' THEN ARRAY['Cryptography', 'Penetration Testing', 'Network Security', 'Python', 'C++']
    WHEN category = 'Hackathon' THEN ARRAY['Problem Solving', 'Team Collaboration', 'Presentation', 'Git', 'Cloud Basics']
    WHEN category = 'Scholarship' THEN ARRAY['Academic Excellence', 'Leadership', 'Communication', 'Community Involvement']
    WHEN title ILIKE '%Product%' OR title ILIKE '%Marketing%' THEN ARRAY['Product Strategy', 'Analytics', 'A/B Testing', 'User Empathy', 'Communication']
    ELSE ARRAY['Communication', 'Analytical Thinking', 'Teamwork', 'Fast Learner']
  END,
  responsibilities = CASE 
    WHEN category = 'Internship' THEN ARRAY['Build and ship new features under mentorship', 'Collaborate with cross-functional teams', 'Write clean, maintainable code', 'Participate in code reviews']
    WHEN category = 'Job' AND title ILIKE '%Junior%' THEN ARRAY['Implement solutions for core product areas', 'Maintain and optimize applications', 'Write technical documentation', 'Collaborate with senior engineers']
    WHEN category = 'Job' THEN ARRAY['Design scalable systems and architecture', 'Mentor junior team members', 'Lead technical initiatives', 'Ensure high availability and reliability']
    WHEN category = 'Hackathon' THEN ARRAY['Ideate and build a functional prototype', 'Submit your solution before the deadline', 'Present your demo to the judges']
    WHEN category = 'Workshop' THEN ARRAY['Engage in hands-on coding sessions', 'Complete practical exercises', 'Collaborate with other attendees']
    WHEN category = 'Scholarship' THEN ARRAY['Maintain academic eligibility', 'Submit required documentation and progress reports', 'Participate in networking events']
    WHEN category = 'Competition' THEN ARRAY['Solve complex algorithmic challenges', 'Optimize solutions for performance', 'Compete against top talent globally']
    ELSE ARRAY['Participate actively', 'Collaborate with peers', 'Deliver results']
  END,
  recruiter_name = CASE 
    WHEN company_id = '11111111-1111-1111-1111-111111111111' THEN 'Elena Rodriguez' -- Google
    WHEN company_id = '22222222-2222-2222-2222-222222222222' THEN 'Michael Chang' -- Microsoft
    WHEN company_id = '33333333-3333-3333-3333-333333333333' THEN 'Sarah Jenkins' -- OpenAI
    WHEN company_id = '44444444-4444-4444-4444-444444444444' THEN 'David Smith' -- Stripe
    WHEN company_id = '55555555-5555-5555-5555-555555555555' THEN 'Jessica Lee' -- Vercel
    WHEN company_id = '66666666-6666-6666-6666-666666666666' THEN 'Alex Johnson' -- Figma
    WHEN company_id = '77777777-7777-7777-7777-777777777777' THEN 'Chris Davis' -- GitHub
    WHEN company_id = '88888888-8888-8888-8888-888888888888' THEN 'Amanda Taylor' -- Notion
    WHEN company_id = '99999999-9999-9999-9999-999999999999' THEN 'Robert Wilson' -- Supabase
    WHEN company_id = '00000000-0000-0000-0000-000000000000' THEN 'Emily Moore' -- Meta
    ELSE 'Recruiter information unavailable'
  END,
  recruiter_role = CASE
    WHEN category = 'Internship' THEN 'University Recruiting Lead'
    WHEN category = 'Job' THEN 'Senior Technical Recruiter'
    WHEN category = 'Hackathon' OR category = 'Competition' THEN 'Developer Relations'
    WHEN category = 'Scholarship' THEN 'Program Manager'
    ELSE 'Talent Acquisition'
  END,
  recruiter_avatar_url = 'https://i.pravatar.cc/150?u=' || id,
  trust_score = CASE
    WHEN company_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') THEN 99
    WHEN company_id IN ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333') THEN 98
    ELSE floor(random() * 10 + 85)::int
  END,
  last_verified_at = NOW() - (random() * interval '2 days');


-- Production DB Skills Update Script
-- Run this in your Supabase SQL Editor to assign role-specific skills

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS skills jsonb;

UPDATE opportunities SET skills = '["React","Next.js"]'::jsonb WHERE id = '92e149c6-861e-4ac5-8bad-d24bd3067fb6'; -- Extracted: React, Next.js
UPDATE opportunities SET skills = '["GCP"]'::jsonb WHERE id = 'dc19938d-06d8-4e0a-ad49-06485ff04a3a'; -- Extracted: GCP
UPDATE opportunities SET skills = '["Machine Learning"]'::jsonb WHERE id = '8a4c0adf-0df0-4db7-b6e0-fcdbfbd20b40'; -- Extracted: Machine Learning
UPDATE opportunities SET skills = '["Product Management"]'::jsonb WHERE id = 'e86e6a26-bd8d-45bc-aa86-f59d2dd03899'; -- Extracted: Product Management
UPDATE opportunities SET skills = '["Machine Learning"]'::jsonb WHERE id = '30d1a5d8-3e05-4624-af86-0f6b0307bd9b'; -- Extracted: Machine Learning
UPDATE opportunities SET skills = '["Android"]'::jsonb WHERE id = '4d4bfc5d-9359-4569-8f50-797b8f2b477a'; -- Extracted: Android
UPDATE opportunities SET skills = '["Azure"]'::jsonb WHERE id = '0d18955b-2aac-4f56-bfb7-3009bbc3948f'; -- Extracted: Azure
UPDATE opportunities SET skills = '["AWS"]'::jsonb WHERE id = '9ae7ee41-dfd5-4948-b5d9-5dd2d6f1351a'; -- Extracted: AWS
UPDATE opportunities SET skills = '["AWS"]'::jsonb WHERE id = '7e74208f-b93e-482b-96b2-00408275c401'; -- Extracted: AWS
UPDATE opportunities SET skills = '["Machine Learning"]'::jsonb WHERE id = '48b5fd10-f3f5-4f89-9a2a-a12948440bc7'; -- Extracted: Machine Learning
UPDATE opportunities SET skills = '["React","TypeScript","Python","Go"]'::jsonb WHERE id = '8bc15c1c-0b6c-45d1-833c-cfdca18e10ef'; -- Extracted: React, TypeScript, Python, Go
UPDATE opportunities SET skills = '["Canva","Node.js","MongoDB","Python","SQL"]'::jsonb WHERE id = '3aee7cea-d444-4dfa-ab95-348d004f2446'; -- Extracted: Canva, Node.js, MongoDB, Python, SQL
UPDATE opportunities SET skills = '["A/B Testing"]'::jsonb WHERE id = 'ba95fb7f-6d6f-479d-a27d-e296c96cad08'; -- Extracted: A/B Testing
UPDATE opportunities SET skills = '["Python"]'::jsonb WHERE id = '88717ade-92ac-45fb-8301-356e4c671c12'; -- Extracted: Python
UPDATE opportunities SET skills = '["Figma","Photoshop","Illustrator","Canva","InDesign"]'::jsonb WHERE id = '5ccf0203-69c7-4d1f-a483-44ac8ed9b2f2'; -- Extracted: Figma, Photoshop, Illustrator, Canva, InDesign
UPDATE opportunities SET skills = '["AWS"]'::jsonb WHERE id = '9dd13128-c547-4bf7-9d73-a0478e8af053'; -- Extracted: AWS
UPDATE opportunities SET skills = '["SQL","Tableau"]'::jsonb WHERE id = '57693d68-333a-492e-8827-c79a0edafe98'; -- Extracted: SQL, Tableau
UPDATE opportunities SET skills = '["HTML","CSS","JavaScript"]'::jsonb WHERE id = '1aa288c9-366f-4846-a7a1-f96889aeaffe'; -- Extracted: HTML, CSS, JavaScript
UPDATE opportunities SET skills = '["Python"]'::jsonb WHERE id = 'a0f85057-d87c-4272-b6c1-10929382097e'; -- Extracted: Python
UPDATE opportunities SET skills = '["Python"]'::jsonb WHERE id = '95b534cf-aa7a-46c0-b14d-beed6c410564'; -- Extracted: Python
UPDATE opportunities SET skills = '["Python","SQL","Tableau","Power BI"]'::jsonb WHERE id = 'a81087e3-4e18-428c-af20-e52c25e06ae1'; -- Extracted: Python, SQL, Tableau, Power BI
UPDATE opportunities SET skills = '["UI/UX","React","Next.js","JavaScript","Git","AWS","Docker"]'::jsonb WHERE id = '01e19f2c-a7c4-4527-a43b-bb68851ed854'; -- Extracted: UI/UX, React, Next.js, JavaScript, Git, AWS, Docker
UPDATE opportunities SET skills = '["Photoshop","Illustrator","Canva"]'::jsonb WHERE id = 'ade377ef-70c7-472e-b385-6399d2571494'; -- Extracted: Photoshop, Illustrator, Canva
UPDATE opportunities SET skills = '["Canva"]'::jsonb WHERE id = 'f560ad29-87ad-4416-82fd-24c5a862f225'; -- Extracted: Canva
UPDATE opportunities SET skills = '["SQL"]'::jsonb WHERE id = '9a8e175a-e4cb-470d-a61c-736f7480c376'; -- Extracted: SQL
UPDATE opportunities SET skills = '["Canva"]'::jsonb WHERE id = '4266b2b2-6a13-4e5d-8bb1-9cb7094390c6'; -- Extracted: Canva
UPDATE opportunities SET skills = '["React","TypeScript","Next.js","JavaScript","Node.js","Docker","AWS","Python","SQL","GCP","Azure","CI/CD","Git"]'::jsonb WHERE id = '6a605fdc-2c6f-465f-bcef-9d8c98522606'; -- Extracted: React, TypeScript, Next.js, JavaScript, Node.js, Docker, AWS, Python, SQL, GCP, Azure, CI/CD, Git
UPDATE opportunities SET skills = '["Data Analysis"]'::jsonb WHERE id = '887de458-9092-4afd-93fd-2c90a89a3f21'; -- Extracted: Data Analysis
UPDATE opportunities SET skills = '["TypeScript","JavaScript","Node.js","Express","MongoDB","Git"]'::jsonb WHERE id = 'db8fe955-d606-4326-895f-bca9bf0c7f1d'; -- Extracted: TypeScript, JavaScript, Node.js, Express, MongoDB, Git
UPDATE opportunities SET skills = '["AWS","Python"]'::jsonb WHERE id = '0929f08b-ec44-4872-aef2-9d6c4a9b854c'; -- Extracted: AWS, Python
UPDATE opportunities SET skills = '["HTML","CSS","JavaScript"]'::jsonb WHERE id = '6911a2d1-cc4e-4685-8574-9cb41550dc34'; -- Extracted: HTML, CSS, JavaScript
UPDATE opportunities SET skills = '["SQL","Data Analysis","Power BI"]'::jsonb WHERE id = 'dbc2eea5-40cd-41ca-bfb2-10a35c64c42f'; -- Extracted: SQL, Data Analysis, Power BI
UPDATE opportunities SET skills = '["Canva"]'::jsonb WHERE id = '9cf5a645-49b1-42b5-9a51-6014e078deb7'; -- Extracted: Canva
UPDATE opportunities SET skills = '["MongoDB"]'::jsonb WHERE id = '5df24efc-966a-495c-8a0c-a3b5d6a1e820'; -- Extracted: MongoDB
UPDATE opportunities SET skills = '["UI/UX","React","React Native","Git"]'::jsonb WHERE id = '8c403007-c83e-43d9-bbcc-a0d8f0e10d40'; -- Extracted: UI/UX, React, React Native, Git
UPDATE opportunities SET skills = '["Canva"]'::jsonb WHERE id = 'c36efddd-a9ef-4d26-82b8-7f00247dabea'; -- Extracted: Canva
UPDATE opportunities SET skills = '["Java","Spring Boot"]'::jsonb WHERE id = 'fd022889-7672-4f4c-af2d-f1552b37a506'; -- Extracted: Java, Spring Boot
UPDATE opportunities SET skills = '["Photoshop","Illustrator","InDesign"]'::jsonb WHERE id = 'cc1642ba-e63d-4153-be9d-864c7edae9d6'; -- Extracted: Photoshop, Illustrator, InDesign
UPDATE opportunities SET skills = '["React"]'::jsonb WHERE id = '3b51147f-308d-4557-8cba-52305c238a19'; -- Extracted: React
UPDATE opportunities SET skills = '["Figma"]'::jsonb WHERE id = '5b03b9eb-2346-4621-afd1-b83ecfe43a9e'; -- Extracted: Figma
UPDATE opportunities SET skills = '["React","TypeScript"]'::jsonb WHERE id = '2ee89e13-3b3c-4ee6-b199-0755381d1532'; -- Extracted: React, TypeScript
UPDATE opportunities SET skills = '["Canva"]'::jsonb WHERE id = '44a9c574-7d67-4c96-ba59-33ec0da2c377'; -- Extracted: Canva

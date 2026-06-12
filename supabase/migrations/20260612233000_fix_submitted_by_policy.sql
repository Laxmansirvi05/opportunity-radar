-- ==========================================
-- Fix Privilege Escalation / submitted_by Spoofing
-- ==========================================

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Students can submit opportunities" ON opportunities;

-- Recreate it with strict submitted_by validation
CREATE POLICY "Students can submit opportunities" ON opportunities 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = submitted_by AND 
  status = 'Pending Review'
);

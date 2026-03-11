
-- Create strategic phase enum
CREATE TYPE public.strategic_phase AS ENUM ('scoping', 'active_engagement', 'closed_followup', 'internal_ops');

-- Add to tasks and projects
ALTER TABLE public.tasks ADD COLUMN strategic_phase public.strategic_phase;
ALTER TABLE public.projects ADD COLUMN strategic_phase public.strategic_phase;

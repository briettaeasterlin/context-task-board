ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS route_group text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_state text;
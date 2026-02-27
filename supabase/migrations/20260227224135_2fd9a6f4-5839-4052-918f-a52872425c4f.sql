-- Add soft delete column to tasks
ALTER TABLE public.tasks ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add soft delete column to projects
ALTER TABLE public.projects ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient filtering of non-deleted items
CREATE INDEX idx_tasks_deleted_at ON public.tasks (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_deleted_at ON public.projects (deleted_at) WHERE deleted_at IS NULL;
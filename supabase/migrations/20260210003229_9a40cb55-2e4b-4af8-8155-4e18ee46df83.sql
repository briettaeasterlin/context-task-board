-- Add due_date (hard deadline) and target_window (aspirational) to tasks
ALTER TABLE public.tasks
ADD COLUMN due_date date NULL,
ADD COLUMN target_window text NULL;

-- Index for Today View queries on due_date
CREATE INDEX idx_tasks_due_date ON public.tasks (due_date) WHERE due_date IS NOT NULL;
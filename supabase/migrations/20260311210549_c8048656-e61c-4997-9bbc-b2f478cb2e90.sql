-- Add 'Today' and 'Closing' to task_status enum
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'Today' BEFORE 'Backlog';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'Closing' BEFORE 'Done';
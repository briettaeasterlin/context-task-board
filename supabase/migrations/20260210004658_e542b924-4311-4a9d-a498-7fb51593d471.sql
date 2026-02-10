
ALTER TABLE public.tasks ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Initialize existing Next tasks with sequential order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY 
    CASE WHEN due_date IS NOT NULL THEN 0 ELSE 1 END,
    due_date ASC NULLS LAST,
    updated_at DESC
  ) * 1000 AS new_order
  FROM tasks
  WHERE status = 'Next'
)
UPDATE tasks SET sort_order = ranked.new_order
FROM ranked WHERE tasks.id = ranked.id;

CREATE INDEX idx_tasks_sort_order ON public.tasks (user_id, status, sort_order);

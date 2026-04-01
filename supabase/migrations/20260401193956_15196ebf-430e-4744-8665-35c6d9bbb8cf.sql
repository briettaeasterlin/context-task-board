
CREATE TYPE public.task_update_tag AS ENUM ('progress', 'blocker', 'decision', 'next_step');

CREATE TABLE public.task_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  tag task_update_tag NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task_updates" ON public.task_updates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own task_updates" ON public.task_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own task_updates" ON public.task_updates FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_task_updates_task_id ON public.task_updates(task_id);
CREATE INDEX idx_task_updates_user_id ON public.task_updates(user_id);

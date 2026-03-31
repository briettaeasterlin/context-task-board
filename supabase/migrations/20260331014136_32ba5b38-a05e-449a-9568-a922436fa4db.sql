
CREATE TYPE public.proposed_change_status AS ENUM ('pending', 'applied', 'rejected');

CREATE TABLE public.proposed_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  change_type text NOT NULL,
  target_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  summary text NOT NULL,
  proposed_fields jsonb DEFAULT '{}',
  confidence text DEFAULT 'medium',
  reasoning text,
  source text DEFAULT 'system',
  status proposed_change_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.proposed_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposed_changes" ON public.proposed_changes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own proposed_changes" ON public.proposed_changes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposed_changes" ON public.proposed_changes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proposed_changes" ON public.proposed_changes FOR DELETE USING (auth.uid() = user_id);

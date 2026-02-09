
-- New enums
CREATE TYPE public.completion_rule AS ENUM ('manual', 'tasks_based');
CREATE TYPE public.update_source AS ENUM ('chatgpt', 'meeting', 'email', 'call', 'doc');
CREATE TYPE public.clarify_status AS ENUM ('open', 'answered', 'dismissed');

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area public.task_area NOT NULL DEFAULT 'Personal',
  summary TEXT,
  scope_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Milestones table
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  completion_rule public.completion_rule NOT NULL DEFAULT 'manual',
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own milestones" ON public.milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own milestones" ON public.milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON public.milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own milestones" ON public.milestones FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Updates table
CREATE TABLE public.updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  source public.update_source,
  content TEXT NOT NULL,
  extracted_summary TEXT,
  extracted_tasks JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own updates" ON public.updates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own updates" ON public.updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own updates" ON public.updates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own updates" ON public.updates FOR DELETE USING (auth.uid() = user_id);

-- Clarify questions table
CREATE TABLE public.clarify_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  reason TEXT,
  suggested_options JSONB,
  status public.clarify_status NOT NULL DEFAULT 'open',
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clarify_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clarify_questions" ON public.clarify_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own clarify_questions" ON public.clarify_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clarify_questions" ON public.clarify_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clarify_questions" ON public.clarify_questions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_clarify_questions_updated_at BEFORE UPDATE ON public.clarify_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add project_id and milestone_id FK columns to tasks
ALTER TABLE public.tasks ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_milestones_project ON public.milestones(project_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_milestone ON public.tasks(milestone_id);
CREATE INDEX idx_updates_project ON public.updates(project_id);
CREATE INDEX idx_updates_user ON public.updates(user_id);
CREATE INDEX idx_clarify_project ON public.clarify_questions(project_id);
CREATE INDEX idx_clarify_status ON public.clarify_questions(status);

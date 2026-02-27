
-- Extend tasks with planning fields
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS estimated_minutes integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS context_tag text DEFAULT NULL;

-- Planned task blocks (timeboxed tasks on the calendar)
CREATE TABLE public.planned_task_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  source text NOT NULL DEFAULT 'manual',
  locked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.planned_task_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own planned blocks" ON public.planned_task_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own planned blocks" ON public.planned_task_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own planned blocks" ON public.planned_task_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own planned blocks" ON public.planned_task_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_planned_task_blocks_updated_at
BEFORE UPDATE ON public.planned_task_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Calendar events cache (read-only Google Calendar events)
CREATE TABLE public.calendar_events_cache (
  id text NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_all_day boolean NOT NULL DEFAULT false,
  location text,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.calendar_events_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events" ON public.calendar_events_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar events" ON public.calendar_events_cache FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar events" ON public.calendar_events_cache FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar events" ON public.calendar_events_cache FOR DELETE USING (auth.uid() = user_id);

-- User planner settings
CREATE TABLE public.user_planner_settings (
  user_id uuid NOT NULL PRIMARY KEY,
  gcal_connected boolean NOT NULL DEFAULT false,
  gcal_refresh_token text,
  gcal_access_token text,
  gcal_token_expires_at timestamp with time zone,
  gcal_timezone text DEFAULT 'America/New_York',
  overlay_ics_token text DEFAULT encode(gen_random_bytes(32), 'hex'),
  workday_start time NOT NULL DEFAULT '08:00',
  workday_end time NOT NULL DEFAULT '18:00',
  max_next_tasks integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_planner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_planner_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON public.user_planner_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_planner_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_planner_settings_updated_at
BEFORE UPDATE ON public.user_planner_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

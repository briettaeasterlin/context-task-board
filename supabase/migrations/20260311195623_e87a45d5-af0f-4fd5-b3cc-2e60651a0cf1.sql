-- Drop all RESTRICTIVE policies and recreate as PERMISSIVE across all 12 tables

-- === tasks ===
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- === projects ===
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- === milestones ===
DROP POLICY IF EXISTS "Users can create own milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can delete own milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can update own milestones" ON public.milestones;
DROP POLICY IF EXISTS "Users can view own milestones" ON public.milestones;

CREATE POLICY "Users can view own milestones" ON public.milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own milestones" ON public.milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON public.milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own milestones" ON public.milestones FOR DELETE USING (auth.uid() = user_id);

-- === updates ===
DROP POLICY IF EXISTS "Users can create own updates" ON public.updates;
DROP POLICY IF EXISTS "Users can delete own updates" ON public.updates;
DROP POLICY IF EXISTS "Users can update own updates" ON public.updates;
DROP POLICY IF EXISTS "Users can view own updates" ON public.updates;

CREATE POLICY "Users can view own updates" ON public.updates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own updates" ON public.updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own updates" ON public.updates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own updates" ON public.updates FOR DELETE USING (auth.uid() = user_id);

-- === clarify_questions ===
DROP POLICY IF EXISTS "Users can create own clarify_questions" ON public.clarify_questions;
DROP POLICY IF EXISTS "Users can delete own clarify_questions" ON public.clarify_questions;
DROP POLICY IF EXISTS "Users can update own clarify_questions" ON public.clarify_questions;
DROP POLICY IF EXISTS "Users can view own clarify_questions" ON public.clarify_questions;

CREATE POLICY "Users can view own clarify_questions" ON public.clarify_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own clarify_questions" ON public.clarify_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clarify_questions" ON public.clarify_questions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clarify_questions" ON public.clarify_questions FOR DELETE USING (auth.uid() = user_id);

-- === operation_log ===
DROP POLICY IF EXISTS "Users can insert their own operations" ON public.operation_log;
DROP POLICY IF EXISTS "Users can view their own operations" ON public.operation_log;

CREATE POLICY "Users can view their own operations" ON public.operation_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own operations" ON public.operation_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- === operation_actions ===
DROP POLICY IF EXISTS "Users can insert their own operation actions" ON public.operation_actions;
DROP POLICY IF EXISTS "Users can view their own operation actions" ON public.operation_actions;

CREATE POLICY "Users can view their own operation actions" ON public.operation_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own operation actions" ON public.operation_actions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- === api_keys ===
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;

CREATE POLICY "Users can view their own API keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own API keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own API keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own API keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);

-- === habit_intentions ===
DROP POLICY IF EXISTS "Users can create their own habits" ON public.habit_intentions;
DROP POLICY IF EXISTS "Users can delete their own habits" ON public.habit_intentions;
DROP POLICY IF EXISTS "Users can update their own habits" ON public.habit_intentions;
DROP POLICY IF EXISTS "Users can view their own habits" ON public.habit_intentions;

CREATE POLICY "Users can view their own habits" ON public.habit_intentions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own habits" ON public.habit_intentions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own habits" ON public.habit_intentions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own habits" ON public.habit_intentions FOR DELETE USING (auth.uid() = user_id);

-- === user_planner_settings ===
DROP POLICY IF EXISTS "Users can create own settings" ON public.user_planner_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_planner_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_planner_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_planner_settings;

CREATE POLICY "Users can view own settings" ON public.user_planner_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON public.user_planner_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_planner_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.user_planner_settings FOR DELETE USING (auth.uid() = user_id);

-- === planned_task_blocks ===
DROP POLICY IF EXISTS "Users can create own planned blocks" ON public.planned_task_blocks;
DROP POLICY IF EXISTS "Users can delete own planned blocks" ON public.planned_task_blocks;
DROP POLICY IF EXISTS "Users can update own planned blocks" ON public.planned_task_blocks;
DROP POLICY IF EXISTS "Users can view own planned blocks" ON public.planned_task_blocks;

CREATE POLICY "Users can view own planned blocks" ON public.planned_task_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own planned blocks" ON public.planned_task_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own planned blocks" ON public.planned_task_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own planned blocks" ON public.planned_task_blocks FOR DELETE USING (auth.uid() = user_id);

-- === calendar_events_cache ===
DROP POLICY IF EXISTS "Users can delete own calendar events" ON public.calendar_events_cache;
DROP POLICY IF EXISTS "Users can insert own calendar events" ON public.calendar_events_cache;
DROP POLICY IF EXISTS "Users can update own calendar events" ON public.calendar_events_cache;
DROP POLICY IF EXISTS "Users can view own calendar events" ON public.calendar_events_cache;

CREATE POLICY "Users can view own calendar events" ON public.calendar_events_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own calendar events" ON public.calendar_events_cache FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own calendar events" ON public.calendar_events_cache FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own calendar events" ON public.calendar_events_cache FOR DELETE USING (auth.uid() = user_id);

-- === rate_limit_log (lock down - only service role should access) ===
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all direct access to rate_limit_log" ON public.rate_limit_log FOR ALL USING (false);
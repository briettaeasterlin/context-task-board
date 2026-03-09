ALTER TABLE public.user_planner_settings
ADD COLUMN IF NOT EXISTS overlay_ics_token_expires_at timestamp with time zone DEFAULT (now() + interval '90 days');
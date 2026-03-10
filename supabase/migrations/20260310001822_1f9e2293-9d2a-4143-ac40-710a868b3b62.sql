
-- Add payload_hash and schema_version to operation_log
ALTER TABLE public.operation_log ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE public.operation_log ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '1.0';

CREATE INDEX IF NOT EXISTS idx_operation_log_payload_hash ON public.operation_log(payload_hash);

-- operation_actions: normalized per-action audit trail
CREATE TABLE IF NOT EXISTS public.operation_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_log_id UUID NOT NULL REFERENCES public.operation_log(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_title TEXT,
  confidence TEXT DEFAULT 'high',
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_operation_actions_operation ON public.operation_actions(operation_log_id);
CREATE INDEX idx_operation_actions_target ON public.operation_actions(target_type, target_id);
CREATE INDEX idx_operation_actions_user ON public.operation_actions(user_id);

ALTER TABLE public.operation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own operation actions"
  ON public.operation_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own operation actions"
  ON public.operation_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- rate_limit_log: per-key request tracking
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rate_limit_log_key_time ON public.rate_limit_log(api_key_id, requested_at);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS needed - only accessed by service role in edge function

-- Add allowed_ips to api_keys
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT '{}';

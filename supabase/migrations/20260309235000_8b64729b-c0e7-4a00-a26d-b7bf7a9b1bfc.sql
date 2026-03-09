-- operation_log table
CREATE TABLE public.operation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('chatgpt', 'claude', 'manual')),
  payload JSONB NOT NULL,
  result JSONB,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_operation_log_user ON public.operation_log(user_id);
CREATE INDEX idx_operation_log_operation_id ON public.operation_log(operation_id);

ALTER TABLE public.operation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own operations"
  ON public.operation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own operations"
  ON public.operation_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- api_keys table
CREATE TABLE public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  key_hash TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Unnamed Key',
  permissions TEXT[] NOT NULL DEFAULT ARRAY['vector:ingest', 'vector:read'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);
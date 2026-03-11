
CREATE TABLE public.user_rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_rate_limit_lookup ON public.user_rate_limit_log (user_id, function_name, requested_at);

ALTER TABLE public.user_rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access to user_rate_limit_log"
  ON public.user_rate_limit_log
  FOR ALL
  TO public
  USING (false);

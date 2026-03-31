
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  source text NOT NULL DEFAULT 'manual',
  proposed_change_id uuid REFERENCES public.proposed_changes(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_log" ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit_log" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add reviewed_by and reviewed_at to proposed_changes
ALTER TABLE public.proposed_changes ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE public.proposed_changes ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

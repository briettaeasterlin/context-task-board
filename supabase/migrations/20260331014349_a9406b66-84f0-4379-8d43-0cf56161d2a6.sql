
CREATE TABLE public.source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  raw_content text NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.source_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own source_events" ON public.source_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own source_events" ON public.source_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Also add requires_review column to proposed_changes
ALTER TABLE public.proposed_changes ADD COLUMN IF NOT EXISTS requires_review boolean NOT NULL DEFAULT true;
ALTER TABLE public.proposed_changes ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.source_events(id) ON DELETE SET NULL;


-- Create cadence enum
CREATE TYPE public.habit_cadence AS ENUM ('Daily', 'Weekly', 'Often', 'Seasonal');

-- Create habit_intentions table
CREATE TABLE public.habit_intentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cadence public.habit_cadence NOT NULL DEFAULT 'Daily',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.habit_intentions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own habits"
  ON public.habit_intentions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habits"
  ON public.habit_intentions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits"
  ON public.habit_intentions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits"
  ON public.habit_intentions FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_habit_intentions_updated_at
  BEFORE UPDATE ON public.habit_intentions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

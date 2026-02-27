-- Add missing DELETE policy on user_planner_settings
CREATE POLICY "Users can delete own settings"
ON public.user_planner_settings
FOR DELETE
USING (auth.uid() = user_id);
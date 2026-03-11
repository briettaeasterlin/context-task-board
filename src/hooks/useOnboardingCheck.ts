import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Returns true if the user has zero projects (i.e. needs onboarding).
 * Returns null while loading.
 */
export function useOnboardingCheck() {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setNeedsOnboarding(null); return; }

    let cancelled = false;

    (async () => {
      const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (cancelled) return;
      if (error) { setNeedsOnboarding(false); return; }
      setNeedsOnboarding((count ?? 0) === 0);
    })();

    return () => { cancelled = true; };
  }, [user]);

  return needsOnboarding;
}

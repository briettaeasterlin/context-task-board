import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Returns true if the user needs onboarding (zero projects and hasn't completed setup).
 * Returns null while loading.
 */
export function useOnboardingCheck() {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setNeedsOnboarding(null); return; }

    // If already onboarded via localStorage, skip the check
    if (localStorage.getItem('nextmove_onboarded') === 'true') {
      setNeedsOnboarding(false);
      return;
    }

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

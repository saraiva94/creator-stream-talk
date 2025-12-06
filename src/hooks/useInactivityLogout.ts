import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_KEY = 'lastActivityTimestamp';
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useInactivityLogout = () => {
  const updateLastActivity = useCallback(() => {
    localStorage.setItem(INACTIVITY_KEY, Date.now().toString());
  }, []);

  const checkInactivity = useCallback(async () => {
    const lastActivity = localStorage.getItem(INACTIVITY_KEY);
    if (!lastActivity) {
      updateLastActivity();
      return;
    }

    const elapsed = Date.now() - parseInt(lastActivity, 10);
    if (elapsed > INACTIVITY_TIMEOUT_MS) {
      console.log('[AUTH] Logging out due to 24h inactivity');
      localStorage.removeItem(INACTIVITY_KEY);
      await supabase.auth.signOut();
      window.location.href = '/auth';
    }
  }, [updateLastActivity]);

  useEffect(() => {
    // Check inactivity on mount
    checkInactivity();

    // Update activity on user interactions
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      updateLastActivity();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Periodic check every 5 minutes
    const interval = setInterval(checkInactivity, 5 * 60 * 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [checkInactivity, updateLastActivity]);
};

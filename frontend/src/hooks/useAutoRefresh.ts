import { useEffect, useRef } from 'react';

/**
 * A custom React hook that sets up an interval and automatically pauses polling
 * when the document is not visible (e.g. user switched to another tab).
 * 
 * @param callback The function to execute on interval
 * @param delay The interval delay in milliseconds
 */
export function useAutoRefresh(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);

  // Remember the latest callback if it changes.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    // Don't schedule if no delay is specified.
    if (delay === null) {
      return;
    }

    let id: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      // Only execute if the browser tab is visible
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    // Setup visibility change listener to fire immediately when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start interval
    id = setInterval(tick, delay);

    return () => {
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay]);
}

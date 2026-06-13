import { useState, useEffect } from 'react';
import { getCurrentQuery } from '../services/boardQueryApplicator';

/**
 * Tracks the current board path and the visible query assist text.
 */
export function useQueryParams() {
  const [query, setQuery] = useState(() => getCurrentQuery());
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const updateState = () => {
      const currentQuery = getCurrentQuery();
      const currentPathname = window.location.pathname;

      setQuery((previousQuery) => previousQuery === currentQuery ? previousQuery : currentQuery);
      setPathname((previousPathname) => previousPathname === currentPathname ? previousPathname : currentPathname);
    };

    const handleLocationChange = () => {
      updateState();
    };

    const intervalId = window.setInterval(() => {
      updateState();
    }, 300);

    window.addEventListener('popstate', handleLocationChange);
    updateState();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  return {
    query,
    pathname
  };
}

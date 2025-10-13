import { useState, useEffect, useMemo } from 'react';

/**
 * Custom hook for working with URL query parameters
 * Tracks URL changes and allows reading/updating query parameters
 */
export function useQueryParams() {
  const [search, setSearch] = useState(() => window.location.search);
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    // Track URL changes through DOM mutations (YouTrack's method)
    const observer = new MutationObserver(() => {
      const currentSearch = window.location.search;
      const currentPathname = window.location.pathname;
      
      if (currentSearch !== search || currentPathname !== pathname) {
        setSearch(currentSearch);
        setPathname(currentPathname);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Also listen to standard navigation events
    const handleLocationChange = () => {
      setSearch(window.location.search);
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [search, pathname]);

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const getParam = (key: string) => params.get(key);

  return { 
    getParam, 
    params,
    search,
    pathname
  };
}

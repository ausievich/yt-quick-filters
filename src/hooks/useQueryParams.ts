import { useState, useEffect, useMemo } from 'react';

/**
 * Custom hook for working with URL query parameters
 * Tracks URL changes and allows reading/updating query parameters
 */
export function useQueryParams() {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    // Track URL changes through DOM mutations (YouTrack's method)
    const observer = new MutationObserver(() => {
      const currentSearch = window.location.search;
      if (currentSearch !== search) {
        setSearch(currentSearch);
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'src', 'data-*']
    });

    // Also listen to standard navigation events
    const handleLocationChange = () => {
      setSearch(window.location.search);
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [search]);

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const getParam = (key: string) => params.get(key);

  return { 
    getParam, 
    params,
    search 
  };
}

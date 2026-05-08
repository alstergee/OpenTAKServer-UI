import { useEffect } from 'react';

/**
 * Set `document.title` for the lifetime of a page component. Restores the
 * previous title on unmount so navigating away (or unmounting in a route
 * transition) returns the tab to the prior value rather than leaving stale
 * page-specific text.
 *
 * Usage:
 *   export default function EUDs() {
 *     usePageTitle('EUDs');
 *     ...
 *   }
 */
export function usePageTitle(title: string, suffix = 'OpenTAKServer'): void {
    useEffect(() => {
        const prev = document.title;
        document.title = title ? `${title} · ${suffix}` : suffix;
        return () => { document.title = prev; };
    }, [title, suffix]);
}

export default usePageTitle;

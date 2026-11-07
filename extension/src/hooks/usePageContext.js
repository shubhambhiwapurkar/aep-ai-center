import { useEffect, useState } from 'react';
import { parseAepUrl } from '../lib/aepPage.js';

/**
 * Tracks the active tab and parses it as an Adobe Experience Cloud page.
 * Needs the "tabs" permission (already in the manifest) to read tab URLs. Only the parsed
 * sandbox / area / object id is kept - never the page content.
 */
export function usePageContext() {
    const [page, setPage] = useState(null);

    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.tabs?.query) return undefined;
        let alive = true;
        const refresh = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                if (alive) setPage(tab?.url ? parseAepUrl(tab.url) : null);
            } catch {
                if (alive) setPage(null);
            }
        };
        const onUpdated = (_id, info, tab) => {
            if (tab?.active && (info.url || info.status === 'complete')) refresh();
        };
        refresh();
        chrome.tabs.onActivated.addListener(refresh);
        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.windows?.onFocusChanged?.addListener(refresh);
        return () => {
            alive = false;
            chrome.tabs.onActivated.removeListener(refresh);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            chrome.windows?.onFocusChanged?.removeListener(refresh);
        };
    }, []);

    return page;
}

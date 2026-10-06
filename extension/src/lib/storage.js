/**
 * Local-only persistence. Uses chrome.storage.local inside the extension and falls back to
 * localStorage when the side panel is opened as a plain page (e.g. `vite preview`).
 * Nothing here ever leaves the user's machine.
 */
const hasChrome = typeof chrome !== 'undefined' && chrome.storage?.local;

export async function load(key, fallback = null) {
    try {
        if (hasChrome) {
            const out = await chrome.storage.local.get(key);
            return out[key] ?? fallback;
        }
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export async function save(key, value) {
    try {
        if (hasChrome) return await chrome.storage.local.set({ [key]: value });
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('[storage] save failed', e);
    }
}

export async function remove(key) {
    try {
        if (hasChrome) return await chrome.storage.local.remove(key);
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

/** Trigger a browser download of text content (used for "save to my machine"). */
export function download(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a user-picked file as text. */
export function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

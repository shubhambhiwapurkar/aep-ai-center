// Open the side panel when the toolbar icon (or Alt+Shift+A, via _execute_action) is used.
const enablePanel = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(enablePanel);
chrome.runtime.onStartup.addListener(enablePanel);

// Badge the toolbar icon on Adobe Experience Cloud tabs so users know the panel can help there.
const AEP_HOST = /^https:\/\/experience(-stage)?\.adobe\.com\//;
function badge(tabId, url) {
    const on = AEP_HOST.test(url || '');
    chrome.action.setBadgeText({ tabId, text: on ? 'AEP' : '' }).catch(() => {});
    if (on) chrome.action.setBadgeBackgroundColor({ tabId, color: '#1473e6' }).catch(() => {});
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.url || info.status === 'complete') badge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then((tab) => badge(tabId, tab.url)).catch(() => {});
});

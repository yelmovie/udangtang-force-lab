/** Registers the offline worker in production builds; it caches the first screen and every screen opened afterwards. */
export function prepareOffline() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).catch(() => { /* Without the worker the app still runs online. */ });
}

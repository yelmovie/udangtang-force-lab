export type OfflineState = 'development' | 'unsupported' | 'preparing' | 'ready' | 'update' | 'error';
let state: OfflineState = import.meta.env.DEV ? 'development' : 'preparing';
const listeners = new Set<() => void>();
export function offlineMessage(): string {
  return {
    // The dev server never installs the worker, so there is no status worth showing there.
    development: '',
    unsupported: '이 브라우저에서는 오프라인 준비를 지원하지 않습니다. 인터넷 연결을 유지해 주세요.',
    preparing: '첫 화면 자료를 저장하고 있어요. 잠시 인터넷 연결을 유지해 주세요.',
    ready: '오프라인 준비 완료 · 한 번 열어 본 화면은 인터넷 없이도 열려요.',
    update: '새 버전 준비 완료 · 열린 실험실 탭을 모두 닫고 다시 열면 적용돼요.',
    error: '오프라인 자료를 저장하지 못했어요. 인터넷과 브라우저 저장공간을 확인한 뒤 새로고침해 주세요.',
  }[state];
}
export function watchOffline(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function update(next: OfflineState) { state = next; listeners.forEach(listener => listener()); }
export function prepareOffline() {
  if (import.meta.env.DEV) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { update('unsupported'); return; }
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).then(registration => {
    const watch = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const changed = () => {
        if (worker.state === 'activated') update('ready');
        if (worker.state === 'installed' && navigator.serviceWorker.controller) update('update');
        if (worker.state === 'redundant' && !registration.active) update('error');
      };
      worker.addEventListener('statechange', changed);
      changed();
    };
    if (registration.waiting) update('update');
    else if (registration.active) update('ready');
    watch(registration.installing);
    registration.addEventListener('updatefound', () => { watch(registration.installing); });
  }).catch(() => update('error'));
}

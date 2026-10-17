import { SAVE_KEY } from './state';

let initialBytes: number | null = null;
let initialRequests: number | null = null;
function captureInitialRequests() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const boundary = navigation?.loadEventStart || performance.now();
  const initial = resources.filter(entry => entry.startTime <= boundary);
  initialBytes = (navigation?.transferSize ?? 0) + initial.reduce((sum, entry) => sum + entry.transferSize, 0);
  initialRequests = initial.length + (navigation ? 1 : 0);
}
if (document.readyState === 'complete') captureInitialRequests();
else window.addEventListener('load', captureInitialRequests, { once: true });

function savedRecordMarkup(): string {
  let record: string;
  try {
    const stored = localStorage.getItem(SAVE_KEY);
    if (stored === null) record = '이 브라우저에 저장된 앱 기록이 없습니다.';
    else {
      try { record = JSON.stringify(JSON.parse(stored), null, 2); }
      catch { record = `저장된 기록의 형식을 확인해 주세요.\n${stored}`; }
    }
  } catch {
    record = '브라우저가 저장소 읽기를 허용하지 않아 기록을 확인할 수 없습니다.';
  }
  const escaped = record.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<details class="teacher-diagnostics"><summary>이 브라우저의 앱 저장 기록</summary><p>교사 안내를 연 시점의 이 앱 기록만 확인합니다. 다른 앱의 저장소는 읽지 않습니다. 앱은 실험자 이름·학번을 입력받지 않습니다. 최신 기록을 보려면 교사 안내를 다시 열어 주세요.</p><pre class="teacher-save-record" tabindex="0" aria-label="이 앱의 저장 기록">${escaped}</pre></details>`;
}

export function diagnosticMarkup(): string {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const ready = performance.getEntriesByName('force-lab-ready')[0];
  const paint = performance.getEntriesByName('first-contentful-paint')[0];
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const externalRequests = resources.filter(entry => {
    try {
      const url = new URL(entry.name, location.href);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== location.origin;
    } catch { return false; }
  }).length;
  const seconds = (value: number | undefined) => value === undefined || value <= 0 ? '측정값 없음' : `${(value / 1000).toFixed(2)}초`;
  return `<details class="teacher-diagnostics"><summary>이 기기의 점검 정보</summary><dl><dt>첫 실험실 화면 준비</dt><dd>${seconds(ready?.startTime)}</dd><dt>첫 콘텐츠 표시(FCP)</dt><dd>${seconds(paint?.startTime)}</dd><dt>문서 로드 완료</dt><dd>${seconds(navigation?.loadEventEnd)}</dd><dt>초기 요청 관측 전송량</dt><dd>${initialBytes === null ? '측정값 없음' : `${(initialBytes / 1024).toFixed(1)} KiB`}</dd><dt>초기 요청 수</dt><dd>${initialRequests ?? '측정값 없음'}</dd><dt>현재 탭에서 관측된 외부 주소 요청</dt><dd>${externalRequests}건</dd></dl><p>${import.meta.env.DEV ? '개발 미리보기' : '배포용 빌드'}에서 현재 탭의 브라우저 성능 API로 관측한 값입니다. 외부 요청은 현재 주소와 origin이 다른 HTTP(S) 자원 요청 수이며, 요청 주소·본문은 표시하거나 전송하지 않습니다. 브라우저의 기록 범위 밖 요청은 포함하지 않으므로 0건이 전체 외부 전송 부재를 증명하지 않습니다. 전체 보안 감사나 학교망·동시 접속·실제 태블릿 검증 결과가 아닙니다. 캐시·서비스워커·브라우저 정책에 따라 전송량이 0으로 표시될 수 있습니다.</p></details>${savedRecordMarkup()}`;
}

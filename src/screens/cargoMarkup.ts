// E2 (2026-11-21): the cargo screen's fixed markup, moved out of mountCargo unchanged.
import { cargoForceNames, cargoLoads, cargoOrders, type ForceLevel } from '../cargoModel';
import type { CargoRun } from '../state';
import { missionProgressMarkup } from '../missionProgress';
import { requestOpenLabel } from '../requestLetter';

export const imagePath = (name: string) => `${import.meta.env.BASE_URL}assets/game/${name}.webp`;

export const cargoTrackCells = 70;

const cargoCompareMarkup = () => `<section class="cargo-compare" aria-labelledby="cargo-compare-title" hidden>
  <header>
    <h2 id="cargo-compare-title">같은 힘으로 어디까지 갈까요?</h2>
    <p class="cargo-compare-note" role="status"></p>
  </header>
  <div class="cargo-compare-axis" aria-hidden="true"><div class="cargo-compare-scale">
    ${[0, 20, 40, 60].map(n => `<span style="left:${n / cargoTrackCells * 100}%">${n ? `${n}칸` : '출발 · 0칸'}</span>`).join('')}
  </div></div>
  ${cargoLoads.map(parts => `<div class="cargo-compare-row" data-load="${parts}">
    <strong class="cargo-compare-load">부품 <b>${parts}</b>개</strong>
    <div class="cargo-compare-track" aria-hidden="true" style="--cell:${100 / cargoTrackCells}%">
      <div class="cargo-compare-motion">
        <div class="cargo-compare-fill"></div>
        <div class="cargo-compare-sprite">
          <img class="cargo-compare-box" src="${imagePath('crate-empty')}" alt="" draggable="false">
          <div class="cargo-contents" data-count="${parts}">${Array.from({ length: parts }, (_, i) => `<img src="${imagePath('cargo-part')}" alt="" draggable="false" style="--part:${i}">`).join('')}</div>
          <span class="cargo-compare-strap"></span>
          <img class="cargo-compare-push" src="${imagePath('student-cargo-push')}" alt="" draggable="false">
          <img class="cargo-compare-pull" src="${imagePath('student-cargo-pull')}" alt="" draggable="false">
        </div>
      </div>
    </div>
    <div class="cargo-compare-result" hidden><span>출발점에서</span><b></b></div>
  </div>`).join('')}
</section>`;

const cargoCompareControls = `<div class="cargo-compare-controls" role="group" aria-label="세 상자 움직이기" hidden>
  <button type="button" class="button button-primary" data-compare="push">밀어서 보기</button>
  <button type="button" class="button button-primary" data-compare="pull">당겨서 보기</button>
  <button type="button" class="button button-primary cargo-compare-next" hidden>비교하고 의뢰 받기 →</button>
</div>`;

/** The screen frame; `fingerIcon` is the hint finger mountCargo also uses. */
export const cargoScreenMarkup = (fingerIcon: string) => `<section class="experiment-screen cargo-expedition">
    <div class="experiment-heading"><div><p class="eyebrow">01 · 물자 배송소</p><h1>멈춘 화물을 움직여라!</h1></div><div class="cargo-tools"><button class="cargo-record-open" id="cargo-record-open">기록 보기 <span id="cargo-record-count">0</span></button><button class="button button-primary cargo-bakery-open" id="cargo-open-orders" hidden>${requestOpenLabel} →</button></div>${missionProgressMarkup('cargo', ['밀기 1·3·5개', '당기기 1·3·5개', '더 멀리 간 상자', '빵집 주문 3장'])}</div>
    <div class="cargo-adventure"><div class="cargo-scene" aria-label="화물 실험 무대">
      <div class="cargo-scene-caption"><span class="instrument-phase cargo-step" id="cargo-step" tabindex="-1"></span><button class="button button-primary cargo-tap-go" id="cargo-tap-go" aria-describedby="cargo-step">눌러서 밀기 →</button><button class="button button-secondary cargo-auto-go" id="cargo-auto-go" aria-pressed="false">▶ 자동으로 보기</button></div>
      <div class="cargo-order-notice" hidden><p role="status"></p><button type="button" class="button button-primary" id="cargo-next-order" hidden>다음 주문 →</button></div>
      <div class="cargo-finding-cta" hidden><p>실험 끝! 1·3·5개 상자를 모두 밀고 당겨 봤어요.</p><button class="button button-primary" id="cargo-finding-go">비교하고 의뢰 받기 →</button></div>
      <div class="cargo-rail"><span class="rail-start">출발</span><span class="rail-end">어디까지 갈까?</span><i class="rail-ticks"></i><div class="cargo-target-zone" hidden><span>빵집 문 앞</span></div><div class="cargo-ghosts" aria-hidden="true"></div><div class="cargo-gesture-guide" aria-hidden="true"><span class="cargo-gesture-arrow">→</span><span class="cargo-gesture-target">같은 힘</span></div><div class="cargo-object" data-mood="idle" aria-label="부품을 담는 상자"><span class="cargo-pull-strap" aria-hidden="true"></span><span class="cargo-force-arrow" aria-hidden="true"><b>같은 힘</b></span><button class="cargo-worker-grip"><img class="cargo-worker cargo-worker-push" src="${imagePath('student-cargo-push')}" alt="" draggable="false"><img class="cargo-worker cargo-worker-pull" src="${imagePath('student-cargo-pull')}" alt="" draggable="false"><span class="cargo-grab-cue">${fingerIcon}</span></button><img class="cargo-box-art" src="${imagePath('crate-empty')}" alt="나무 운반 상자" draggable="false"><div class="cargo-contents"></div><span class="cargo-load-tag"></span></div></div>
      <div class="cargo-distance" role="status"></div>
      ${cargoCompareMarkup()}
    </div><div class="cargo-dock">${cargoCompareControls}<div class="cargo-inventory" data-level="1"><strong>① 상자에 담을 부품</strong><div class="cargo-load-options">${[1, 3, 5].map(n => `<button data-parts="${n}" aria-label="같은 금속 부품 ${n}개 담기"><img src="${imagePath(`cargo-parts-${n}`)}" alt="" draggable="false"><span>부품 ${n}개</span></button>`).join('')}</div></div><div class="cargo-method" data-level="1"><strong>② 힘을 주는 쪽</strong><div class="segmented"><button data-action="push" aria-label="뒤에서 밀기">밀기</button><button data-action="pull" aria-label="앞에서 당기기">당기기</button></div></div><div class="cargo-orders" data-level="2"><strong>빵집 주문서</strong><div class="cargo-order-cards"></div></div><div class="cargo-force" data-level="2"><strong>힘 단계</strong><div class="segmented">${([1, 2, 3] as const).map(f => `<button data-force="${f}"><i class="cargo-step-arrow" style="--step:${f}" aria-hidden="true"></i>${cargoForceNames[f - 1]}</button>`).join('')}</div></div></div></div>
    <div class="experiment-footer"><span class="feedback" id="cargo-feedback" role="status"></span><button class="button button-primary" id="cargo-finish" disabled>운반 레일 복구하기 →</button></div></section>`;

/** Result popup frame (label, title, body; the finding and finish buttons follow the stage state). */
export const cargoPopupMarkup = (label: string, title: string, body: string, needsFinding: boolean, finishDisabled: boolean) => `<div class="stage-popup-card"><button class="stage-popup-close" aria-label="닫기">×</button><p class="stage-popup-label">${label}</p><h2 id="cargo-popup-title">${title}</h2><div class="stage-popup-body">${body}</div><div class="stage-popup-actions">${!finishDisabled ? '<button class="button button-secondary stage-popup-continue">계속 실험하기</button><button class="button button-primary stage-result-finish">운반 레일 복구하기 →</button>' : `<button class="button ${needsFinding ? 'button-secondary' : 'button-primary'} stage-popup-continue">${needsFinding ? '더 실험해 보기' : '계속 실험하기'}</button>`}</div></div>`;

/** Distance bars for the 1·3·5 part crates. */
export const cargoTracesMarkup = (comparisonRun: (parts: number) => CargoRun | undefined, directionText: () => string) => `<div class="cargo-traces">${[1, 3, 5].map(n => { const r = comparisonRun(n); return `<div class="cargo-trace" data-parts="${n}"><span>${n}개</span><b><i style="width:${r ? Math.min(100, r.distance / 70 * 100) : 0}%"></i></b><strong>${r ? `${r.distance}칸` : '아직'}</strong></div>`; }).join('')}</div><p class="cargo-direction">${directionText()}</p>`;

/** The bakery orders and the force each was delivered with. */
export const cargoOrdersMarkup = (doneForces: readonly number[], forceName: (f: ForceLevel) => string) => `<div class="cargo-popup-orders">${cargoOrders.map((order, i) => { const done = doneForces[i] as ForceLevel | undefined; return `<span data-state="${done ? 'done' : 'wait'}">주문 ${i + 1} · 부품 ${order.parts}개${done ? ` ✓ ${forceName(done)}` : ''}</span>`; }).join('')}</div>`;

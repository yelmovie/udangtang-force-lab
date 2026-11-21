// E2 (2026-11-21): the balance screen's fixed markup, moved out of mountBalance unchanged.
import { balanceObjects } from '../data';
import { requestOpenLabel } from '../requestLetter';
import { mysteryRoundCount } from '../balanceModel';

export const balanceObjectArt = (id: string) => `<span class="instrument-object object-${id}" aria-hidden="true"><img src="${balanceObjects.find(object => object.id === id)!.image}" alt="" draggable="false"></span>`;

export const balanceScreenMarkup = () => `<section class="experiment-screen instrument-screen balance-screen">
    <div class="experiment-heading balance-topbar"><div><p class="eyebrow">02 · 균형 다리</p><h1>어느 물체가 더 무거울까?</h1></div>
      <div class="balance-goal" role="status" aria-live="polite"><span id="balance-tilt-goal">○ 기울기 발견</span><span id="balance-level-goal">○ 수평 발견</span><span id="balance-mystery-goal">○ 수수께끼 상자 0/${mysteryRoundCount}</span><span id="balance-uses" hidden></span></div>
      <div class="balance-top-tools"><button class="button button-secondary stage-auto-go" id="balance-auto-go" aria-pressed="false" hidden>▶ 자동으로 보기</button><button class="button button-primary" id="balance-request-open" hidden>${requestOpenLabel} →</button><button class="balance-record-button" id="balance-record" aria-haspopup="dialog"><span id="balance-record-label">기록 보기</span><b id="balance-count">0</b></button></div>
    </div>
    <div class="instrument-stage game-panel balance-field">
      <div class="instrument-phase" id="balance-phase" role="status"></div>
      <div class="balance-apparatus"><div class="balance-board" id="balance-board">
        <button class="balance-pan left" data-pan="left" aria-label="왼쪽 자리"><span class="balance-side">왼쪽</span><div class="pan-object" id="left-object"></div><strong class="balance-pan-name" id="left-name">물체 놓기</strong></button>
        <div class="balance-beam"></div>
        <button class="balance-pan right" data-pan="right" aria-label="오른쪽 자리"><span class="balance-side">오른쪽</span><div class="pan-object" id="right-object"></div><strong class="balance-pan-name" id="right-name">물체 놓기</strong></button>
      </div><div class="balance-pivot"></div><div class="balance-stand"></div></div>
      <div class="balance-lock" id="balance-lock"><span class="balance-lock-socket" aria-hidden="true"></span><button id="balance-test" class="balance-pin" aria-label="고리에 달린 잠금핀을 오른쪽으로 뽑아 기울기 확인"><img src="/assets/game/balance-lock-pin.webp" alt=""></button><span class="balance-lock-callout" id="balance-lock-callout">고리를 잡고 뽑기 →</span></div>
      <div class="balance-result" id="balance-result"></div>
      <div class="instrument-companion" id="balance-companion" aria-hidden="true"></div>
    </div>
    <div class="instrument-dock balance-dock">
      <div class="instrument-tools" data-level="1"><span class="dock-label">① 물체 두 개를 놓아요</span><div class="object-options">${balanceObjects.map(object => `<button class="object-card" data-object="${object.id}" aria-label="${object.label} 선택 또는 자리로 끌기">${balanceObjectArt(object.id)}<strong>${object.label}</strong></button>`).join('')}</div></div>
      <div class="instrument-tools" data-level="2"><span class="dock-label">① 상자 두 개를 놓아요 <small>겉모습은 모두 같아요</small></span><div class="object-options mystery-options" id="mystery-options"></div></div>
    </div>
    <div class="experiment-footer"><span class="feedback" id="balance-feedback" role="status"></span><button class="button button-primary" id="balance-finish" disabled>발견 저장 →</button></div>
  </section>`;

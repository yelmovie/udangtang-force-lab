// 설정 창: 소리·바로 가기·안내·교사용 전체 단계 해금·기록 초기화. main.ts에서 그대로 옮김(2026-11-19, 동작 변경 없음).
// 앱 상태를 바꾸는 일(화면 이동, 기록 초기화, 해금 켜고 끄기)은 main.ts가 SettingsHost로 넘겨준 함수가 한다.
import { stages, type PageId, type StageId } from './data';
import type { SaveData } from './state';
import { setEffectVolume, setVolume, stopSounds } from './sound';
import { infoContent } from './info';
import { conceptClipTitle, conceptPoster, openConceptClip } from './conceptClip';
import { earnedToolCards } from './toolCards';
import { bagIcon, openToolBag } from './toolBag';
import { icons } from './icons';
import { introVideo, openStoryModal, prologueLines } from './storyModal';
import { stopAllVoices } from './npcDialogueVoice';
import { shownItems, wrapTabAtEnds } from './focusTrap';

export type SettingsHost = {
  app: HTMLElement;
  save(): SaveData; adminSave(): SaveData | null; adminUnlocked(): boolean;
  tone(frequency?: number): void; toast(message: string): void; persist(): boolean;
  navigate(page: PageId): void; setAdminMode(enabled: boolean): void;
  updateSoundButton(): void; syncMusic(): void; openEndingCeremony(): void; openCertificate(): void;
  /** 기록 초기화: 소리 설정만 남기고 새 저장으로, 해금 끔, 첫 화면으로 */
  resetRecords(): void;
  /** 첫 화면(제목)으로 */
  goTitle(): void;
};

export function openSettings(host: SettingsHost, focusAction?: 'bag') {
  const { app, tone } = host;
  // 창이 열려 있는 동안 아래 값은 바뀌지 않는다(바꾸는 동작은 모두 창을 닫고 host에 맡긴다). 다시 열면 새로 읽는다.
  const save = host.save(), adminSave = host.adminSave(), adminUnlocked = host.adminUnlocked();
  const overlay = document.createElement('div');
  overlay.className = 'modal-layer settings-layer';
  // 바깥이나 글자를 눌러도 초점이 창 안(이 층)에 남아 Esc가 잡힌다. 바깥을 눌러 닫지는 않는다.
  overlay.tabIndex = -1;
  const appWasInert = app.inert;
  app.inert = true;
  const close = () => { app.inert = appWasInert; overlay.remove(); app.querySelector<HTMLButtonElement>('[data-top="settings"]')?.focus(); };
  type Section = 'menu' | 'admin' | 'reset' | 'concepts';
  const headings: Record<Section, string> = { menu: '설정', admin: '전체 단계 해금', reset: '탐구 기록 초기화', concepts: '개념 영상 다시 보기' };
  const show = (section: Section) => {
    let content: string;
    if (section === 'menu') {
      const cardCount = earnedToolCards(adminSave ?? save).length;
      const canWatch = save.completed.length === stages.length || adminUnlocked;
      const canRead = save.completed.length === stages.length || adminUnlocked;
      const volume = Math.round((save.soundVolume ?? .3) * 100), effects = Math.round((save.effectVolume ?? 1) * 100);
      const soundSwitch = (action: 'sound' | 'music' | 'voice', name: string, on: boolean) =>
        `<button type="button" role="switch" class="button button-secondary setting-row" data-settings="${action}" aria-label="${name}" aria-checked="${on}">${switchLabel(name, on)}</button>`;
      const summary = (title: string, body: string) => `<details class="science-settings-detail"><summary>${title}</summary>${body}</details>`;
      content = `<div class="science-settings-body">
        <div class="science-settings-audio" aria-label="소리 설정">
          ${soundSwitch('music','배경 음악',save.musicOn === true)}${soundSwitch('sound','효과음',save.soundOn)}
        <label class="setting-row settings-wide" for="effect-volume">효과음 크기 <input id="effect-volume" type="range" min="0" max="100" step="5" value="${effects}"><output id="effect-volume-value" for="effect-volume">${effects}%</output></label>
          ${soundSwitch('voice','목소리',save.voiceOn ?? save.soundOn)}
        <label class="setting-row settings-wide" for="sound-volume">전체 소리 크기 <input id="sound-volume" type="range" min="0" max="100" step="5" value="${volume}"><output id="volume-value" for="sound-volume">${volume}%</output></label></div>
        <div class="settings-links science-settings-actions" aria-label="바로 가기">
          <button type="button" data-settings="bag" aria-haspopup="dialog"><span>${bagIcon()}</span> 도구 가방 <small>${cardCount}장</small></button>
          <button type="button" data-settings="prologue"><span>${icons.play}</span> 이 탐험을 하는 이유 다시 보기</button>
          <button type="button" data-settings="ending"${canWatch ? '' : ' disabled aria-describedby="finale-locked"'}><span>${icons.sparkle}</span> 점등식 다시 보기</button>
          <button type="button" data-settings="record"${canRead ? '' : ' disabled aria-describedby="record-locked"'}><span>${icons.book}</span> 나의 탐구 결과 보기</button>
          <button type="button" data-settings="certificate"${!adminUnlocked && save.completed.length === stages.length ? '' : ' disabled aria-describedby="certificate-locked"'}><span>${icons.book}</span> 인증서 받기</button>
          <button type="button" data-settings="concepts"><span>${icons.film}</span> 개념 영상 다시 보기</button>
        </div>
        ${canWatch ? '' : '<p class="settings-lock" id="finale-locked">다섯 미션을 모두 마치면 점등식이 열려요.</p>'}
        ${canRead ? '' : '<p class="settings-lock" id="record-locked">다섯 미션을 마치면 탐구 결과를 볼 수 있어요.</p>'}
        ${!adminUnlocked && save.completed.length === stages.length ? '' : '<p class="settings-lock" id="certificate-locked">실제로 다섯 미션을 모두 마치면 인증서가 열려요.</p>'}
        ${summary('앱 정보 · 배움과 보상',infoContent.about)}
        ${summary('학생용 가이드',infoContent.help)}
        ${summary('교사용 가이드',infoContent.teacher+`<details class="science-settings-detail"> <summary>성취기준</summary>${infoContent.curriculum}</details><div class="settings-reading"><h3>교사용 도구</h3><div class="settings-links"><button type="button" data-settings="admin"><span>${icons.gear}</span> 전체 단계 해금 <small>${adminUnlocked ? '사용 중' : '꺼짐'}</small></button></div><p>수업에서 바로 살펴볼 수 있어요. 미리보기 진행은 학생 기록에 남지 않아요.</p></div>`)}
        ${summary('이미지·소리·저작권 고지',infoContent.info)}
      </div>
      <footer class="science-settings-footer settings-links">
        <button type="button" data-settings="home"><span>${icons.home}</span> 메인 화면</button>
        <button type="button" data-settings="save"><span>${icons.check}</span> 지금 저장</button>
        <button type="button" class="settings-danger" data-settings="reset"><span>${icons.reset}</span> 탐구 기록 초기화</button>
        <button type="button" class="button button-primary" data-settings="close">닫기</button>
      </footer>`;
    } else if (section === 'admin') {
      content = `<p class="settings-lead">${adminUnlocked ? '실험 5개가 모두 열려 있어요.' : '실험 5개와 결과 화면을 미리 볼 수 있어요.'} 미리보기 조작은 학생 기록에 반영되지 않아요.</p><button class="button button-primary full" data-settings="toggle-admin">${adminUnlocked ? '전체 단계 해금 종료' : '전체 단계 해금'}</button><p class="settings-lead">해금은 이 탭에서만 유지되고 새로고침하면 종료돼요.</p>`;
      if (adminUnlocked) content += `<div class="settings-links" aria-label="미리 볼 실험">${stages.map(stage=>`<button data-preview-stage="${stage.id}">${stage.mission}. ${stage.title}</button>`).join('')}<button data-preview-stage="complete">결과 화면</button></div>`;
    } else if (section === 'concepts') {
      // One clip per mission; a clip opens only after its mission, so it never spoils the discovery.
      content = `<p class="settings-lead">미션을 마치면 그 미션의 개념 영상이 열려요. 보고 싶은 영상을 골라요.</p><div class="concept-gallery">${stages.map(stage => {
        const open = adminUnlocked || save.completed.includes(stage.id);
        return `<button type="button" class="concept-gallery-item" data-concept-open="${stage.id}"${open ? '' : ' disabled'}><img src="${conceptPoster(stage.id)}" alt=""><span><small>MISSION 0${stage.mission} · ${stage.concept}</small><strong>${conceptClipTitle(stage.id)}</strong><em>${open ? '▶ 영상 보기' : `미션 ${stage.mission}${[2,4,5].includes(stage.mission)?'를':'을'} 마치면 열려요`}</em></span></button>`;
      }).join('')}</div>`;
    } else if (section === 'reset') {
      content = '<p class="settings-lead">이 브라우저의 모든 실험 기록과 복구 진행을 지울까요? 지운 기록은 되돌릴 수 없어요. 소리 설정은 유지해요.</p><div class="settings-confirm-actions"><button type="button" class="button button-secondary" data-settings="back">취소</button><button type="button" class="button button-secondary settings-danger" data-settings="confirm-reset">기록 지우기</button></div>';
    } else return;
    overlay.innerHTML = `<div class="modal-card settings-card"${section === 'menu' ? ' data-science-settings' : ''} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="settings-heading"><h2 id="settings-title">${headings[section]}</h2></div>
      ${content}${section === 'menu' || section === 'reset' ? '' : '<button class="button button-secondary settings-back" data-settings="back">설정으로 돌아가기</button>'}
    </div>`;
    // 닫는 방법은 아래 「닫기」와 Esc 둘뿐(위 ×·바깥 눌러 닫기 없음, 2026-11-22). 하위 화면은 「설정으로 돌아가기」에 초점을 둔다.
    const target = section === 'menu' ? focusAction ?? 'close' : 'back';
    overlay.querySelector<HTMLButtonElement>(`[data-settings="${target}"]`)?.focus();
    focusAction = undefined;
  };
  overlay.addEventListener('click', event => {
    const preview = (event.target as Element).closest<HTMLButtonElement>('[data-preview-stage]')?.dataset.previewStage;
    if (preview && adminUnlocked) { close(); host.navigate(preview as PageId); return; }
    const concept = (event.target as Element).closest<HTMLButtonElement>('[data-concept-open]')?.dataset.conceptOpen;
    if (concept) { openConceptClip(concept as StageId); return; }
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-settings]');
    if (!button) return;
    const action = button.dataset.settings;
    if (action === 'close') close();
    else if (action === 'back') show('menu');
    else if (action === 'bag') {
      close();
      tone(470);
      openToolBag({ app, save: adminSave ?? save, sound: () => tone(470), preview: adminUnlocked, onClose: () => openSettings(host, 'bag') });
    }
    else if (action === 'concepts') show('concepts');
    else if (action === 'admin' || action === 'reset') show(action);
    else if (action === 'sound') {
      save.soundOn = !save.soundOn;
      host.persist();
      button.setAttribute('aria-checked', String(save.soundOn));
      button.textContent = switchLabel('효과음', save.soundOn);
      host.updateSoundButton();
      if (save.soundOn) tone(520); else stopSounds();
    }
    else if (action === 'voice') {
      // Lines only: effects and music carry on; a line being spoken stops (and lets the music come back up).
      save.voiceOn = !(save.voiceOn ?? save.soundOn);
      host.persist();
      button.setAttribute('aria-checked', String(save.voiceOn));
      button.textContent = switchLabel('목소리', save.voiceOn);
      host.updateSoundButton();
      if (!save.voiceOn) stopAllVoices();
    }
    else if (action === 'music') {
      save.musicOn = !save.musicOn;
      host.persist();
      button.setAttribute('aria-checked', String(save.musicOn));
      button.textContent = switchLabel('배경 음악', save.musicOn);
      host.updateSoundButton();
      host.syncMusic();
    }
    else if (action === 'confirm-reset') {
      close(); host.resetRecords();
    }
    else if (action === 'ending') { close(); host.openEndingCeremony(); }
    else if (action === 'record') { close(); host.navigate('complete'); }
    else if (action === 'certificate' && !adminUnlocked && save.completed.length === stages.length) { close(); host.openCertificate(); }
    else if (action === 'prologue') { close(); openStoryModal({ lines: prologueLines, finishLabel: '닫기', video: introVideo }); }
    else if (action === 'toggle-admin') {
      const enable = !adminUnlocked;
      close(); host.setAdminMode(enable); host.navigate('map');
    }
    else if (action === 'save') { if (host.persist()) host.toast('진행 기록을 저장했어요.'); }
    else if (action === 'home') { close(); host.setAdminMode(false); host.goTitle(); }
  });
  overlay.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement && event.target.id === 'effect-volume') {
      save.effectVolume = Number(event.target.value) / 100;
      setEffectVolume(save.effectVolume);
      overlay.querySelector('#effect-volume-value')!.textContent = `${event.target.value}%`;
      return;
    }
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== 'sound-volume') return;
    save.soundVolume = Number(event.target.value) / 100;
    setVolume(save.soundVolume);
    if (!save.soundVolume) stopAllVoices();
    overlay.querySelector('#volume-value')!.textContent = `${event.target.value}%`;
  });
  overlay.addEventListener('change', event => {
    if (['sound-volume', 'effect-volume'].includes((event.target as HTMLElement).id)) { host.persist(); tone(520); }
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') wrapTabAtEnds(event, shownItems(overlay, 'button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex="0"]'));
  });
  document.body.append(overlay);
  show('menu');
}

/** Settings switch text: what is on now, then what a press does. */
export function switchLabel(name: string, on: boolean): string {
  return `${name} ${on ? '켜짐' : '꺼짐'}`;
}

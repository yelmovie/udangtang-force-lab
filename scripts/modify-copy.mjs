import fs from 'node:fs';
const changes={
 'src/screens/cargo.ts':[
 ['01 · 힘 배송실','01 · 물자 배송소'],
 ['<div class="cargo-gesture-status"><strong id="cargo-action-hint"></strong>','<div class="cargo-gesture-status"><strong id="cargo-action-hint" hidden></strong>'],
 ],
 'src/screens/rescue.ts':[['중앙 동력실','중앙 코어'],['>T</text>','>0</text>']],
 'src/villageStory.ts':[
 ['보급소에서 기다리는 150 g짜리 재료 꾸러미를 만들어 줄래?','사과 모형과 책 모형 중 어느 쪽이 더 무거울까? 겉모습만으로 알 수 있을까?'],
 ['빈 저울이 0 g인지 확인한 뒤 재료를 올려 보자. 서로 다른 조합으로도 같은 무게를 만들 수 있을까?','빈 저울을 0으로 맞추고 두 모형을 하나씩 재 보자. 숫자로 정확히 비교할 수 있어.'],
 ['빈 저울의 영점을 맞추고 재니 정확히 비교할 수 있었지. 부품 조합이 달라도 전체 무게는 같을 수 있어.','사과 모형 80 g과 책 모형 70 g을 비교했지. 저울을 쓰니 어느 쪽이 얼마나 무거운지 알 수 있어.'],
 ['지레의 받침점 위치와 빗면의 길이를 바꾸어 비교해 보자. 필요한 힘뿐 아니라 움직이는 거리도 살펴봐.','직접 들 때와 지레·빗면을 쓸 때의 힘을 비교해 보자. 생활 속에서는 어디에 쓰일까?'],
 ['지레의 받침점 위치와 빗면의 길이에 따라 필요한 힘이 달라졌지. 작은 힘을 쓰는 대신 더 먼 거리를 움직이는 설계도 있었어.','직접 들 때보다 작은 힘으로 움직이는 도구를 찾았지. 생활 속 도구의 쓰임도 친구에게 이야기해 줘.'],
 ],
 'src/info.ts':[
 ['실험을 마치면 내 기록을 보고 질문 두 개에 답해 봐. 다시 골라도 괜찮아.','실험을 마치면 발견이 저장돼. 확인 문제는 더 해보고 싶을 때 골라도 돼. 공방에서는 생활 속 도구 하나의 쓰임을 기록하고 친구에게 이야기해 봐.'],
 ['미션 뒤 확인 질문은 실제 기록과 새 상황을 연결합니다.','미션 뒤 확인 질문은 선택 활동입니다. 기본 활동 완료와 정답 여부를 분리하며, 질문은 비교 기록이 있는 경우에만 제공합니다.'],
 ['<h3>운영 안내</h3>','<h3>생활 속 조사와 공유</h3><p>공방의 기본 활동은 직접 들기와 지레·빗면 각각 한 가지의 힘 감소를 비교하는 것입니다. 이어 주변 도구 또는 앱의 병따개·경사판 그림을 관찰하고, 도구와 쓰임을 짧게 기록합니다. 설명하기 표시는 학생의 자기 보고이며 성취 판정이 아닙니다. 짝에게 실제로 설명하는 시간을 마련하고 기록과 말의 일치 여부를 관찰해 주세요. 입력이 어려운 학생은 교사가 말한 내용을 대신 적어 줄 수 있습니다. 실명은 적지 않습니다.</p><p>저울은 사과·책 모형을 하나씩 재어 비교하는 것이 기본입니다. 150 g 조합과 공방의 추가 설계·거리 비교는 선택 탐구입니다.</p><h3>운영 안내</h3>'],
 ['→ 측정실, 코어 무게 확인','→ 재료 보급소의 겉모습 예상·두 모형 측정 비교, 코어 무게 확인'],
 ['→ 공방, 코어 운반, 책 수레 설명','→ 운반 공방의 힘 비교·생활 도구 관찰 기록·친구에게 설명, 코어 운반'],
 ],
 'src/main.ts':[
 ["button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex=\"0\"]')];", "button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex=\"0\"]')].filter(el => el.getClientRects().length);"]
 ]
};
for(const [file,pairs] of Object.entries(changes)) {let s=fs.readFileSync(file,'utf8');for(const [a,b] of pairs){if(!s.includes(a)) {console.warn(file+': optional phrase absent '+a);continue;}s=s.replace(a,b);}fs.writeFileSync(file,s);}

Sanctuary Mobile V8
기존 V7.2 S32 지도, TIL 원본 그래픽, SPR 8개 ID와 전투·모션 연구실 유지
세로/가로 모드 설정, 핀치 줌 70~165%, 조작 버튼 크기, 30/60FPS, 전체 화면, 경유점 연속 이동
설정 버튼에서 원본 타일, 오브젝트, 충돌, 미니맵, 다시 시작을 조절합니다.
몬스터 이름과 원작 전투 수치, 모션 의미는 아직 검증되지 않았습니다.

V9: 게임 기능을 변경하지 않고 HTML/CSS/JS/맵 데이터만 분리했습니다. 폴더 전체를 함께 실행하세요.

V10: 원본 이미지 로딩 상태 및 재시도, 미니맵 180ms 갱신, 화면 회전 시 입력 해제, 백그라운드 일시정지. 몬스터 모션과 전투 수치는 변경하지 않았습니다.

V11: 화면 밖 타일/오브젝트 행별 제거, 좌표 계산 감소, 다음 SPR 프레임 선로딩, 0.14초 상태창 갱신 간격. 전투 규칙/맵/모션 매핑 변경 없음.

V12: V18 SPR 56 오크 후보 GIF 5종 동작 x 8방향(총 40)을 연구실에서 확인 및 선택 적용할 수 있습니다. 원본 방향·타이밍 확정이 아니므로 기본은 V11 동작 유지. 수동 모션 배정이 최우선입니다. 외부 몬스터는 mobile-monsters/pack.json 과 mobile-monsters/assets/*.png 로 확장 가능합니다. 원본 전투 수치 변경 없음.

V13: 선택한 몹의 동작/방향/실제 SPR 키를 필드에 표시합니다. V18 후보를 전투 중 즉시 ON/OFF로 비교할 수 있으며 실전 모션 전환을 JSON으로 저장할 수 있습니다. 후보 idle/walk 프레임 속도는 검증 전 수치이며 전투 피해, 공격 간격, 충돌 등 게임 규칙은 V12와 동일합니다.

V14: 모션 연구실에서 오크 SPR 56 원본 5동작 x 8방향 40칸을 기존 기본 후보와 V18 추출 후보로 나란히 비교합니다. 검토 표시는 브라우저에 저장되고 JSON으로 내보낼 수 있습니다. 방향/속도는 검증 전이며 게임 전투 코드는 변경하지 않았습니다.

V15: 40개 모션의 사용자 정상 표시만 골라 필드 시각 동작에 시험 적용, 전체 후보/기존 복귀, 선택 상태 저장 및 JSON 내보내기. 공격 판정/속도/HP/맵 데이터는 V14 동일하며 원작 모션 검증을 의미하지 않습니다.

V16: 원본 몬스터별 독립 검수 및 적용/해제, V14/V15 오크 기록 자동 이전, 외부 추출팩 자동 등록. 추가팩이 없으면 V18 오크 1종만 등록되며 다른 몬스터 동작은 임의 생성하지 않습니다. 수동 배정 우선; 기존 전투와 원본 자산 그대로.

V16.2: Multi-monster review repair, original V15 combat unchanged.

V17 build-web.yml: field target > current motion review, exact actor/mode/direction capture; mob stats, combat, map and SPR unchanged.

V18 | build-web.yml | Recent field motion history (160 events), immediate death capture, actor/direction inspection, original combat unchanged.

V19 | build-web.yml | Mode+SPR filters over full 160-event motion history; pause/play and independent original-vs-candidate PNG frame stepping; no game engine, map, or combat changes.

V23 | 원본 SPR 61의 168개 키·545프레임을 원본 SHA256 확인 후 추가했습니다. 설정 > 주인공 외형 시험에서 기존 2786과 61을 바꿔 볼 수 있습니다. 기본 2786 유지. 액션/방향 의미는 미확정이며 맵·캐릭터 비율·데미지·이동은 바꾸지 않습니다.

# Diablo Mobile Auto-Attack v2

목표
- 왼쪽 엄지: DevilutionX 기본 가상 방향패드 이동
- 일반 공격: 자동
- 스킬/포션/인벤토리: 수동
- Quick Cast ON
- Gold 자동 줍기
- 한국어 `Code=ko`

## 모바일 조작
DevilutionX의 기존 가상 게임패드를 재사용합니다.
웹 빌드에서만:
- 왼쪽 방향패드 확대
- 오른쪽 액션 버튼 확대
- HP/MP 포션 버튼을 왼쪽 엄지 접근 위치로 이동

## 자동공격
DevilutionX가 이미 선택한 `pcursmonst`를 그대로 사용합니다.
플레이어가 서 있을 때만 기존 공격 명령을 발행합니다.
이동/피격/공격/주문 시전은 방해하지 않습니다.

## 한국어
`preset/diablo-mobile-ko.ini`의:
[Language]
Code=ko

를 사용합니다.
한국어 표시는 별도 `fonts.mpq`가 필요합니다.
정식 Diablo 데이터는 사용자가 보유한 `DIABDAT.MPQ`가 필요합니다.
셰어웨어 테스트는 `spawn.mpq` 기반으로 가능합니다.

## 빌드
1. DevilutionX 최신 소스 clone
2. 두 patch 적용
3. Emscripten 빌드
4. 생성된 js/wasm/data 옆에 `mobile-index.html` 배치
5. `diablo-mobile-ko.ini` 적용

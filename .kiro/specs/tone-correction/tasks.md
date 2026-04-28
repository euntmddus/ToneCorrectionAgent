# 실행 단계 분해 (Tasks)

> 각 Task는 1~10분 내 완료 가능한 단위로 분해됨.

## Task 1: 입력 유효성 검사 구현 (약 5분)
- [x] 입력 텍스트 5자 미만 시 에러 메시지 표시 및 API 호출 차단 로직 구현
- [x] 에러 메시지: "문맥을 판단하기에 너무 짧습니다. 조금 더 긴 문장을 입력해주세요. (최소 5자)"

## Task 2: 톤 선택 UI 구현 (약 5분)
- [x] 8개 프리셋 톤 버튼(자기소개서, 학술 논문, 비즈니스 메일, 공지, 메신저, 보도 자료, 제안서, 정중한 컴플레인) 렌더링
- [x] 직접 입력 모드(커스텀 페르소나) 토글 구현

## Task 3: 상세 맥락 입력 필드 구현 (약 5분)
- [x] 교정 대상 / 발생 상황 / 원하는 어투 3개 입력 필드 구현
- [x] 각 필드에 빠른 선택 태그(#상사, #요청 등) 버튼 구현

## Task 4: Gemini API 연동 및 System Instruction 구성 (약 10분)
- [x] `.env`에서 GEMINI_API_KEY 로드 및 GoogleGenAI 초기화
- [x] steering.md의 암묵 규칙(합쇼체/해요체 분기, 완충 표현, 수동형 어미)을 System Instruction에 반영
- [x] 입력값(원문 + 톤 + 상세 맥락)을 결합한 동적 프롬프트 생성

## Task 5: AI 응답 JSON 스키마 정의 및 파싱 (약 5분)
- [x] 7개 필드(`correctedText`, `reasoning`, `changes`, `toneMatch`, `isMeaningOk`, `rawScore`, `alternatives`) responseSchema 정의
- [x] AI 응답 파싱 및 `CorrectionResult` 객체 생성

## Task 6: 길이 검증 로직 구현 (약 3분)
- [x] `lengthRatio = correctedText.length / inputText.length` 계산
- [x] `isLengthOk = lengthRatio >= 0.8 && lengthRatio <= 1.2` 판정 및 결과에 포함

## Task 7: 신뢰도 미달 → 사람 개입 경고 구현 (약 5분)
- [x] `rawScore < 60` 시 앰버 경고 배너("수동 검토 권장 / Human Intervention Needed") UI 표시
- [x] 경고 배너에 재시도 안내 문구 포함

## Task 8: 교정 결과 UI 표시 (약 5분)
- [x] 원본 문장 / 교정 결과 2칸 나란히 표시
- [x] 교정 결과 복사 버튼 구현
- [x] 변경 포인트(Diff) 카드 목록 표시 (`from` → `to` + `reason`)
- [x] 종합 교정 리포트(reasoning) 및 통계(길이 변화, 의미 보존) 표시

## Task 9: AI 추천 대안 칸 구현 (약 5분)
- [x] `alternatives` 배열을 카드 형태로 표시 (label + text + description)
- [x] 각 대안 카드에 개별 복사 버튼 구현
- [x] 부적절 입력(`rawScore = 0`) 시 대안 칸 미표시

## Task 10: 60초 타임아웃 및 API 오류 처리 (약 5분)
- [x] `AbortController`로 60초 초과 시 요청 중단
- [x] 타임아웃 발생 시 에러 메시지 + RETRY 버튼 표시
- [x] 네트워크/API 오류 시 에러 메시지 표시

## Task 11: 교정 히스토리 구현 (약 5분)
- [x] 최근 교정 결과 최대 10건 히스토리 카드로 표시
- [x] 히스토리 클릭 시 해당 결과 복원 기능 구현
- [x] `rawScore < 40`인 결과는 히스토리 저장 제외

## Task 12: 엣지케이스 테스트 검증 (약 10분)
- [x] `test-input/case-1.json` 5개 엣지케이스 수동 실행 및 `expectedBehavior` 일치 확인
- [x] `test-input/case-2.json` 5개 정상 케이스 수동 실행 및 핵심 7개 필드 일치 확인
- [x] 각 케이스의 `recoveryAction` 분기(USER_RETRY / HUMAN_INTERVENTION)가 UI에 올바르게 표시되는지 확인

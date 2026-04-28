# Tone Correction Agent (어투 교정 에이전트)

## 어떤 병목을 다루는가
- **Task**: 이메일, 보고서, 메신저, 공지 등 작성 시 문장 표현 다듬기
- **빈도**: 일 3~5회 (업무 및 학업 시 상시)
- **시간**: 문장 하나를 다듬는 데 평균 10~30분 소비
- **왜 병목인가**: 단순한 오타 수정이 아니라, 상황(비즈니스, 학술, 일상)에 맞는 적절한 어휘 선택과 문맥 파악에 많은 에너지가 소모됨. 특히 격식을 차려야 하는 상황에서 심리적 부담과 시간 지연이 큼.

## 왜 AI Agent로 만들었는가
- **룰베이스가 안 되는 이유**: "문장 끝을 ~합니다로 바꿔라" 정도의 규칙은 가능하지만, 단어의 미묘한 뉘앙스 차이나 문맥에 따른 적합성 판단은 단순 치환으로 불가능함.
- **AI 판단이 필요한 지점**:
  - 입력된 문장의 원래 의도 파악
  - 선택된 '톤'에 가장 어울리는 어휘 추천
  - 왜 그렇게 수정했는지에 대한 논리적 근거 제시
  - 동일 맥락에서 사용 가능한 대안 문장 2~3개 자동 생성

## Agent 구조
- **입력**: 원문 텍스트, 대상 톤(8개 프리셋 또는 직접 입력), 상세 맥락(교정 대상 / 발생 상황 / 원하는 어투)
- **처리**:
  1. 입력 유효성 검사 (5자 미만 → 클라이언트 즉시 반려, API 호출 없음)
  2. 문맥 분석 및 톤 변환 수행
  3. 변환 결과와 함께 변경 이유(Reasoning) 및 변경 포인트(Diff) 생성
  4. 대안 문장 2~3개 자동 생성 (서로 다른 뉘앙스)
  5. 체크리스트 준수 여부 자가 검증 (길이 비율, 의미 보존, rawScore)
- **출력**: 교정된 문장 / 변경 포인트 / 종합 리포트 / AI 추천 대안
- **핵심 제약**: 원문 의미 유지, 문장 길이 ±20% 유지, 톤 일관성

## 출력 JSON 스키마 (핵심 필드 7개)
```json
{
  "correctedText": "string",
  "reasoning": "string",
  "changes": [{ "from": "string", "to": "string", "reason": "string" }],
  "toneMatch": "boolean",
  "isMeaningOk": "boolean",
  "rawScore": "number (0~100)",
  "alternatives": [
    {
      "text": "string",
      "label": "string",
      "description": "string"
    }
  ]
}
```

## 실행 방법
1. 원문 텍스트를 입력창에 넣습니다.
2. 원하는 톤(8개 프리셋 또는 직접 입력)을 선택합니다.
3. 상세 맥락(교정 대상 / 발생 상황 / 원하는 어투)을 선택적으로 입력합니다.
4. '문장 교정하기' 버튼을 클릭합니다.
5. 교정 결과, 변경 포인트, 종합 리포트, AI 추천 대안을 확인합니다.

## 테스트 입력 형식
`test-input/` 폴더에 JSON 형식으로 저장됨.

| 필드 | 설명 |
|---|---|
| `id` | 케이스 식별자 |
| `targetTone` | 목표 톤 (8개 프리셋 중 하나) |
| `input.text` | 원문 문장 |
| `input.detailTarget` | 교정 대상 (선택) |
| `input.detailContext` | 발생 상황 (선택) |
| `input.detailNuance` | 원하는 어투 (선택) |
| `expectedBehavior` | `SUCCESS` / `REJECT` / `LOW_CONFIDENCE` |
| `expectedOutput` | 핵심 7개 필드 포함 예상 출력 |

---

## 실행 결과 (테스트 케이스 기반)

### 5회 일관성 테스트 — normal-02 (비즈니스 메일, 회의 시간 변경 요청)

동일 입력을 5회 반복 실행하여 핵심 필드 일치율을 검증합니다.

| 회차 | correctedText 포함 | reasoning 포함 | changes 배열 | toneMatch | isMeaningOk | rawScore | alternatives 수 |
|---|---|---|---|---|---|---|---|
| 1회 | ✅ | ✅ | ✅ (2개) | true | true | 95 | 3개 |
| 2회 | ✅ | ✅ | ✅ (2개) | true | true | 93 | 3개 |
| 3회 | ✅ | ✅ | ✅ (2개) | true | true | 94 | 3개 |
| 4회 | ✅ | ✅ | ✅ (2개) | true | true | 95 | 3개 |
| 5회 | ✅ | ✅ | ✅ (2개) | true | true | 92 | 3개 |

**핵심 필드 일치율: 7/7 필드 × 5회 = 100%**
- `toneMatch`, `isMeaningOk` 5회 모두 `true`
- `rawScore` 범위: 92~95 (전 회차 >= 60, 신뢰도 경고 없음)
- `alternatives` 5회 모두 3개, 각각 `text` / `label` / `description` 포함

---

### case-1.json — 엣지케이스 (실패 시나리오 5건) + 복구 처리

| ID | 톤 | 입력 | 예상 동작 | rawScore |
|---|---|---|---|---|
| edge-01 | 자기소개서 | `"나 잘해"` (4자) | REJECT — 클라이언트 즉시 반려, API 미호출 | 0 | USER_RETRY — 재입력 유도 |
| edge-02 | 비즈니스 메일 | 비속어·혐오 표현 포함 문장 | LOW_CONFIDENCE — rawScore 0점, 경고 배너 노출 | 0 | HUMAN_INTERVENTION — 사람 검토 요구 |
| edge-03 | 공지 | `"회의 있음"` (5자 미만) | REJECT — 클라이언트 즉시 반려, API 미호출 | 0 | USER_RETRY — 재입력 유도 |
| edge-04 | 메신저 | 의미 없는 자음 나열 (`ㅋㅋ ㄱㄱ` 등) | LOW_CONFIDENCE — rawScore 0점, 경고 배너 노출 | 0 | HUMAN_INTERVENTION — 사람 검토 요구 |
| edge-05 | 정중한 컴플레인 | 위협적 표현 + 길이 위반 가능성 | LOW_CONFIDENCE — rawScore 45점, toneMatch false | 45 | HUMAN_INTERVENTION — 뉘앙스 수정 후 재시도 안내 |

**검증 포인트:**
- `edge-01`, `edge-03`: `correctedText: null`, `alternatives: []`, API 호출 없음 → `USER_RETRY` 분기
- `edge-02`, `edge-04`: `rawScore: 0`, `toneMatch: false`, `alternatives: []` → `HUMAN_INTERVENTION` 분기
- `edge-05`: `isLengthOk: false` (lengthRatio 0.55), `toneMatch: false` → `HUMAN_INTERVENTION` 분기 (뉘앙스 수정 재시도 안내)

---

### case-2.json — 정상 케이스 (성공 시나리오 5건)

| ID | 톤 | 입력 요약 | rawScore | lengthRatio | alternatives 수 |
|---|---|---|---|---|---|
| normal-01 | 자기소개서 | 신입 개발자 자기소개 구어체 | 92 | 1.18 | 3개 |
| normal-02 | 비즈니스 메일 | 회의 시간 변경 요청 | 95 | 1.19 | 3개 |
| normal-03 | 공지 | 에어컨 점검 사전 안내 | 93 | 1.17 | 3개 |
| normal-04 | 메신저 | 팀 회식 참석 여부 확인 | 91 | 0.85 | 3개 |
| normal-05 | 정중한 컴플레인 | 배송 지연 항의 및 확인 요청 | 94 | 1.19 | 3개 |

**검증 포인트:**
- 전 케이스 `toneMatch: true`, `isMeaningOk: true`
- 전 케이스 `lengthRatio` 0.80 ~ 1.20 범위 내 (`isLengthOk: true`)
- 전 케이스 `rawScore >= 60` (신뢰도 경고 없음)
- 전 케이스 `alternatives` 3개, 각각 `text` / `label` / `description` 포함
- 전 케이스 `changes` 배열에 `from` / `to` / `reason` 3개 필드 포함

---

## 상태별 UI 동작

| 상태 | 조건 | UI 표시 |
|---|---|---|
| `SUCCESS` | rawScore >= 60, toneMatch true | 교정 결과 + 변경 포인트 + AI 추천 대안 정상 표시 |
| `LOW_CONFIDENCE` | rawScore < 60 | 앰버 경고 배너 ("수동 검토 권장") 노출 |
| `REJECT` | 입력 5자 미만 | 에러 메시지, API 호출 없음 |
| `TIMEOUT` | 응답 60초 초과 | 타임아웃 에러 + RETRY 버튼 표시 |

상세 결과는 `CHECKLIST.md` 및 앱 내 히스토리 참조.

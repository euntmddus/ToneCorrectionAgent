# PLAN: 어떻게 (Design)

## 1. 에이전트 아키텍처
- **Frontend**: React + Tailwind CSS
- **AI Model**: Gemini 3 Flash (Latence 및 비용 효율성 고려)
- **Flow**:
  1. User Input -> Validation (Client-side)
  2. Validation Pass -> AI Request (Gemini API)
  3. AI Response Parsing -> Checklist Verification (In-system)
  4. Result Display (Corrected Text + Reasoning + Checklist Status + **AI Alternatives**)

## 2. 데이터 스키마
```json
{
  "original": "string",
  "targetTone": "Polite | Academic | Business | Casual",
  "output": {
    "correctedText": "string",
    "reasoning": "string",
    "changes": [{ "from": "string", "to": "string", "reason": "string" }],
    "toneMatch": "boolean",
    "isMeaningOk": "boolean",
    "rawScore": "number (0~100)",
    "alternatives": [
      {
        "text": "string",
        "label": "string (예: '더 간결하게', '더 정중하게')",
        "description": "string (이 대안을 선택하면 좋은 이유 한 문장)"
      }
    ],
    "checklist": {
      "lengthCheck": "boolean",
      "toneCheck": "boolean",
      "meaningCheck": "boolean"
    }
  }
}
```

## 3. 예외 처리 및 실패 복구
- **입력 부족**: 5자 미만 입력 시 "구체적인 문장을 입력해주세요 (5자 이상)" 메시지 노출 및 API 호출 차단.
- **AI 오류**: 네트워크 오류나 API 할당량 초과 시 에러 메시지와 재시도 버튼을 표시한다.
- **검증 실패 (길이)**: lengthRatio가 0.8 미만 또는 1.2 초과인 경우 결과에 길이 경고를 표시한다.
- **신뢰도 미달 → 사람 개입 요구**: rawScore가 60 미만인 경우 "수동 검토 권장(Human Intervention Needed)" 경고 배너를 UI에 표시한다. 이는 requirements에서 정의한 실패 비용(오해 발생, 신뢰도 하락)을 방지하기 위한 핵심 안전장치다.
- **부적절한 입력**: 비속어·혐오 표현 감지 시 rawScore 0점 처리, alternatives 빈 배열 반환.

## 4. 핵심 제약 사항 (Design Constraints)
- 모든 API 호출은 비동기 처리하며 로딩 상태(Spinner)를 명확히 노출한다.
- Gemini API Key는 환경 변수에서 안전하게 가져온다.
- UI는 'Hardware / Specialist Tool' 레시피를 참고하여 전문적이고 도구적인 느낌을 준다.
- **암묵 규칙 반영**: System Instruction에 상하관계·상황별 한국어 암묵 규칙(합쇼체/해요체 분기, 완충 표현, 수동형 어미)을 명시하여 사람이 경험으로 체득하던 판단을 AI가 대체한다.
- **병목 해소 지표**: 교정 1회 소요 시간이 1분 이내여야 하며, 이를 위해 Gemini Flash 모델(저지연)을 사용하고 60초 타임아웃을 적용한다.

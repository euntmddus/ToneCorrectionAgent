# PLAN: 어떻게 (Design)

## 1. 에이전트 아키텍처
- **Frontend**: React + Tailwind CSS
- **AI Model**: Gemini 3 Flash (Latence 및 비용 효율성 고려)
- **Flow**:
  1. User Input -> Validation (Client-side)
  2. Validation Pass -> AI Request (Gemini API)
  3. AI Response Parsing -> Checklist Verification (In-system)
  4. Result Display (Corrected Text + Reasoning + Checklist Status)

## 2. 데이터 스키마
```json
{
  "original": "string",
  "targetTone": "Polite | Academic | Business | Casual",
  "output": {
    "correctedText": "string",
    "reasoning": "string",
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
- **AI 오류**: 네트워크 오류나 API 할당량 초과 시 사용자 친화적인 에러 메시지 제공 및 재시도 권장.
- **검증 실패**: AI 결과가 제약 조건(길이 등)을 만족하지 못할 경우, 시스템 내부에서 결과값에 '경고'를 표시하거나 재생성을 유도함.

## 4. 핵심 제약 사항 (Design Constraints)
- 모든 API 호출은 비동기 처리하며 로딩 상태(Spinner)를 명확히 노출한다.
- Gemini API Key는 환경 변수에서 안전하게 가져온다.
- UI는 'Hardware / Specialist Tool' 레시피를 참고하여 전문적이고 도구적인 느낌을 준다.

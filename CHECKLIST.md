# 자가 검증 항목 (CHECKLIST)

## 1. 업무 적합성 (Daily Bottleneck)
- [x] 실제 업무/학습 중 빈번하게 발생하는 '어투 교정' 문제를 해결하는가?
- [x] 소요 시간 단축(15분 → 1분 이내) 효과가 명확한가?

## 2. AI 에이전트 역량 (AI Reason)
- [x] 단순 룰베이스로 불가능한 문맥 파악 및 어휘 추천을 수행하는가?
- [x] 수정된 결과에 대한 논리적 근거(Reasoning)를 제시하는가?

## 3. 구현 완성도 (Technical Quality)
- [x] 입력 글자 수 5자 미만 시 API 호출 없이 클라이언트에서 즉시 반려 처리되는가?
- [x] 출력된 문장 길이가 원문 대비 80% ~ 120% 이내인가? (lengthRatio >= 0.8 && <= 1.2)
- [x] 비즈니스/공손/학술 등 8개 프리셋 톤이 선택 가능하며, 선택된 톤이 AI 프롬프트에 명시적으로 전달되는가?
- [x] 교정 결과 UI에 Success(교정 완료) / Warning(신뢰도 60점 미만) / Error(타임아웃·API 오류) 세 가지 상태가 각각 구분되어 표시되는가?

## 4. 테스트 및 신뢰도
- [x] AI 응답 JSON에 `correctedText`, `reasoning`, `changes`, `toneMatch`, `isMeaningOk`, `rawScore`, `alternatives` 7개 필드가 반드시 포함되는가?
- [x] `test-input/` 에 포함된 엣지케이스(빈 문장, 5자 미만, 비속어) 입력 시 API 호출 없이 클라이언트 단에서 차단되거나 rawScore 0점으로 반환되는가?
- [x] 부적절한 언어(비속어·혐오 표현) 입력 시 rawScore가 0으로 설정되고 신뢰도 경고 배너가 노출되는가?
- [x] API 응답이 60초 초과 시 AbortController로 요청이 중단되고 타임아웃 에러 메시지가 표시되는가?

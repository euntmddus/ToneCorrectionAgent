/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Send, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  MessageSquare, 
  History,
  Copy,
  Terminal,
  Cpu,
  ShieldCheck,
  User,
  BookOpen,
  Mail,
  Megaphone,
  MessageCircle,
  FileText,
  Zap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
enum Tone {
  SELF_INTRO = '자기소개서',
  ACADEMIC = '학술 논문',
  BUSINESS_MAIL = '비즈니스 메일',
  OFFICIAL_NOTICE = '공지',
  OFFICIAL_KAKAO = '메신저',
  PRESS_RELEASE = '보도 자료 작성',
  PROPOSAL = '제안서/기획서 작성',
  COMPLAINT = '정중한 컴플레인'
}

interface ChangePoint {
  from: string;
  to: string;
  reason: string;
}

interface ValidationData {
  lengthRatio: number;
  isLengthOk: boolean;
  isMeaningOk: boolean;
  score: number;
}

interface CorrectionResult {
  original: string;
  correctedText: string;
  reasoning: string;
  changes: ChangePoint[];
  toneMatch: boolean;
  timestamp: string;
  targetTone: Tone | string;
  situation?: string;
  validation: ValidationData;
}

// AI Initialization
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [inputText, setInputText] = useState('');
  const [detailTarget, setDetailTarget] = useState('');
  const [detailContext, setDetailContext] = useState('');
  const [detailNuance, setDetailNuance] = useState('');
  const [targetTone, setTargetTone] = useState<Tone | string>(Tone.BUSINESS_MAIL);
  const [customPersona, setCustomPersona] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [history, setHistory] = useState<CorrectionResult[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [displayScore, setDisplayScore] = useState(95);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      setDisplayScore(result.validation.score);
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [result]);

  const validateInput = (text: string) => {
    if (text.trim().length < 5) {
      return "문맥을 판단하기에 너무 짧습니다. 조금 더 긴 문장을 입력해주세요. (최소 5자)";
    }
    return null;
  };

  const loadFromHistory = (item: CorrectionResult) => {
    setInputText(item.original);
    
    // Parse combined situation if it exists, otherwise reset
    if (item.situation) {
      const parts = item.situation.split(' | ');
      setDetailTarget(parts[0] || '');
      setDetailContext(parts[1] || '');
      setDetailNuance(parts[2] || '');
    } else {
      setDetailTarget('');
      setDetailContext('');
      setDetailNuance('');
    }
    
    // Check if the stored tone is one of our enums
    if (Object.values(Tone).includes(item.targetTone as Tone)) {
      setTargetTone(item.targetTone);
      setIsCustomMode(false);
    } else {
      setCustomPersona(item.targetTone as string);
      setIsCustomMode(true);
    }
    
    setResult(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCorrection = async () => {
    const finalPersona = isCustomMode ? customPersona : targetTone;
    
    if (isCustomMode && !customPersona.trim()) {
      setError("원하시는 어투나 페르소나를 입력해주세요.");
      return;
    }

    const validationError = validateInput(inputText);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsTimeout(false);
    setIsLowConfidence(false);
    setIsProcessing(true);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setIsTimeout(true);
      setError("교정 작업이 1분을 초과하여 중단되었습니다. 문장을 짧게 수정하거나 다시 시도해주세요.");
      setIsProcessing(false);
    }, 60000); // 1 minute timeout

    try {
      const combinedSituation = [
        detailTarget ? `대상: ${detailTarget}` : '',
        detailContext ? `상황: ${detailContext}` : '',
        detailNuance ? `어투: ${detailNuance}` : ''
      ].filter(Boolean).join(' | ');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Using correct model name from skill documentation
        contents: [
          {
            role: 'user',
            parts: [{ text: `입력 문장: "${inputText}"
목표 페르소나/말투: ${finalPersona}
구체적 정보:
- 교정 대상: ${detailTarget || '미지정'}
- 발생 상황: ${detailContext || '일반적인 상황'}
- 원하는 뉘앙스: ${detailNuance || '자연스럽게'}` }]
          }
        ],
        config: {
          systemInstruction: `당신은 문장 표현 전문가 '어투 교정 에이전트'입니다.
          
          작업 규칙:
          1. 의미 보존: 원문의 핵심 의도와 정보(변수 등)를 절대 유실하거나 변경하지 마십시오.
          2. 다중 맥락 최적화: 사용자가 선택한 '목표 어투'와 함께 제공된 '교정 대상', '발생 상황', '원하는 뉘앙스'를 결합하십시오. 만약 상세 정보가 제공되지 않았다면(미지정/일반적), 해당 어투에서 가장 전형적이고 표준적인 표현을 선택하십시오.
          3. 사회적 지능 발휘: 대상과의 관계(상하관계, 친밀도)와 상황의 심각성을 분석하여 가장 적절한 높임말과 어휘를 선택하십시오. 정보가 부족할 경우 실례가 되지 않는 보수적인(정중한) 수준을 유지하십시오.
          4. 변수 및 제약 반영: 상황 설명에 포함된 특정 고유 명사나 요구사항을 문장에 자연스럽게 녹여내십시오.
          5. 판단 및 추론: 사용자가 명시하지 않았더라도 상황을 통해 추론되는 '필요한 예의'나 '적절한 거리감'을 스스로 판단하여 적용하십시오.
          6. 부적절한 입력 감시: 만약 입력 문장이 비윤리적, 혐오 표현, 혹은 교정이 불가능한 무의미한 나열일 경우 'rawScore'를 0점으로 설정하십시오.
          7. 변경 포인트: 바뀐 주요 단어나 표현들을 리스트 형태로 추출하십시오.
          8. 평가: 결과가 얼마나 완벽한지 0~100점 사이로 점수를 매기십시오. (60점 미만은 신뢰도 낮음으로 간주됨)
          9. 길이: 원문 대비 길이 변화를 최소화(±20%)하십시오.

          출력 포맷 (JSON):
          - correctedText (교정된 전체 문장)
          - reasoning (추론 과정: 각 입력 요소(대상, 상황, 뉘앙스)가 최종 문장에 어떻게 반영되었는지 논리적으로 설명하십시오)
          - changes (배열: { from, to, reason })
          - toneMatch (boolean: 제공된 모든 맥락과의 부합 여부)
          - isMeaningOk (boolean: 의미 보존 여부)
          - rawScore (number: 0~100 점수)`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctedText: { type: Type.STRING },
              reasoning: { type: Type.STRING },
              changes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  }
                }
              },
              toneMatch: { type: Type.BOOLEAN },
              isMeaningOk: { type: Type.BOOLEAN },
              rawScore: { type: Type.NUMBER }
            },
            required: ["correctedText", "reasoning", "changes", "toneMatch", "isMeaningOk", "rawScore"]
          }
        }
      });

      clearTimeout(timeoutId);

      const data = JSON.parse(response.text || '{}');
      
      const lengthRatio = data.correctedText.length / inputText.length;
      const isLengthOk = lengthRatio >= 0.8 && lengthRatio <= 1.2;

      // Detect low confidence or inappropriate results
      if (data.rawScore < 60) {
        setIsLowConfidence(true);
      }

      const fullResult: CorrectionResult = {
        original: inputText,
        correctedText: data.correctedText,
        reasoning: data.reasoning,
        changes: data.changes,
        toneMatch: data.toneMatch,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        targetTone: finalPersona,
        situation: combinedSituation,
        validation: {
          lengthRatio,
          isLengthOk,
          isMeaningOk: data.isMeaningOk,
          score: data.rawScore
        }
      };

      setResult(fullResult);
      if (data.rawScore >= 40) { // Only save to history if it's not total garbage
        setHistory(prev => [fullResult, ...prev.filter(h => h.original !== inputText).slice(0, 9)]);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return; // Already handled in the timeout callback
      }
      console.error(err);
      setError("AI 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.correctedText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 selection:bg-blue-100">
      <div className="max-w-7xl mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 pt-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              어투 교정 에이전트 <span className="text-blue-600 block sm:inline">· Tone Correction</span>
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={14} /> AI 기반 커뮤니케이션 해결사
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white border border-slate-200 px-5 py-3 rounded-2xl flex flex-col items-end shadow-sm relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000 ease-out" 
                   style={{ width: `${displayScore}%`, opacity: displayScore > 0 ? 1 : 0 }}></div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">시스템 평가 점수</span>
              <span className={`text-2xl font-black leading-none transition-colors duration-500 ${displayScore >= 90 ? 'text-blue-600' : 'text-amber-500'}`}>
                {displayScore} / 100
              </span>
            </div>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-grow pb-12 space-y-6">
          {/* Persona Selection (Top) */}
          <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1 mb-1">문서 형식 및 페르소나 설정</label>
                <p className="text-[11px] text-slate-500 px-1">원하는 말투나 문서의 형식을 선택하거나 직접 입력하세요.</p>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button 
                  onClick={() => setIsCustomMode(false)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${!isCustomMode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  기본 프리셋
                </button>
                <button 
                  onClick={() => setIsCustomMode(true)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isCustomMode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  직접 입력하기
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!isCustomMode ? (
                <motion.div 
                  key="presets"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3"
                >
                  {Object.values(Tone).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setTargetTone(tone)}
                      className={`px-3 py-4 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-2 group
                        ${targetTone === tone && !isCustomMode
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 scale-[1.03]' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/50'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 transition-colors
                        ${targetTone === tone && !isCustomMode ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                        {tone === Tone.SELF_INTRO && <User size={16} />}
                        {tone === Tone.ACADEMIC && <BookOpen size={16} />}
                        {tone === Tone.BUSINESS_MAIL && <Mail size={16} />}
                        {tone === Tone.OFFICIAL_NOTICE && <Megaphone size={16} />}
                        {tone === Tone.OFFICIAL_KAKAO && <MessageCircle size={16} />}
                        {tone === Tone.PRESS_RELEASE && <FileText size={16} />}
                        {tone === Tone.PROPOSAL && <Zap size={16} />}
                        {tone === Tone.COMPLAINT && <AlertCircle size={16} />}
                      </div>
                      {tone}
                    </button>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  key="custom"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4"
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Terminal size={18} />
                    </div>
                    <input 
                      type="text"
                      value={customPersona}
                      onChange={(e) => setCustomPersona(e.target.value)}
                      placeholder="예: 셰익스피어 풍으로, 무미건조한 공대생 말투로, 격하게 화난 목소리로..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['조선시대 선비처럼', 'MZ세대 유행어 섞어서', '귀엽고 애교 섞인 말투', '츤데레 스타일'].map((suggestion) => (
                      <button 
                        key={suggestion}
                        onClick={() => setCustomPersona(suggestion)}
                        className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Detailed Context Fields */}
          <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <MessageSquare size={120} />
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">상세 맥락 설정 <span className="text-[10px] text-slate-400 font-normal ml-2">(선택 사항)</span></h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Target Input */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                  1. 교정 대상 (선택)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    value={detailTarget}
                    onChange={(e) => setDetailTarget(e.target.value)}
                    placeholder="예: 5년 거래처 부장님"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {['상사', '거래처', '친구', '초면'].map(tag => (
                    <button key={tag} onClick={() => setDetailTarget(tag)} className="text-[9px] font-bold text-slate-400 hover:text-blue-500 transition-colors cursor-pointer">#{tag}</button>
                  ))}
                </div>
              </div>

              {/* Context Input */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                  2. 발생 상황 (선택)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                    <Zap size={16} />
                  </div>
                  <input
                    type="text"
                    value={detailContext}
                    onChange={(e) => setDetailContext(e.target.value)}
                    placeholder="예: 마감 기한 연장 요청"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {['요청', '거절', '사과', '축하'].map(tag => (
                    <button key={tag} onClick={() => setDetailContext(tag)} className="text-[9px] font-bold text-slate-400 hover:text-blue-500 transition-colors cursor-pointer">#{tag}</button>
                  ))}
                </div>
              </div>

              {/* Nuance Input */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">
                  3. 원하는 어투 (선택)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                    <MessageSquare size={16} />
                  </div>
                  <input
                    type="text"
                    value={detailNuance}
                    onChange={(e) => setDetailNuance(e.target.value)}
                    placeholder="예: 정중하지만 단호하게"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {['정중하게', '단호하게', '친근하게', '겸손하게'].map(tag => (
                    <button key={tag} onClick={() => setDetailNuance(tag)} className="text-[9px] font-bold text-slate-400 hover:text-blue-500 transition-colors cursor-pointer">#{tag}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xs font-bold flex items-center gap-2 uppercase tracking-[0.2em] text-slate-400">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                실시간 교정 작업
              </h2>
              <button
                onClick={handleCorrection}
                disabled={isProcessing || !inputText.trim()}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none uppercase tracking-widest text-[11px]"
              >
                {isProcessing ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                문장 교정하기
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-grow">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">원본 문장 입력</label>
                  <button 
                    onClick={() => setInputText('')}
                    className="text-[10px] font-bold text-blue-500 hover:opacity-70 px-2 transition-opacity"
                  >
                    내용 비우기
                  </button>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="다듬고 싶은 문장을 입력하세요... (예: 나 이거 다 했어. 언제 줄까?)"
                  className="bg-slate-50 rounded-2xl p-6 text-lg leading-relaxed text-slate-700 border border-slate-100 focus:border-blue-200 focus:ring-0 transition-all flex-grow italic resize-none placeholder:opacity-30"
                />
              </div>

              <div className="flex flex-col relative">
                <label className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">교정된 결과</label>
                <div className={`rounded-2xl p-6 text-lg leading-relaxed border flex-grow font-medium transition-all duration-500 relative overflow-hidden
                  ${result ? 'bg-blue-50/30 text-slate-800 border-blue-100 shadow-inner' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                  {isProcessing ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                      <RefreshCcw size={32} className="animate-spin text-blue-400" />
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">AI가 문맥을 깊게 판단하고 있습니다...</span>
                        <div className="w-48 h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                          <motion.div 
                            className="h-full bg-blue-500"
                            animate={{ x: [-200, 200] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : result ? (
                    <>
                      <p className="whitespace-pre-wrap">{result.correctedText}</p>
                      {isLowConfidence && (
                        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-amber-700 uppercase tracking-tight">수동 검토 권장 (Human Intervention Needed)</span>
                            <p className="text-[10px] text-amber-600 leading-normal font-medium mt-0.5">
                              AI 엔진의 신뢰도 점수가 낮습니다. 상황이 복합적이거나 부적절한 표현이 감지되었을 수 있습니다. 반드시 직접 내용을 확인 후 사용해주세요.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : isTimeout ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center animate-pulse">
                        <Terminal size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-red-600">처리 시간 초과 (Timeout)</p>
                        <p className="text-[10px] text-slate-400 max-w-[200px]">서버 부하 혹은 복잡한 문장으로 인해 응답이 지연되었습니다.</p>
                      </div>
                      <button 
                         onClick={handleCorrection}
                         className="mt-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        RETRY PROCESSING
                      </button>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center italic opacity-40 text-sm">
                      교정하기 버튼을 눌러주세요...
                    </div>
                  )}
                </div>
                {result && (
                  <button 
                    onClick={copyToClipboard}
                    className="absolute top-12 right-4 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                    title="클립보드에 복사"
                  >
                    {isCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-slate-400" />}
                  </button>
                )}
              </div>
            </div>

            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="bg-slate-50 text-slate-700 p-6 rounded-3xl text-[12px] font-medium leading-relaxed border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-60" />
                  <strong className="text-slate-900 uppercase tracking-[0.2em] block mb-4 text-[10px] font-black">종합 교정 리포트 (Summary)</strong>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-slate-600 leading-relaxed italic">
                      "{result.reasoning}"
                    </p>
                  </div>
                  
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      <span>통계 데이터</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center">
                        <span className="text-[9px] text-slate-400 mb-1">길이 변화</span>
                        <span className="text-xs font-black text-slate-800">{Math.round(result.validation.lengthRatio * 100)}%</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center">
                        <span className="text-[9px] text-slate-400 mb-1">의미 보존</span>
                        <span className="text-xs font-black text-emerald-600">CONFIRMED</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 text-slate-700 p-6 rounded-3xl text-[12px] font-medium leading-relaxed border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-60" />
                  <div className="flex items-center justify-between mb-6">
                    <strong className="text-slate-900 uppercase tracking-[0.2em] block text-[10px] font-black">실시간 변경 포인트 (Diff Analysis)</strong>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-bold">총 {result.changes.length}개 항목 수정됨</span>
                  </div>
                  
                  <div className="space-y-3">
                    {result.changes.map((change, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group/item"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 flex flex-col items-center justify-center p-2 bg-red-50/30 rounded-xl border border-red-100/50">
                            <span className="text-[8px] text-red-300 font-black uppercase mb-1">Before</span>
                            <span className="text-red-500 font-medium line-through decoration-red-300/50 text-[11px]">{change.from}</span>
                          </div>
                          
                          <div className="flex flex-col items-center opacity-20">
                            <ChevronRight size={14} className="text-slate-400" />
                          </div>

                          <div className="flex-1 flex flex-col items-center justify-center p-2 bg-emerald-50/50 rounded-xl border border-emerald-100 shadow-sm shadow-emerald-50/50">
                            <span className="text-[8px] text-emerald-400 font-black uppercase mb-1">After</span>
                            <span className="text-emerald-700 font-bold text-[11px]">{change.to}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <CheckCircle2 size={12} className="mt-0.5 text-blue-500" />
                          <p className="text-[10px] text-slate-500 leading-normal font-medium">
                            <span className="text-slate-900 font-bold mr-1">수정 이유:</span>
                            {change.reason}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-800 uppercase">최근 교정 기록</h2>
              <div className="h-0.5 bg-slate-200 flex-grow"></div>
            </div>
            <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar scroll-smooth">
              {history.map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => loadFromHistory(item)}
                  className={`min-w-[320px] p-6 bg-white border rounded-2xl shadow-sm transition-all flex flex-col cursor-pointer group/history
                    ${result?.original === item.original ? 'border-blue-500 ring-2 ring-blue-50 shadow-md' : 'border-slate-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded uppercase tracking-tighter">
                      {item.targetTone}
                    </span>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-mono text-slate-400">{item.timestamp}</span>
                       <RefreshCcw size={12} className="text-blue-500 opacity-0 group-hover/history:opacity-100 transition-opacity animate-spin-slow" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 italic line-clamp-1 border-l-2 border-slate-100 pl-2">"{item.original}"</p>
                  <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-relaxed mb-4">{item.correctedText}</p>
                  
                  <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-center">
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover/history:opacity-100 transition-opacity">
                      Click to Restore Workspace
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-auto flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-400 border-t border-slate-200 py-8 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
            <span className="font-mono tracking-tighter opacity-70">kiro-tone-agent-v1.0.0</span>
          </div>
        </footer>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

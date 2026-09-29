'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  X,
  Radio,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Send,
  Bot,
} from 'lucide-react';
import Vapi from '@vapi-ai/web';
import {
  startVoiceSession,
  endVoiceSession,
  getVoiceSessionConfig,
  askGeminiVoiceCompanion,
} from '@/lib/actions/voice.actions';
import { VAPI_PUBLIC_KEY, ASSISTANT_ID } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  author: string;
  persona?: string;
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'ended';
type VoiceEngine = 'gemini' | 'vapi';

interface TranscriptItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function VoiceCallModal({
  isOpen,
  onClose,
  bookId,
  bookTitle,
  author,
  persona,
}: VoiceCallModalProps) {
  const [engine, setEngine] = useState<VoiceEngine>('gemini');
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');

  // References
  const vapiRef = useRef<Vapi | null>(null);
  const recognitionRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const isCallActiveRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  isMutedRef.current = isMuted;

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, isThinking]);

  // Handle call timer
  useEffect(() => {
    if (status === 'connected') {
      durationRef.current = 0;
      setCallDuration(0);
      isCallActiveRef.current = true;
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      isCallActiveRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      cleanupAudioSession();
    };
  }, []);

  const cleanupAudioSession = () => {
    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch {
        // ignore
      }
      vapiRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
  };

  if (!isOpen) return null;

  // ─── Gemini Speech Synthesis Helper ─────────────────────────────────────────
  const speakWithGemini = (text: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEndCallback?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const isFemale = !['dave', 'daniel', 'chris'].includes(persona?.toLowerCase() || '');
    const preferredVoices = voices.filter((v) => v.lang.startsWith('en'));

    if (isFemale) {
      const match = preferredVoices.find((v) =>
        v.name.includes('Natural') ||
        v.name.includes('Google US English') ||
        v.name.includes('Jenny') ||
        v.name.includes('Samantha') ||
        v.name.includes('Zira') ||
        v.name.toLowerCase().includes('female')
      );
      if (match) utterance.voice = match;
    } else {
      const match = preferredVoices.find((v) =>
        v.name.includes('Guy') ||
        v.name.includes('David') ||
        v.name.includes('Daniel') ||
        v.name.toLowerCase().includes('male')
      );
      if (match) utterance.voice = match;
    }

    // Dynamic wave animation while speaking
    utterance.onstart = () => {
      setIsSpeaking(true);
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = setInterval(() => {
        setVolumeLevel(Math.random() * 0.7 + 0.2);
      }, 150);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setVolumeLevel(0);
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
      onEndCallback?.();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setVolumeLevel(0);
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
      onEndCallback?.();
    };

    window.speechSynthesis.speak(utterance);
  };

  // ─── Gemini Voice Mode Start ────────────────────────────────────────────────
  const startGeminiVoice = async () => {
    cleanupAudioSession();
    setErrorMessage(null);
    setStatus('connecting');
    setTranscripts([]);

    try {
      const config = await getVoiceSessionConfig(bookId, bookTitle, author, persona);
      const sessionResult = await startVoiceSession(bookId);

      if (sessionResult.success && sessionResult.sessionId) {
        setActiveSessionId(sessionResult.sessionId);
      }

      setStatus('connected');
      const initialGreeting = config.firstMessage;

      setTranscripts([
        {
          id: `greet-${Date.now()}`,
          role: 'assistant',
          text: initialGreeting,
        },
      ]);

      // Speak greeting, then start speech recognition
      speakWithGemini(initialGreeting, () => {
        initSpeechRecognition();
      });
    } catch (err: any) {
      console.error('Failed to start Voice Companion:', err);
      setErrorMessage(err?.message || 'Could not connect to Voice Service');
      setStatus('idle');
    }
  };

  // ─── Initialize Browser Speech Recognition ──────────────────────────────────
  const initSpeechRecognition = () => {
    if (!isCallActiveRef.current) return;
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        'Your browser does not support Web Speech Recognition. You can still type in the input bar below!'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Capture per utterance
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        if (!isMutedRef.current) {
          setVolumeLevel(0.2);
        }
      };

      recognition.onresult = (event: any) => {
        if (isMutedRef.current) return;

        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        const isFinal = event.results[current].isFinal;

        if (!isFinal) {
          setVolumeLevel(0.6);
        } else if (transcript.trim()) {
          setVolumeLevel(0);
          handleUserUtterance(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Restart listening silently if the call is still ongoing
          if (isCallActiveRef.current && !isMutedRef.current && !isSpeaking) {
            setTimeout(() => {
              try {
                recognition.start();
              } catch {
                // ignore restart
              }
            }, 500);
          }
        } else if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was blocked. Please permit microphone access in your browser.');
        }
      };

      recognition.onend = () => {
        // Auto-restart listening if call is active and assistant is not talking
        if (isCallActiveRef.current && !isMutedRef.current && !isSpeaking && !isThinking) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start issue:', e);
    }
  };

  // ─── Process User Voice Utterance ───────────────────────────────────────────
  const handleUserUtterance = async (spokenText: string) => {
    if (!spokenText.trim()) return;

    // Pause recognition while thinking & speaking
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // Add user message to transcript
    setTranscripts((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: spokenText,
      },
    ]);

    setIsThinking(true);

    try {
      const res = await askGeminiVoiceCompanion({
        bookId,
        bookTitle,
        author,
        persona,
        spokenText,
      });

      setIsThinking(false);

      if (res.success && res.answer) {
        const answer = res.answer;
        setTranscripts((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            text: answer,
          },
        ]);

        // Speak response aloud, then restart listening
        speakWithGemini(answer, () => {
          if (isCallActiveRef.current && !isMutedRef.current) {
            initSpeechRecognition();
          }
        });
      } else {
        const fallback = "I'm having trouble retrieving that from the book right now. Could you ask again?";
        setTranscripts((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: fallback,
          },
        ]);
        speakWithGemini(fallback, () => {
          if (isCallActiveRef.current && !isMutedRef.current) {
            initSpeechRecognition();
          }
        });
      }
    } catch (e) {
      setIsThinking(false);
      console.error('Error in handleUserUtterance:', e);
      initSpeechRecognition();
    }
  };

  // ─── Start Call (Dispatcher) ───────────────────────────────────────────────
  const handleStartCall = async (simulated: boolean = false) => {
    if (engine === 'gemini') {
      await startGeminiVoice();
      return;
    }

    // ── Vapi WebRTC Mode ────────────────────────────────────────────────────
    cleanupAudioSession();
    setErrorMessage(null);
    setStatus('connecting');
    setTranscripts([]);

    try {
      const config = await getVoiceSessionConfig(bookId, bookTitle, author, persona);
      const sessionResult = await startVoiceSession(bookId);
      if (sessionResult.success && sessionResult.sessionId) {
        setActiveSessionId(sessionResult.sessionId);
      }

      const publicKey = config.vapiPublicKey || VAPI_PUBLIC_KEY;
      const assistantId = config.assistantId || ASSISTANT_ID;

      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on('call-start', () => {
        setStatus('connected');
        try {
          vapi.setMuted(false);
          setIsMuted(false);
        } catch {
          // ignore
        }
        setTranscripts([
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            text: config.firstMessage,
          },
        ]);
      });

      vapi.on('call-end', () => {
        handleEndCall();
      });

      vapi.on('speech-start', () => {
        setIsSpeaking(true);
      });

      vapi.on('speech-end', () => {
        setIsSpeaking(false);
      });

      vapi.on('volume-level', (level: number) => {
        setVolumeLevel(level);
      });

      vapi.on('message', (message: any) => {
        if (message.type === 'transcript' && message.transcript) {
          const role: 'user' | 'assistant' = message.role === 'user' ? 'user' : 'assistant';
          setTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role && message.transcriptType === 'partial') {
              return [...prev.slice(0, -1), { ...last, text: message.transcript }];
            }
            if (message.transcriptType === 'final') {
              return [...prev, { id: `tr-${Date.now()}`, role, text: message.transcript }];
            }
            return prev;
          });
        }
      });

      vapi.on('error', (err: any) => {
        console.error('Vapi WebRTC Error:', err);
        const msg =
          err?.error?.message ||
          err?.message ||
          (typeof err?.error === 'string' ? err.error : null) ||
          'Voice connection error';
        setErrorMessage(msg);
        setStatus('idle');
      });

      if (assistantId) {
        await vapi.start(assistantId, {
          variableValues: { bookTitle, author },
        });
      } else {
        await vapi.start({
          name: `Reader Companion - ${bookTitle}`,
          firstMessage: config.firstMessage,
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en-US',
          },
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: config.systemPrompt }],
          },
          voice: {
            provider: '11labs',
            voiceId: config.voiceId,
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to initiate Vapi call:', err);
      setErrorMessage(err?.message || 'Could not connect to Vapi');
      setStatus('idle');
    }
  };

  // ─── End Call ──────────────────────────────────────────────────────────────
  const handleEndCall = async () => {
    cleanupAudioSession();

    if (activeSessionId) {
      await endVoiceSession(activeSessionId, durationRef.current);
    }

    setStatus('ended');
    setIsSpeaking(false);
    setIsThinking(false);
    setVolumeLevel(0);
  };

  // ─── Toggle Mute ───────────────────────────────────────────────────────────
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);

    if (engine === 'vapi' && vapiRef.current) {
      vapiRef.current.setMuted(next);
    } else if (engine === 'gemini') {
      if (next && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      } else if (!next && !isSpeaking && !isThinking) {
        initSpeechRecognition();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FAF7F0] border border-[#E9E1CC] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-white/80 border-b border-[#E9E1CC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#663820] text-white flex items-center justify-center shadow-xs">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#1C1C1C] truncate max-w-[240px]">
                {bookTitle}
              </h3>
              <p className="text-xs text-[#6B6B6B] flex items-center gap-1.5">
                <span>by {author}</span>
                <span>•</span>
                <span className="capitalize font-semibold text-[#663820]">
                  {persona || 'Rachel'} Voice
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (status === 'connected') handleEndCall();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white border border-[#E9E1CC] text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#F5F0E1] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Switcher (When Idle) */}
        {status === 'idle' && (
          <div className="px-6 pt-4 pb-1">
            <div className="flex items-center bg-[#EDE6D4] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setEngine('gemini')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  engine === 'gemini'
                    ? 'bg-[#663820] text-white shadow-xs'
                    : 'text-[#6B6B6B] hover:text-[#1C1C1C]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Voice (Free & Unlimited)</span>
              </button>
              <button
                type="button"
                onClick={() => setEngine('vapi')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  engine === 'vapi'
                    ? 'bg-[#663820] text-white shadow-xs'
                    : 'text-[#6B6B6B] hover:text-[#1C1C1C]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>WebRTC Mode</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="w-full mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* ── STATE 1: IDLE ──────────────────────────────────────────────── */}
          {status === 'idle' && (
            <div className="space-y-5 py-2 max-w-sm">
              <div className="relative mx-auto w-28 h-28 rounded-full bg-[#F5F0E1] border-2 border-[#E9E1CC] flex items-center justify-center shadow-inner group">
                <div className="absolute inset-0 rounded-full bg-[#663820]/10 animate-ping opacity-25" />
                <Mic className="w-12 h-12 text-[#663820] transition-transform group-hover:scale-110" />
              </div>

              <div>
                <h4 className="font-serif font-bold text-xl text-[#1C1C1C] mb-1">
                  {engine === 'gemini' ? 'AI Voice Companion' : 'WebRTC Voice Mode'}
                </h4>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  {engine === 'gemini'
                    ? `Have an interactive, spoken conversation about "${bookTitle}". 100% free with unlimited sessions.`
                    : `Connect via live WebRTC voice pipeline with text-to-speech.`}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleStartCall(false)}
                  className="w-full h-12 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {engine === 'gemini' ? 'Start Voice Call' : 'Connect WebRTC Call'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ── STATE 2: CONNECTING ────────────────────────────────────────── */}
          {status === 'connecting' && (
            <div className="space-y-5 py-8">
              <div className="w-24 h-24 mx-auto rounded-full bg-[#663820]/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#663820]" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-lg text-[#1C1C1C]">
                  {engine === 'gemini' ? 'Initializing Voice Companion...' : 'Connecting Audio...'}
                </h4>
                <p className="text-xs text-[#6B6B6B] mt-1">
                  Loading book knowledge and preparing audio session
                </p>
              </div>
            </div>
          )}

          {/* ── STATE 3: CONNECTED ─────────────────────────────────────────── */}
          {status === 'connected' && (
            <div className="w-full flex-1 flex flex-col items-center justify-between">
              
              {/* Audio Visualizer Orb */}
              <div className="py-4 flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  <div
                    className="absolute rounded-full bg-[#663820]/20 transition-all duration-150"
                    style={{
                      width: `${110 + volumeLevel * 80}px`,
                      height: `${110 + volumeLevel * 80}px`,
                    }}
                  />
                  <div
                    className="absolute rounded-full bg-[#663820]/30 transition-all duration-150"
                    style={{
                      width: `${90 + volumeLevel * 40}px`,
                      height: `${90 + volumeLevel * 40}px`,
                    }}
                  />
                  <div className="relative w-22 h-22 rounded-full bg-[#663820] text-white flex items-center justify-center shadow-lg">
                    {isSpeaking ? (
                      <Volume2 className="w-9 h-9 animate-pulse text-amber-300" />
                    ) : isThinking ? (
                      <Loader2 className="w-9 h-9 animate-spin text-amber-300" />
                    ) : (
                      <Mic className="w-9 h-9 text-white" />
                    )}
                  </div>
                </div>

                {/* Status Badge & Call Timer */}
                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {isSpeaking
                      ? `${persona || 'Rachel'} Speaking...`
                      : isThinking
                      ? 'AI Thinking...'
                      : 'Listening (Speak now)...'}
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#6B6B6B] bg-white px-2.5 py-1 rounded-full border border-[#E9E1CC]">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              </div>

              {/* Real-time Spoken Transcript Area */}
              <div className="w-full bg-white rounded-2xl border border-[#E9E1CC] p-4 h-40 overflow-y-auto text-left space-y-2.5 shadow-inner my-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#A89F8F] mb-1 flex items-center justify-between">
                  <span>Live Dialogue:</span>
                  <span className="text-[10px] font-normal text-[#663820]">
                    {engine === 'gemini' ? 'AI Voice Companion' : 'WebRTC Mode'}
                  </span>
                </div>
                {transcripts.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className={`text-xs leading-relaxed p-2.5 rounded-xl ${
                      t.role === 'user'
                        ? 'bg-[#663820] text-white ml-6 text-right'
                        : 'bg-[#F5F0E1]/80 text-[#1C1C1C] mr-6'
                    }`}
                  >
                    <span className="font-bold text-[10px] block opacity-75 mb-0.5">
                      {t.role === 'user' ? 'You' : `${persona || 'Assistant'}`}
                    </span>
                    {t.text}
                  </div>
                ))}
                {isThinking && (
                  <div className="text-xs text-[#6B6B6B] italic flex items-center gap-1.5 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Formulating response from book excerpts...</span>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Text Input Fallback (Allows typing if mic is quiet) */}
              {engine === 'gemini' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualText.trim()) {
                      const text = manualText.trim();
                      setManualText('');
                      handleUserUtterance(text);
                    }
                  }}
                  className="w-full flex items-center gap-2 mb-2"
                >
                  <input
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Or type a question about this book..."
                    className="flex-1 h-9 px-3.5 rounded-xl bg-white border border-[#E9E1CC] text-xs text-[#1C1C1C] placeholder:text-[#A89F8F] focus:outline-hidden focus:border-[#663820]"
                  />
                  <button
                    type="submit"
                    disabled={!manualText.trim() || isThinking || isSpeaking}
                    className="h-9 px-3 rounded-xl bg-[#663820] text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {/* Call Control Buttons */}
              <div className="pt-2 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all ${
                    isMuted
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-[#E9E1CC] text-[#1C1C1C] hover:bg-[#F5F0E1]'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-amber-700" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="h-11 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all group"
                >
                  <PhoneOff className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>End Conversation</span>
                </button>
              </div>

            </div>
          )}

          {/* ── STATE 4: ENDED ─────────────────────────────────────────────── */}
          {status === 'ended' && (
            <div className="space-y-6 py-6 max-w-sm">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="font-serif font-bold text-xl text-[#1C1C1C]">
                  Call Completed
                </h4>
                <p className="text-xs text-[#6B6B6B] mt-1">
                  Total conversation duration: <span className="font-semibold text-[#1C1C1C]">{formatDuration(callDuration)}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleStartCall(false)}
                  className="flex-1 h-11 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Talk Again</span>
                </button>

                <button
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl bg-white border border-[#E9E1CC] hover:bg-[#F5F0E1] text-[#1C1C1C] font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

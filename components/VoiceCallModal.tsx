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
} from 'lucide-react';
import Vapi from '@vapi-ai/web';
import {
  startVoiceSession,
  endVoiceSession,
  getVoiceSessionConfig,
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
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  // References
  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Handle call timer
  useEffect(() => {
    if (status === 'connected') {
      durationRef.current = 0;
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
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
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  // ─── Start Call ────────────────────────────────────────────────────────────
  const handleStartCall = async (simulated: boolean = false) => {
    setErrorMessage(null);
    setStatus('connecting');
    setTranscripts([]);
    setIsSimulated(simulated);

    try {
      // 1. Fetch voice configuration and system prompt
      const config = await getVoiceSessionConfig(bookId, bookTitle, author, persona);
      
      // 2. Start session in database
      const sessionResult = await startVoiceSession(bookId);
      if (!sessionResult.success || !sessionResult.sessionId) {
        setErrorMessage(sessionResult.error || 'Could not start voice session');
        setStatus('idle');
        return;
      }

      setActiveSessionId(sessionResult.sessionId);

      // If simulated mode (e.g. no key or user explicitly selected simulator)
      if (simulated || !VAPI_PUBLIC_KEY) {
        if (!simulated && !VAPI_PUBLIC_KEY) {
          setErrorMessage('Vapi Public Key is not configured in .env.local. You can test in Demo Simulator Mode below.');
          setStatus('idle');
          return;
        }

        // Demo simulation mode
        setTimeout(() => {
          setStatus('connected');
          setTranscripts([
            {
              id: 'init',
              role: 'assistant',
              text: config.firstMessage,
            },
          ]);

          // Simulate speech wave
          const interval = setInterval(() => {
            setVolumeLevel(Math.random() * 0.6 + 0.2);
          }, 300);

          setTimeout(() => {
            clearInterval(interval);
            setVolumeLevel(0);
          }, 4000);
        }, 1200);
        return;
      }

      // 3. Connect to live Vapi instance
      const vapi = new Vapi(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;

      // Event Listeners
      vapi.on('call-start', () => {
        setStatus('connected');
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
            // Avoid duplicate lines if partial
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
        setErrorMessage(err?.message || 'Voice connection encounterd an error');
      });

      // 4. Start call with Vapi
      if (ASSISTANT_ID) {
        await vapi.start(ASSISTANT_ID, {
          variableValues: {
            bookTitle,
            author,
          },
        });
      } else {
        // Start inline assistant configuration
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
            messages: [
              {
                role: 'system',
                content: config.systemPrompt,
              },
            ],
          },
          voice: {
            provider: '11labs',
            voiceId: config.voiceId,
          },
        });
      }
    } catch (err: any) {
      console.error('Failed to initiate voice call:', err);
      setErrorMessage(err?.message || 'Could not connect to voice service');
      setStatus('idle');
    }
  };

  // ─── End Call ──────────────────────────────────────────────────────────────
  const handleEndCall = async () => {
    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch {
        // ignore
      }
      vapiRef.current = null;
    }

    if (activeSessionId) {
      await endVoiceSession(activeSessionId, durationRef.current);
    }

    setStatus('ended');
    setIsSpeaking(false);
    setVolumeLevel(0);
  };

  // ─── Toggle Mute ───────────────────────────────────────────────────────────
  const handleToggleMute = () => {
    if (vapiRef.current) {
      const nextMuted = !isMuted;
      vapiRef.current.setMuted(nextMuted);
      setIsMuted(nextMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FAF7F0] border border-[#E9E1CC] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-white/70 border-b border-[#E9E1CC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#663820] text-white flex items-center justify-center shadow-xs">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#1C1C1C] truncate max-w-[260px]">
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

        {/* Content Body */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
          
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
            <div className="space-y-6 py-4 max-w-sm">
              <div className="relative mx-auto w-28 h-28 rounded-full bg-[#F5F0E1] border-2 border-[#E9E1CC] flex items-center justify-center shadow-inner group">
                <div className="absolute inset-0 rounded-full bg-[#663820]/10 animate-ping opacity-25" />
                <Mic className="w-12 h-12 text-[#663820] transition-transform group-hover:scale-110" />
              </div>

              <div>
                <h4 className="font-serif font-bold text-xl text-[#1C1C1C] mb-1">
                  Ready to Start Voice Conversation
                </h4>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  Have an interactive, two-way spoken conversation about ideas, questions, and themes from &ldquo;{bookTitle}&rdquo;.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => handleStartCall(false)}
                  className="w-full h-12 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  <span>Connect Voice Call (Vapi)</span>
                </button>

                {!VAPI_PUBLIC_KEY && (
                  <button
                    onClick={() => handleStartCall(true)}
                    className="w-full h-10 rounded-xl bg-white border border-[#E9E1CC] hover:bg-[#F5F0E1] text-[#663820] font-medium text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Try Interactive Demo Simulation</span>
                  </button>
                )}
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
                  Establishing Voice Audio Stream...
                </h4>
                <p className="text-xs text-[#6B6B6B] mt-1">
                  Connecting low-latency WebRTC with Vapi voice pipeline
                </p>
              </div>
            </div>
          )}

          {/* ── STATE 3: CONNECTED ─────────────────────────────────────────── */}
          {status === 'connected' && (
            <div className="w-full flex-1 flex flex-col items-center justify-between">
              
              {/* Audio Visualizer Orb */}
              <div className="py-6 flex flex-col items-center">
                <div className="relative flex items-center justify-center">
                  {/* Dynamic Voice Halo based on volumeLevel */}
                  <div
                    className="absolute rounded-full bg-[#663820]/20 transition-all duration-150"
                    style={{
                      width: `${120 + volumeLevel * 90}px`,
                      height: `${120 + volumeLevel * 90}px`,
                    }}
                  />
                  <div
                    className="absolute rounded-full bg-[#663820]/30 transition-all duration-150"
                    style={{
                      width: `${100 + volumeLevel * 50}px`,
                      height: `${100 + volumeLevel * 50}px`,
                    }}
                  />
                  {/* Center Circle */}
                  <div className="relative w-24 h-24 rounded-full bg-[#663820] text-white flex items-center justify-center shadow-lg">
                    {isSpeaking ? (
                      <Volume2 className="w-10 h-10 animate-pulse text-amber-300" />
                    ) : (
                      <Mic className="w-10 h-10 text-white" />
                    )}
                  </div>
                </div>

                {/* Status Badge & Call Timer */}
                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {isSpeaking ? 'Assistant Speaking...' : 'Listening...'}
                  </span>
                  <span className="text-xs font-mono font-semibold text-[#6B6B6B] bg-white px-2.5 py-1 rounded-full border border-[#E9E1CC]">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              </div>

              {/* Real-time Live Transcript Area */}
              <div className="w-full bg-white rounded-2xl border border-[#E9E1CC] p-4 h-48 overflow-y-auto text-left space-y-3 shadow-inner my-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#A89F8F] mb-1">
                  Live Spoken Transcript:
                </div>
                {transcripts.length === 0 ? (
                  <p className="text-xs text-[#A89F8F] italic">
                    Start speaking to begin your conversation...
                  </p>
                ) : (
                  transcripts.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className={`text-xs leading-relaxed p-2.5 rounded-xl ${
                        t.role === 'user'
                          ? 'bg-[#663820] text-white ml-6 text-right'
                          : 'bg-[#F5F0E1]/60 text-[#1C1C1C] mr-6'
                      }`}
                    >
                      <span className="font-bold text-[10px] block opacity-75 mb-0.5">
                        {t.role === 'user' ? 'You' : `${persona || 'Assistant'}`}
                      </span>
                      {t.text}
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Call Control Buttons */}
              <div className="pt-4 flex items-center justify-center gap-4">
                <button
                  onClick={handleToggleMute}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
                    isMuted
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-[#E9E1CC] text-[#1C1C1C] hover:bg-[#F5F0E1]'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-amber-700" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleEndCall}
                  className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all group"
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
                  onClick={() => handleStartCall(isSimulated)}
                  className="flex-1 h-11 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Start Again</span>
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

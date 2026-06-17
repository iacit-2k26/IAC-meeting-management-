"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, X, MessageSquare, Loader2, Calendar, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Settings, RefreshCw, Wifi, WifiOff } from "lucide-react";
import Vapi from "@vapi-ai/web";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hello! I'm your Meeting Assistant. You can type or talk to me to manage your schedule." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [useVapi, setUseVapi] = useState(false);
  const [vapiCallActive, setVapiCallActive] = useState(false);
  const [vapiStatus, setVapiStatus] = useState("idle");
  const [vapiError, setVapiError] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const vapiRef = useRef(null);
  const retryCountRef = useRef(0);
  
  const isContinuousRef = useRef(false);
  const isVoiceModeRef = useRef(false);

  useEffect(() => {
    isContinuousRef.current = isContinuous;
    isVoiceModeRef.current = isVoiceMode;
  }, [isContinuous, isVoiceMode]);

  useEffect(() => {
    if (useVapi && typeof window !== "undefined" && process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) {
      vapiRef.current = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY);

      vapiRef.current.on("call-start", () => {
        console.log("[Vapi] Call started");
        setVapiCallActive(true);
        setVapiStatus("connected");
        setVapiError(null);
        setIsListening(true);
        retryCountRef.current = 0;
      });

      vapiRef.current.on("call-end", () => {
        console.log("[Vapi] Call ended");
        setVapiCallActive(false);
        setIsListening(false);
        setVapiStatus("idle");
      });

      vapiRef.current.on("speech-start", () => setIsListening(true));
      vapiRef.current.on("speech-end",   () => setIsListening(false));

      vapiRef.current.on("message", (message) => {
        console.log("[Vapi Message Received]:", message);

        if (message.type === "transcript") {
          const isUser = message.role === "user";
          const displayRole = isUser ? "You" : "AI";
          
          setLastTranscript(`${displayRole}: ${message.transcript}`);

          if (message.transcriptType === "final" && message.transcript?.trim()) {
            const finalRole = isUser ? "user" : "bot";
            
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === finalRole && last.text.trim() === message.transcript.trim()) {
                return prev;
              }
              return [...prev, { role: finalRole, text: message.transcript }];
            });
            
            setLastTranscript("");
          }
        }
      });

      vapiRef.current.on("error", (error) => {
        const raw = error?.error?.message ?? error?.message ?? "";
        const rawStr = Array.isArray(raw) ? raw.join(" ") : String(raw);

        if (
          rawStr.toLowerCase().includes("transport") ||
          rawStr.toLowerCase().includes("disconnected") ||
          rawStr.toLowerCase().includes("ice") ||
          rawStr.toLowerCase().includes("network")
        ) {
          console.warn("[Vapi] Transport disconnected — check Server URL / ngrok");
          setVapiStatus("disconnected");
          setVapiCallActive(false);
          setIsListening(false);
          setVapiError("transport");
          setMessages(prev => [...prev, {
            role: "bot",
            text: "⚠️ Voice connection dropped. This usually means the Server URL in your Vapi dashboard is unreachable (ngrok expired?). Click Retry to try again.",
            isError: true,
          }]);
          return;
        }

        if (rawStr.toLowerCase().includes("assistant") || rawStr.toLowerCase().includes("not found")) {
          setVapiError("assistant");
          setMessages(prev => [...prev, {
            role: "bot",
            text: "❌ Vapi assistant not found. Check NEXT_PUBLIC_VAPI_ASSISTANT_ID in your .env file.",
            isError: true,
          }]);
          return;
        }

        if (rawStr.toLowerCase().includes("permission") || rawStr.toLowerCase().includes("microphone") || rawStr.toLowerCase().includes("media")) {
          setVapiError("mic");
          setMessages(prev => [...prev, {
            role: "bot",
            text: "🎤 Microphone access was denied. Please allow microphone access in your browser and try again.",
            isError: true,
          }]);
          return;
        }

        console.warn("[Vapi] Error:", rawStr);
        setVapiError("generic");
        setMessages(prev => [...prev, {
          role: "bot",
          text: `Vapi error: ${rawStr || "Unknown error"}`,
          isError: true,
        }]);
      });
    }

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
        vapiRef.current = null;
      }
    };
  }, [useVapi]);

  useEffect(() => {
    if (typeof window !== "undefined" && !useVapi) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn("Speech recognition not supported in this browser.");
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText) setLastTranscript(currentText);

        if (finalTranscript) {
          const lowerText = finalTranscript.toLowerCase().trim();
          
          if (lowerText === "end" || lowerText === "stop session" || lowerText === "exit voice mode") {
            handleExitVoiceMode();
            return;
          }

          handleSend(null, finalTranscript);
          recognitionRef.current?.stop();
        }
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (isContinuousRef.current || isVoiceModeRef.current) {
          setTimeout(() => {
            if ((isContinuousRef.current || isVoiceModeRef.current) && !window.speechSynthesis.speaking) {
              try {
                recognitionRef.current?.start();
              } catch (e) {
                /* already running */
              }
            }
          }, 300);
        }
      };

      recognitionRef.current.onerror = (event) => {
        if (event.error === "no-speech") return;
        
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setIsContinuous(false);
        setIsVoiceMode(false);
        
        let errorMsg = "";
        if (event.error === "network") {
          errorMsg = "Voice service unavailable. Please check your internet connection.";
        } else if (event.error === "not-allowed") {
          errorMsg = "Microphone access denied.";
        } else {
          errorMsg = `Voice error: ${event.error}`;
        }

        if (errorMsg) {
          setMessages(prev => [...prev, { role: "bot", text: errorMsg }]);
          speak(errorMsg);
        }
      };
    }
  }, [useVapi]);

  const toggleListening = () => {
    if (useVapi) {
      toggleVapiCall();
    } else {
      if (isListening) {
        setIsContinuous(false);
        setIsVoiceMode(false);
        recognitionRef.current?.stop();
      } else {
        setIsContinuous(true);
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.warn("Recognition already started or failed:", e);
        }
      }
    }
  };

  const toggleVapiCall = async () => {
    if (vapiCallActive) {
      vapiRef.current?.stop();
      setVapiStatus("idle");
    } else {
      await startVapiCall();
    }
  };

  const startVapiCall = async () => {
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    if (!assistantId) {
      setMessages(prev => [...prev, {
        role: "bot",
        text: "❌ NEXT_PUBLIC_VAPI_ASSISTANT_ID is not set in your .env file."
      }]);
      return;
    }

    if (!vapiRef.current && process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY) {
      vapiRef.current = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY);
    }

    try {
      setVapiStatus("connecting");
      setVapiError(null);
      console.log("[Vapi] Starting call with assistant:", assistantId);
      await vapiRef.current?.start(assistantId);
    } catch (e) {
      console.warn("[Vapi] Failed to start call:", e);
      setVapiStatus("error");
      const rawMsg = e.error?.message ?? e.message ?? "Unknown error";
      const msg = Array.isArray(rawMsg) ? rawMsg.join(", ") : String(rawMsg);
      setMessages(prev => [...prev, {
        role: "bot",
        text: `⚠️ Could not start Vapi call: ${msg}. Make sure your microphone is allowed and try again.`,
        isError: true,
      }]);
    }
  };

  const handleEnterVoiceMode = () => {
    if (useVapi) {
      toggleVapiCall();
    } else {
      setIsVoiceMode(true);
      setIsContinuous(true);
      setIsTtsEnabled(true);
      setLastTranscript("Listening...");
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("Recognition already started:", e);
      }
      speak("Voice mode activated. How can I help you today?");
    }
  };

  const handleExitVoiceMode = () => {
    if (useVapi) {
      vapiRef.current?.stop();
    } else {
      setIsVoiceMode(false);
      setIsContinuous(false);
      recognitionRef.current?.stop();
      speak("Exiting voice mode.");
    }
    setLastTranscript("");
  };

  const speak = (text) => {
    if (!isTtsEnabled || typeof window === "undefined") return;
    
    window.speechSynthesis.cancel();
    
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/#/g, "")
      .replace(/- /g, " ")
      .replace(/\n/g, ". ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Premium")) && 
      v.lang.startsWith("en")
    ) || voices.find(v => v.lang.startsWith("en"));
    
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      if (isContinuousRef.current || isVoiceModeRef.current) {
        setTimeout(() => {
          if ((isVoiceModeRef.current || isContinuousRef.current) && !isListening) {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              /* ignore */
            }
          }
        }, 150); 
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e, directText = null) => {
    if (e) e.preventDefault();
    const userMsg = directText || input.trim();
    if (!userMsg || isLoading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg,
          sessionData: sessionData,
          userDateTime: new Date().toLocaleString()
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "bot", text: data.answer, meeting: data.meeting }]);
      
      if (isVoiceMode) setLastTranscript("");
      speak(data.answer);

      if (data.sessionData) {
        setSessionData(data.sessionData);
      } else if (data.meeting) {
        setSessionData(null);
      }
    } catch (error) {
      const errorMsg = "Sorry, I encountered an error: " + error.message;
      setMessages(prev => [...prev, { role: "bot", text: errorMsg }]);
      speak(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageText = (text) => {
    if (!text) return null;
    
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end font-sans">
      {isOpen && (
        <div className="mb-4 flex h-[550px] w-[400px] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)] animate-in slide-in-from-bottom-4 duration-300">
          
          <div className="flex items-center justify-between bg-gradient-to-r from-[#1E293B] to-[#2B3990] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 backdrop-blur-md border border-white/10 overflow-hidden">
                <img src="/bot-icon.png" alt="Bot" className="h-full w-full object-cover" />
                {(isContinuous || vapiCallActive) && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Meeting Assistant</h3>
                <p className="text-[10px] opacity-75 font-medium">
                  {useVapi ? "Vapi Voice Mode" : (isContinuous ? "Hands-free Active" : "Text Chat Active")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setUseVapi(!useVapi)}
                className={`rounded-xl p-2 transition-all hover:bg-white/10 ${useVapi ? 'bg-green-500/20 text-green-300 border border-green-500/20' : 'text-white/60'}`}
                title={useVapi ? "Switch to Browser Voice" : "Switch to Vapi Voice"}
              >
                <Phone size={15} />
              </button>
              
              <button 
                onClick={() => setIsTtsEnabled(!isTtsEnabled)}
                className={`rounded-xl p-2 transition-all hover:bg-white/10 ${isTtsEnabled ? 'text-white' : 'text-red-300 bg-red-500/10'}`}
                title={isTtsEnabled ? "Mute Output" : "Unmute Output"}
              >
                {isTtsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              
              <button 
                onClick={() => setIsOpen(false)} 
                className="rounded-xl p-2 text-white/80 hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 hide-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-[0_2px_8px_rgba(15,23,42,0.02)] whitespace-pre-line leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-[#2B3990] text-white rounded-tr-none" 
                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                }`}>
                  {renderMessageText(msg.text)}
                  
                  {msg.meeting && (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center gap-3">
                      <div className="rounded-lg bg-white p-2 text-[#2B3990] shadow-sm">
                        <Calendar size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{msg.meeting.title}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Synced & Confirmed</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 border border-slate-100 shadow-sm flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isVoiceMode || vapiCallActive || vapiStatus === "connecting" || vapiStatus === "disconnected" ? (
            <div className="border-t border-slate-200/40 bg-white/95 backdrop-blur-xl px-5 py-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {vapiStatus === "connecting" && (
                    <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
                  )}
                  {vapiStatus === "disconnected" && (
                    <span className="flex h-2 w-2 rounded-full bg-red-500"></span>
                  )}
                  {vapiStatus === "connected" && (
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {vapiStatus === "connecting" ? "Connecting Voice..." :
                     vapiStatus === "disconnected" ? "No Connection" :
                     "Voice Session Active"}
                  </span>
                </div>
              </div>

              <div className="min-h-[44px] rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-center">
                <p className="text-xs text-slate-500 text-center font-medium italic select-none">
                  {vapiStatus === "connecting" ? "Initializing secure WebRTC tunnel..." :
                   vapiStatus === "disconnected" ? "Check if ngrok is running on your machine." :
                   lastTranscript || "Listening... Start speaking to check calendar"}
                </p>
              </div>

              <div className="flex gap-2">
                {vapiStatus === "disconnected" ? (
                  <>
                    <button
                      onClick={() => { setVapiStatus("idle"); startVapiCall(); }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/10 hover:brightness-105 active:scale-95 transition-all"
                    >
                      <RefreshCw size={13} /> Retry Hook
                    </button>
                    <button
                      onClick={handleExitVoiceMode}
                      className="flex-1 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
                    >
                      Exit Voice
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleExitVoiceMode}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-red-500/10 hover:brightness-105 active:scale-95 transition-all"
                    >
                      <PhoneOff size={13} />
                      {vapiStatus === "connecting" ? "Cancel Connection" : "End Call"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSend} className="border-t border-slate-100 bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about meetings or schedule..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-12 text-xs font-medium focus:border-[#2B3990] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2B3990]/5 transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleEnterVoiceMode}
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#2B3990] p-1.5 transition-colors"
                    title="Voice Call Mode"
                  >
                    <Mic size={15} />
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[#2B3990] p-2 text-white shadow-md shadow-[#2B3990]/10 hover:bg-[#1f2d7a] disabled:opacity-50 disabled:scale-100 transition-all active:scale-95"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_12px_32px_rgba(43,57,144,0.3)] transition-all duration-300 hover:scale-110 active:scale-95 overflow-hidden ${
          isOpen ? "bg-slate-800 rotate-90" : "bg-white/90 backdrop-blur-md border border-slate-500"
        }`}
      >
        {isOpen ? <X size={20} /> : <img src="/bot-icon.png" alt="Chatbot" className="h-10 w-12 object-cover" />}
      </button>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, X, MessageSquare, Loader2, Calendar, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

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
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  
  // Use refs for persistent event handlers to avoid closure stale state
  const isContinuousRef = useRef(false);
  const isVoiceModeRef = useRef(false);

  useEffect(() => {
    isContinuousRef.current = isContinuous;
    isVoiceModeRef.current = isVoiceMode;
  }, [isContinuous, isVoiceMode]);

  // Initialize Speech Recognition (Voxtral Realtime Logic)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn("Speech recognition not supported in this browser.");
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Changed to false for better "end of sentence" detection
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
          // In non-continuous mode, it stops automatically, but we call stop for safety
          recognitionRef.current?.stop();
        }
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // If we are in continuous mode and it wasn't a manual stop, restart
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
        // Silently handle "no-speech" as it's common in continuous mode
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
  }, []);

  const toggleListening = () => {
    if (isListening) {
      setIsContinuous(false);
      setIsVoiceMode(false); // Also exit voice mode if manually stopped
      recognitionRef.current?.stop();
    } else {
      setIsContinuous(true);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn("Recognition already started or failed:", e);
      }
    }
  };

  const handleEnterVoiceMode = () => {
    setIsVoiceMode(true);
    setIsContinuous(true);
    setIsTtsEnabled(true);
    setLastTranscript("Listening...");
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn("Recognition already started:", e);
    }
    speak("Voice mode activated. How can I help you?");
  };

  const handleExitVoiceMode = () => {
    setIsVoiceMode(false);
    setIsContinuous(false);
    recognitionRef.current?.stop();
    speak("Exiting voice mode.");
    setLastTranscript("");
  };

  // Voxtral TTS Logic
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

    // When bot finishes talking, start listening again if in continuous mode
    utterance.onend = () => {
      if (isContinuousRef.current || isVoiceModeRef.current) {
        // Faster restart for human-like feel
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

    // Always clear input after sending, whether from text or voice
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
          userDateTime: new Date().toLocaleString() // Pass user's local time
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "bot", text: data.answer, meeting: data.meeting }]);
      
      // Clear last transcript in voice mode once processed
      if (isVoiceMode) setLastTranscript("");

      // Voxtral TTS: Speak the answer
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

  // Simple markdown-to-JSX renderer for bold text
  const renderMessageText = (text) => {
    if (!text) return null;
    
    // Split by ** and map segments
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#2B3990] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/20 p-1.5">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Meeting Assistant</h3>
                <p className="text-[10px] opacity-80">
                  {isContinuous ? "Hands-free Mode Active" : "Voxtral Voice Enabled"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isContinuous && !isVoiceMode && (
                <div className="mr-2 flex items-center gap-1.5 rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-bold text-green-300 animate-pulse">
                  <div className="h-1 w-1 rounded-full bg-green-400"></div>
                  LIVE
                </div>
              )}
              {!isVoiceMode && (
                <button 
                  onClick={handleEnterVoiceMode}
                  className="rounded-lg p-1.5 hover:bg-white/10 transition-colors text-white"
                  title="Voice Interactive Mode"
                >
                  <Mic size={18} />
                </button>
              )}
              <button 
                onClick={() => setIsTtsEnabled(!isTtsEnabled)}
                className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
                title={isTtsEnabled ? "Mute" : "Unmute"}
              >
                {isTtsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages or Voice Mode */}
          {isVoiceMode ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-[#2B3990] p-8 text-center text-white">
              <div className="relative mb-12">
                {/* Pulsing rings */}
                <div className="absolute inset-0 animate-ping rounded-full bg-white/20"></div>
                <div className="absolute inset-0 animate-pulse rounded-full bg-white/10 [animation-delay:500ms]"></div>
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                  <Mic size={48} className={isListening ? "text-red-400 animate-pulse" : "text-white"} />
                </div>
              </div>
              
              <div className="mb-8 space-y-2">
                <h4 className="text-xl font-bold">I'm Listening...</h4>
                <p className="text-sm text-white/60 italic px-4 min-h-[3rem]">
                  {lastTranscript || "Say something..."}
                </p>
              </div>

              <div className="flex flex-col gap-4 w-full max-w-[200px]">
                <button
                  onClick={handleExitVoiceMode}
                  className="rounded-xl bg-white/10 px-6 py-3 text-sm font-bold backdrop-blur-sm hover:bg-white/20 transition-all border border-white/10"
                >
                  Exit Voice Mode
                </button>
                <p className="text-[10px] text-white/40">Say "End" to exit</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-line ${
                      msg.role === "user" 
                        ? "bg-[#2B3990] text-white rounded-tr-none" 
                        : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                    }`}>
                      {renderMessageText(msg.text)}
                      {msg.meeting && (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center gap-3">
                          <div className="rounded-lg bg-white p-2 text-[#2B3990] shadow-sm">
                            <Calendar size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{msg.meeting.title}</p>
                            <p className="text-[10px] text-slate-500">Meeting Scheduled</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 border border-slate-100 shadow-sm flex items-center gap-1">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="border-t border-slate-100 bg-white p-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isListening ? "Listening..." : "Type or speak to me..."}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm focus:border-[#2B3990] focus:outline-none focus:ring-1 focus:ring-[#2B3990] transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[#2B3990] p-1.5 text-white shadow-sm hover:bg-[#1f2d7a] disabled:opacity-50 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen ? "bg-slate-800 rotate-90" : "bg-[#2B3990]"
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
    </div>
  );
}

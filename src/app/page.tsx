"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Plus,
  MessageSquare,
  Mic,
  MicOff,
  Bot,
  Image as ImageIcon,
  Code,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Share2,
  MoreHorizontal,
  Sparkles,
  Paperclip,
  Search,
  Settings,
  Trash2,
  Edit3,
  Brain,
  Clock,
  Folder,
  Terminal,
  ChevronRight,
  Download,
  PanelLeft,
  Share,
  Sliders,
  Layers,
  Calendar,
  Zap,
  Globe,
  X,
  ArrowUp,
  AudioLines,
  PenLine
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  liked?: boolean | null;
  attachedFile?: string | null;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type SlashCommand = {
  id: string;
  title: string;
  subtitle: string;
  prefix: string;
  icon: any;
  iconColor: string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "photos",
    title: "Add photos & files",
    subtitle: "Upload from computer",
    prefix: "__file_upload__",
    icon: Paperclip,
    iconColor: "text-blue-400",
  },
  {
    id: "image",
    title: "Create an image",
    subtitle: "Generate realistic images with globalgeniusai",
    prefix: "/image ",
    icon: ImageIcon,
    iconColor: "text-purple-400",
  },
  {
    id: "coding",
    title: "Write or edit code",
    subtitle: "Write, debug and explain code with Cohere",
    prefix: "/coding ",
    icon: Code,
    iconColor: "text-emerald-400",
  },
  {
    id: "dictate",
    title: "Dictate",
    subtitle: "Convert speech to text",
    prefix: "__dictate__",
    icon: Mic,
    iconColor: "text-red-400",
  },
  {
    id: "think",
    title: "Thinking",
    subtitle: "Deep step-by-step reasoning",
    prefix: "/think ",
    icon: Brain,
    iconColor: "text-amber-400",
  },
  {
    id: "web",
    title: "Search the web",
    subtitle: "Find live web answers",
    prefix: "/search ",
    icon: Globe,
    iconColor: "text-cyan-400",
  },
  {
    id: "temporary",
    title: "Temporary chat",
    subtitle: "Start a private session",
    prefix: "__temporary__",
    icon: Clock,
    iconColor: "text-gray-400",
  },
];

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    title: "Bengali greeting response",
    updatedAt: Date.now(),
    messages: [
      {
        id: "m-1",
        role: "user",
        content: "hi",
        timestamp: Date.now() - 60000,
      },
      {
        id: "m-2",
        role: "assistant",
        content: "হ্যালো! আমি **globalgeniusai** 👋\n\nকেমন আছেন? আজ আপনাকে কীভাবে সাহায্য করতে পারি?",
        timestamp: Date.now() - 30000,
      },
    ],
  },
  {
    id: "conv-2",
    title: "Canva Editing Help",
    updatedAt: Date.now() - 3600000,
    messages: [],
  },
  {
    id: "conv-3",
    title: "Name field identification",
    updatedAt: Date.now() - 7200000,
    messages: [],
  },
  {
    id: "conv-4",
    title: "জেমা ২ এর কাজ",
    updatedAt: Date.now() - 14400000,
    messages: [],
  },
  {
    id: "conv-5",
    title: "PC তুলনা ও পরামর্শ",
    updatedAt: Date.now() - 28800000,
    messages: [],
  },
  {
    id: "conv-6",
    title: "রিপজিটরি পর্যালোচনা",
    updatedAt: Date.now() - 36000000,
    messages: [],
  },
  {
    id: "conv-7",
    title: "Create October Posts",
    updatedAt: Date.now() - 40000000,
    messages: [],
  },
  {
    id: "conv-8",
    title: "লাইসেন্স কী খোঁজা",
    updatedAt: Date.now() - 50000000,
    messages: [],
  },
  {
    id: "conv-9",
    title: "PDF সাইজ কমানো",
    updatedAt: Date.now() - 60000000,
    messages: [],
  },
  {
    id: "conv-10",
    title: "Logo Design Description",
    updatedAt: Date.now() - 70000000,
    messages: [],
  },
  {
    id: "conv-11",
    title: "বাংলা ডোমেইন সেবা",
    updatedAt: Date.now() - 80000000,
    messages: [],
  },
];

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string>("conv-new");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [topTab, setTopTab] = useState<"chat" | "work">("chat");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId);
  const messages = activeConversation?.messages || [];
  const isNewChat = messages.length === 0;

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isNewChat) {
      scrollToBottom();
    }
  }, [messages, isLoading, isNewChat]);

  // Handle Input Auto-resize & slash menu trigger
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + "px";
    }

    if (input.startsWith("/")) {
      setShowSlashMenu(true);
    }
  }, [input]);

  // Filtered Slash Commands
  const filteredCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!input.startsWith("/")) return true;
    const query = input.slice(1).toLowerCase();
    return (
      cmd.id.toLowerCase().includes(query) ||
      cmd.title.toLowerCase().includes(query) ||
      cmd.prefix.toLowerCase().includes(query)
    );
  });

  // Voice Input Speech Recognition
  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      showToast("Voice recognition is not supported in this browser. Please use Chrome.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "bn-BD";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
      showToast("Voice transcribed!");
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Text-to-Speech (Read Aloud)
  const toggleSpeak = (id: string, text: string) => {
    if (!("speechSynthesis" in window)) {
      showToast("Speech synthesis not supported.");
      return;
    }

    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/!\[.*?\]\(.*?\)/g, "").replace(/[*_`#]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 1000));
    utterance.rate = 1.0;
    utterance.onstart = () => setSpeakingMsgId(id);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    window.speechSynthesis.speak(utterance);
  };

  // Copy to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Like / Dislike toggle
  const handleRate = (msgId: string, liked: boolean) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConvId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              liked: m.liked === liked ? null : liked,
            };
          }),
        };
      })
    );
    showToast(liked ? "Feedback submitted (Liked 👍)" : "Feedback submitted (Disliked 👎)");
  };

  // Create New Chat
  const handleNewChat = () => {
    const newId = "conv-" + Date.now();
    const newConv: Conversation = {
      id: newId,
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
    setInput("");
    setShowSlashMenu(false);
    setAttachedImage(null);
  };

  // Delete Conversation
  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
    showToast("Conversation deleted");
  };

  // Handle Slash Command Selection
  const handleSelectCommand = (cmd: SlashCommand) => {
    setShowSlashMenu(false);
    if (cmd.prefix === "__file_upload__") {
      fileInputRef.current?.click();
      return;
    }
    if (cmd.prefix === "__dictate__") {
      startListening();
      return;
    }
    if (cmd.prefix === "__temporary__") {
      showToast("Temporary chat mode enabled 🕶️");
      return;
    }
    setInput(cmd.prefix);
    textareaRef.current?.focus();
  };

  // File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string);
        showToast(`Attached: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const textToSend = customPrompt || input.trim();
    if ((!textToSend && !attachedImage) || isLoading) return;

    setShowSlashMenu(false);
    setInput("");
    const userMsgId = "u-" + Date.now();
    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
      attachedFile: attachedImage,
    };
    setAttachedImage(null);

    // If on initial placeholder id, create a real conversation
    let currentConvId = activeConvId;
    let targetConv = conversations.find((c) => c.id === currentConvId);

    if (!targetConv) {
      currentConvId = "conv-" + Date.now();
      targetConv = {
        id: currentConvId,
        title: textToSend.slice(0, 26) || "New chat",
        messages: [],
        updatedAt: Date.now(),
      };
      setConversations((prev) => [targetConv!, ...prev]);
      setActiveConvId(currentConvId);
    } else if (targetConv.messages.length === 0) {
      targetConv.title = textToSend.slice(0, 26) || "New chat";
    }

    const newMessages = [...(targetConv?.messages || []), userMsg];

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentConvId) return c;
        return {
          ...c,
          title: c.messages.length === 0 ? textToSend.slice(0, 26) : c.title,
          messages: newMessages,
          updatedAt: Date.now(),
        };
      })
    );

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          thinkMode: isThinkingMode,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Network response error" }));
        throw new Error(err.error || "Network error");
      }

      setIsLoading(false);

      const aiMsgId = "ai-" + Date.now();
      const newAiMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConvId) return c;
          return {
            ...c,
            messages: [...newMessages, newAiMsg],
          };
        })
      );

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let done = false;
      let fullContent = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const text = decoder.decode(value, { stream: true });
          fullContent += text;

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== currentConvId) return c;
              return {
                ...c,
                messages: c.messages.map((m) => {
                  if (m.id !== aiMsgId) return m;
                  return { ...m, content: fullContent };
                }),
              };
            })
          );
        }
      }
    } catch (error: any) {
      console.error("Chat Error:", error);
      setIsLoading(false);
      const errorMsgId = "err-" + Date.now();
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConvId) return c;
          return {
            ...c,
            messages: [
              ...newMessages,
              {
                id: errorMsgId,
                role: "assistant",
                content: `⚠️ **Error:** ${error.message || "Could not generate response. Please try again."}`,
                timestamp: Date.now(),
              },
            ],
          };
        })
      );
    }
  };

  // Regenerate last AI response
  const handleRegenerate = () => {
    if (messages.length === 0 || isLoading) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      handleSendMessage(undefined, lastUserMsg.content);
    }
  };

  // Keyboard navigation for slash menu & send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Markdown & Code & Image Parser
  const renderMessageContent = (content: string) => {
    if (content.includes("```")) {
      const parts = content.split(/(```[\s\S]*?```)/g);
      return parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const language = lines[0].trim() || "code";
          const codeBody = lines.slice(language ? 1 : 0).join("\n");
          const blockId = `code-${index}-${Math.random()}`;

          return (
            <div key={index} className="my-4 rounded-xl overflow-hidden border border-white/15 bg-[#141414]">
              <div className="flex items-center justify-between px-4 py-2 bg-[#212121] text-xs text-gray-400 border-b border-white/10 font-mono">
                <span className="font-semibold text-gray-300 uppercase">{language}</span>
                <button
                  onClick={() => handleCopy(blockId, codeBody)}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  {copiedId === blockId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedId === blockId ? "Copied" : "Copy code"}</span>
                </button>
              </div>
              <pre className="p-4 text-sm font-mono overflow-x-auto text-emerald-300 leading-relaxed">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        return renderTextAndImages(part, index);
      });
    }

    return renderTextAndImages(content, 0);
  };

  const renderTextAndImages = (text: string, baseKey: number) => {
    const parts = text.split(/(!\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      const match = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) {
        const alt = match[1];
        const url = match[2];
        return (
          <div key={`${baseKey}-${i}`} className="my-4 group relative inline-block max-w-full">
            <div className="rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black/40">
              <img
                src={url}
                alt={alt}
                className="max-h-[420px] w-auto max-w-full object-cover rounded-2xl cursor-pointer hover:scale-[1.01] transition-transform duration-200"
                onClick={() => setPreviewImage(url)}
                loading="lazy"
              />
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-gray-400">
              <span className="truncate max-w-[280px] italic">"{alt}"</span>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 hover:bg-white/10 rounded-lg hover:text-white transition-colors flex items-center gap-1"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        );
      }

      let formatted = part
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>");

      return <span key={`${baseKey}-${i}`} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  // Reusable Chat Input Bar Component
  const renderInputForm = () => (
    <form
      onSubmit={handleSendMessage}
      className="flex items-center gap-2 bg-[#2f2f2f] border border-white/10 rounded-full shadow-2xl px-3 py-1.5 focus-within:border-white/25 transition-all w-full"
    >
      {/* + Button */}
      <button
        type="button"
        onClick={() => setShowSlashMenu(!showSlashMenu)}
        className={`p-2 rounded-full transition-all flex-shrink-0 ${
          showSlashMenu ? "bg-white/20 text-white rotate-45" : "text-gray-400 hover:text-white hover:bg-white/10"
        }`}
        title="Add photos, files & commands"
      >
        <Plus size={19} />
      </button>

      {/* Textarea Input */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything"
        className="flex-1 bg-transparent text-white resize-none focus:outline-none text-[15px] py-2 px-1 max-h-36 overflow-y-auto leading-relaxed placeholder-gray-400"
        rows={1}
        disabled={isLoading}
      />

      {/* Right Action Icons: Think Button, Mic, Audio/Send */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Think Toggle Button */}
        <button
          type="button"
          onClick={() => {
            setIsThinkingMode(!isThinkingMode);
            showToast(!isThinkingMode ? "Thinking mode enabled 💡" : "Thinking mode disabled");
          }}
          className={`px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all ${
            isThinkingMode
              ? "bg-white text-black font-semibold shadow-md"
              : "text-gray-400 hover:text-white hover:bg-white/10"
          }`}
          title="Thinking mode"
        >
          <Brain size={14} />
          <span>Think</span>
        </button>

        {/* Microphone / Dictate Voice Button */}
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`p-2 rounded-full transition-all ${
            isListening
              ? "bg-red-500 text-white animate-pulse"
              : "text-gray-400 hover:text-white hover:bg-white/10"
          }`}
          title="Dictate / Voice input"
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Send / Voice Mode Button (Screenshot exact blue audio wave / arrow button) */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            input.trim() || attachedImage
              ? "bg-white text-black hover:bg-gray-200 shadow-md"
              : "bg-[#2563eb] text-white hover:bg-blue-600 shadow-md"
          }`}
          title={input.trim() ? "Send message" : "Voice mode / Send"}
        >
          {input.trim() || attachedImage ? (
            <ArrowUp size={18} strokeWidth={2.5} />
          ) : (
            <AudioLines size={16} strokeWidth={2.2} />
          )}
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex h-screen bg-[#212121] text-gray-100 font-sans overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#323232] text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl border border-white/10 animate-fade-in flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-[#1a1a1a] p-2 rounded-2xl border border-white/20">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10"
            >
              <X size={18} />
            </button>
            <img src={previewImage} alt="Preview" className="max-h-[85vh] w-auto rounded-xl object-contain" />
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      {/* ================= LEFT SIDEBAR (Branded globalgeniusai) ================= */}
      <aside
        className={`${
          isSidebarOpen ? "w-[260px]" : "w-0"
        } transition-all duration-300 ease-in-out bg-[#171717] flex flex-col h-full overflow-hidden shrink-0 border-r border-white/5 relative z-20`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-[17px] tracking-tight px-2 text-white">
            <Sparkles size={17} className="text-blue-400" />
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              globalgeniusai
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Close sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pb-2">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-sm bg-transparent hover:bg-white/10 text-gray-200 transition-colors border border-white/10 font-medium"
          >
            <div className="flex items-center gap-2.5">
              <Plus size={16} />
              <span>New chat</span>
            </div>
            <Edit3 size={14} className="text-gray-400" />
          </button>
        </div>

        {/* Static Nav Links */}
        <div className="px-3 py-1 space-y-0.5 text-xs text-gray-300">
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <ImageIcon size={15} className="text-gray-400" />
            <span>Images</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Folder size={15} className="text-gray-400" />
            <span>Library</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Calendar size={15} className="text-gray-400" />
            <span>Scheduled</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Sliders size={15} className="text-gray-400" />
            <span>Plugins</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Layers size={15} className="text-gray-400" />
            <span>Projects</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Terminal size={15} className="text-gray-400" />
            <span>Codex</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400">
            <MoreHorizontal size={15} />
            <span>More</span>
          </button>
        </div>

        {/* Recents Section */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-1">Recents</div>
          {conversations.map((c) => {
            const isActive = c.id === activeConvId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`group flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                  isActive ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <span className="truncate flex-1">{c.title || "New chat"}</span>
                <button
                  onClick={(e) => handleDeleteChat(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                IH
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white leading-tight">IMRAN HOSSAIN</span>
                <span className="text-[10px] text-gray-400">Free</span>
              </div>
            </div>
            <button
              onClick={() => showToast("Upgrade to globalgeniusai Plus 🚀")}
              className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CHAT CONTAINER ================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#212121]">
        {/* Top Navbar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 sticky top-0 bg-[#212121]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-300 transition-colors"
                title="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <span className="font-semibold text-sm text-gray-200">
              {isNewChat ? "globalgeniusai" : activeConversation?.title || "globalgeniusai"}
            </span>
          </div>

          {/* Center Chat / Work Tab Switcher */}
          <div className="flex items-center bg-[#171717] p-0.5 rounded-full border border-white/10">
            <button
              onClick={() => setTopTab("chat")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                topTab === "chat" ? "bg-[#2f2f2f] text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => {
                setTopTab("work");
                showToast("Work & Workspace mode active");
              }}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                topTab === "work" ? "bg-[#2f2f2f] text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span>🔒</span>
              <span>Work</span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => showToast("Upgrade to globalgeniusai Pro 🚀")}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-full shadow-md transition-all"
            >
              <Sparkles size={13} />
              <span>Upgrade</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast("Chat link copied!");
              }}
              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-2.5 py-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Share size={14} />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </header>

        {/* Chat Messages / New Chat Center Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 scroll-smooth flex flex-col">
          {isNewChat ? (
            // ================= NEW CHAT EXACT SCREEN (Screenshot 1 Match) =================
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full px-4 -mt-6">
              {/* Center Title */}
              <h2 className="text-2xl md:text-[32px] font-medium tracking-tight text-white mb-6 text-center">
                What's on the agenda today?
              </h2>

              {/* Centered Input Form */}
              <div className="w-full relative mb-4">
                {/* Attached Image Preview */}
                {attachedImage && (
                  <div className="mb-2 inline-flex items-center gap-2 bg-[#2a2a2a] p-1.5 pr-3 rounded-xl border border-white/15 text-xs text-gray-200">
                    <img src={attachedImage} alt="Attach" className="w-8 h-8 object-cover rounded-lg" />
                    <span>Image attached</span>
                    <button
                      onClick={() => setAttachedImage(null)}
                      className="p-1 hover:text-red-400 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Slash Menu in Centered View */}
                {showSlashMenu && (
                  <div
                    ref={slashMenuRef}
                    className="absolute bottom-full mb-3 left-0 w-full max-w-md bg-[#242424] rounded-2xl border border-white/15 shadow-2xl overflow-hidden backdrop-blur-xl z-30 animate-fade-in"
                  >
                    <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
                      {filteredCommands.map((cmd, idx) => {
                        const IconComponent = cmd.icon;
                        const isSel = idx === selectedIndex;
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => handleSelectCommand(cmd)}
                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                              isSel ? "bg-[#333333] text-white" : "text-gray-300 hover:bg-[#2e2e2e]"
                            }`}
                          >
                            <div className="p-1.5 bg-white/5 rounded-lg">
                              <IconComponent size={16} className={cmd.iconColor} />
                            </div>
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-medium text-white">{cmd.title}</div>
                                <div className="text-[11px] text-gray-400 truncate">{cmd.subtitle}</div>
                              </div>
                              <ChevronRight size={14} className="text-gray-500" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {renderInputForm()}
              </div>

              {/* 3 Action Chips (Screenshot 1 Match) */}
              <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                <button
                  onClick={() => setInput("/image ")}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#262626] hover:bg-[#303030] border border-white/10 text-xs text-gray-300 hover:text-white transition-all shadow-sm flex-1"
                >
                  <ImageIcon size={15} className="text-purple-400" />
                  <span>Create an image</span>
                </button>

                <button
                  onClick={() => setInput("/coding ")}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#262626] hover:bg-[#303030] border border-white/10 text-xs text-gray-300 hover:text-white transition-all shadow-sm flex-1"
                >
                  <PenLine size={15} className="text-emerald-400" />
                  <span>Write or edit</span>
                </button>

                <button
                  onClick={() => setInput("/search ")}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#262626] hover:bg-[#303030] border border-white/10 text-xs text-gray-300 hover:text-white transition-all shadow-sm flex-1"
                >
                  <Globe size={15} className="text-cyan-400" />
                  <span>Search the web</span>
                </button>
              </div>
            </div>
          ) : (
            // ================= ACTIVE CHAT MESSAGES LIST =================
            <div className="max-w-3xl mx-auto w-full space-y-6 pt-6 pb-44">
              {messages.map((msg) => (
                <div key={msg.id} className="w-full">
                  {msg.role === "user" ? (
                    // USER MESSAGE (Right Aligned Bubble)
                    <div className="flex flex-col items-end group">
                      {msg.attachedFile && (
                        <img
                          src={msg.attachedFile}
                          alt="Attached"
                          className="max-w-[200px] max-h-[160px] rounded-xl mb-2 object-cover border border-white/10"
                        />
                      )}
                      <div className="bg-[#2f2f2f] text-white px-4 py-2.5 rounded-3xl max-w-[85%] sm:max-w-lg text-[15px] leading-relaxed break-words shadow-sm">
                        {msg.content}
                      </div>

                      {/* User message actions */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 mt-1.5 text-gray-400 text-xs transition-opacity pr-2">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => {
                            setInput(msg.content);
                            textareaRef.current?.focus();
                          }}
                          className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
                          title="Edit message"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ASSISTANT MESSAGE (Left Aligned)
                    <div className="flex flex-col items-start w-full group">
                      <div className="prose prose-invert max-w-none text-[15px] leading-relaxed text-gray-100 select-text">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Action buttons below AI reply */}
                      <div className="flex items-center gap-1 mt-3 text-gray-400 text-xs">
                        <button
                          onClick={() => toggleSpeak(msg.id, msg.content)}
                          className={`p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors ${
                            speakingMsgId === msg.id ? "text-emerald-400 bg-white/10" : ""
                          }`}
                          title="Read aloud"
                        >
                          {speakingMsgId === msg.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>

                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                        </button>

                        <button
                          onClick={() => handleRate(msg.id, true)}
                          className={`p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors ${
                            msg.liked === true ? "text-emerald-400 bg-white/10" : ""
                          }`}
                          title="Good response"
                        >
                          <ThumbsUp size={15} />
                        </button>

                        <button
                          onClick={() => handleRate(msg.id, false)}
                          className={`p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors ${
                            msg.liked === false ? "text-red-400 bg-white/10" : ""
                          }`}
                          title="Bad response"
                        >
                          <ThumbsDown size={15} />
                        </button>

                        <button
                          onClick={handleRegenerate}
                          className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                          title="Regenerate response"
                        >
                          <RotateCcw size={15} />
                        </button>

                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            showToast("Response copied to share!");
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                          title="Share"
                        >
                          <Share2 size={15} />
                        </button>

                        <button
                          onClick={() => showToast("More options")}
                          className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                          title="More"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  </div>
                  <span className="text-xs text-gray-500">globalgeniusai is thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ================= BOTTOM INPUT BAR (Visible during ongoing chats) ================= */}
        {!isNewChat && (
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#212121] via-[#212121] to-transparent pt-6 pb-5 px-4 z-20">
            <div className="max-w-3xl mx-auto relative">
              {/* Attached Image Preview */}
              {attachedImage && (
                <div className="mb-2 inline-flex items-center gap-2 bg-[#2a2a2a] p-1.5 pr-3 rounded-xl border border-white/15 text-xs text-gray-200">
                  <img src={attachedImage} alt="Attach" className="w-8 h-8 object-cover rounded-lg" />
                  <span>Image attached</span>
                  <button
                    onClick={() => setAttachedImage(null)}
                    className="p-1 hover:text-red-400 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Slash Popup Menu */}
              {showSlashMenu && (
                <div
                  ref={slashMenuRef}
                  className="absolute bottom-full mb-3 left-0 w-full max-w-md bg-[#242424] rounded-2xl border border-white/15 shadow-2xl overflow-hidden backdrop-blur-xl z-30 animate-fade-in"
                >
                  <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
                    {filteredCommands.map((cmd, idx) => {
                      const IconComponent = cmd.icon;
                      const isSel = idx === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => handleSelectCommand(cmd)}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                            isSel ? "bg-[#333333] text-white" : "text-gray-300 hover:bg-[#2e2e2e]"
                          }`}
                        >
                          <div className="p-1.5 bg-white/5 rounded-lg">
                            <IconComponent size={16} className={cmd.iconColor} />
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-medium text-white">{cmd.title}</div>
                              <div className="text-[11px] text-gray-400 truncate">{cmd.subtitle}</div>
                            </div>
                            <ChevronRight size={14} className="text-gray-500" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {renderInputForm()}

              <div className="text-[11px] text-center text-gray-500 mt-2">
                globalgeniusai can make mistakes. Check important info.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

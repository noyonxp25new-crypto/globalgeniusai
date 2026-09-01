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
  PenLine,
  Database,
  LogIn,
  LogOut,
  User as UserIcon,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Crown,
  AlertCircle,
  Pin,
  PinOff
} from "lucide-react";
import Link from "next/link";
import {
  db,
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User
} from "@/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const ADMIN_EMAIL = "noyonxp25@gmail.com";

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
  isPinned?: boolean;
};

type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  tier: "free" | "pro";
  isBanned: boolean;
  role: "admin" | "user";
  credits: number;
};

type GlobalConfig = {
  dailyFreeMinutes: number;
  dailyFreeMessages: number;
  maintenanceMode?: boolean;
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
    id: "audio",
    title: "Generate audio",
    subtitle: "Convert text to MP3",
    prefix: "/audio ",
    icon: Mic,
    iconColor: "text-pink-400",
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

export default function Home() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    dailyFreeMinutes: 15,
    dailyFreeMessages: 25,
  });

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Daily Usage Tracking
  const [todayMessageCount, setTodayMessageCount] = useState<number>(0);
  const [sessionMinutesSpent, setSessionMinutesSpent] = useState<number>(0);

  const [conversations, setConversations] = useState<Conversation[]>([]);
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
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitle, setEditChatTitle] = useState("");
  const [showImagesModal, setShowImagesModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId);
  const messages = activeConversation?.messages || [];
  const isNewChat = messages.length === 0;

  const [isProUser, setIsProUser] = useState(false);
  const [isBannedUser, setIsBannedUser] = useState(false);
  const isAdminUser = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || userProfile?.role === "admin";

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Timer: Track session usage for Free users
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionMinutesSpent((prev) => prev + 1);
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // 1. FIREBASE AUTH LISTENER & USER PROFILE SYNC
  useEffect(() => {
    let unsubProfileSnapshot: (() => void) | undefined;
    let unsubConfig: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setFirebaseConnected(true);
        const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        let initialProfile: UserProfile = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "User",
          photoURL: user.photoURL || null,
          tier: isAdmin ? "pro" : "free",
          isBanned: false,
          role: isAdmin ? "admin" : "user",
          credits: 0,
        };

        try {
          // ── Single master collection: users/{uid} ──
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef).catch(() => null);

          if (userSnap && userSnap.exists()) {
            const data = userSnap.data();
            initialProfile = {
              uid: user.uid,
              email: user.email || data.email,
              displayName: user.displayName || data.displayName || "User",
              photoURL: user.photoURL || data.photoURL || null,
              tier: isAdmin ? "pro" : (data.tier || "free"),
              isBanned: isAdmin ? false : !!data.isBanned,
              role: isAdmin ? "admin" : (data.role || "user"),
              credits: data.credits || 0,
            };
          }

          // Upsert user profile
          setDoc(userDocRef, {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || initialProfile.displayName,
            photoURL: user.photoURL || null,
            lastActive: serverTimestamp(),
            createdAt: initialProfile.credits !== undefined ? serverTimestamp() : serverTimestamp(),
          }, { merge: true }).catch(() => {});

          // Load today's daily usage from subcollection
          const today = new Date().toISOString().split("T")[0];
          const usageRef = doc(db, "users", user.uid, "dailyUsage", today);
          getDoc(usageRef).then((snap) => {
            if (snap.exists()) {
              setTodayMessageCount(snap.data().messageCount || 0);
            } else {
              setTodayMessageCount(0);
            }
          }).catch(() => {});

          // Realtime listener on user profile
          unsubProfileSnapshot = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const updated = snap.data();
                setUserProfile({
                  uid: user.uid,
                  email: updated.email || user.email || "",
                  displayName: updated.displayName || "User",
                  photoURL: updated.photoURL || null,
                  tier: updated.tier,
                  isBanned: !!updated.isBanned,
                  role: updated.role,
                  credits: updated.credits || 0,
                });
                setIsProUser(updated.tier === "pro" || isAdmin);
                
                const currentlyBanned = isAdmin ? false : !!updated.isBanned;
                setIsBannedUser(currentlyBanned);
                
                // Real-time ban abort
                if (currentlyBanned && abortControllerRef.current) {
                  abortControllerRef.current.abort();
                  showToast("⛔ Your account has been suspended by Admin. Generation aborted.");
                }
              }
            },
            () => {}
          );
        } catch {
          // Ignore
        }

        setUserProfile(initialProfile);

        // Listen to global config from Firestore (real-time)
        try {
          unsubConfig = onSnapshot(
            doc(db, "settings", "global_config"),
            (snap) => {
              if (snap.exists()) {
                const d = snap.data();
                setGlobalConfig({
                  dailyFreeMinutes: d.dailyFreeMinutes || 15,
                  dailyFreeMessages: d.dailyFreeMessages || 25,
                  maintenanceMode: !!d.maintenanceMode,
                });
              }
            },
            () => {}
          );
        } catch { /* ignore */ }
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfileSnapshot) unsubProfileSnapshot();
      if (unsubConfig) unsubConfig();
    };
  }, []);

  // 2. FIRESTORE REAL-TIME CHAT SYNC (chats/{uid}/sessions)
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribeFirestore: (() => void) | undefined;

    try {
      const sessionsRef = collection(db, "chats");
      const q = query(sessionsRef, where("userId", "==", currentUser.uid), limit(100));

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const loadedConvs: Conversation[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedConvs.push({
              id: docSnap.id,
              title: data.title || "New chat",
              messages: data.messages || [],
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
              isPinned: data.isPinned || false,
            });
          });

          setConversations((prev) => {
            const merged = loadedConvs.map((loaded) => {
              const prevConv = prev.find((p) => p.id === loaded.id);
              if (prevConv && prevConv.messages.length > loaded.messages.length) {
                // Keep local messages if we are actively streaming (local has more messages than remote)
                return { ...loaded, messages: prevConv.messages };
              }
              return loaded;
            });
            return merged.sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return b.updatedAt - a.updatedAt;
            });
          });
          setFirebaseConnected(true);
        },
        () => {}
      );
    } catch { /* ignore */ }

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [currentUser]);

  // Auth Submit Handlers
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      if (authMode === "signup") {
        if (!authEmail || !authPassword) {
          throw new Error("Please enter both email and password.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (authDisplayName.trim()) {
          await updateProfile(userCredential.user, {
            displayName: authDisplayName.trim(),
          });
        }
        showToast(`Welcome, ${authDisplayName || authEmail}! 🎉`);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        showToast("Logged in successfully! 🚀");
      }
      setShowAuthModal(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthDisplayName("");
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message || "Authentication failed.";
      if (err.code === "auth/email-already-in-use") msg = "This email is already registered. Please log in.";
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") msg = "Invalid email or password.";
      if (err.code === "auth/weak-password") msg = "Password should be at least 6 characters.";
      setAuthError(msg);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      showToast(`Welcome, ${result.user.displayName || "User"}! 🎉`);
      setShowAuthModal(false);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setAuthError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowUserMenu(false);
      showToast("Logged out successfully.");
    } catch (err: any) {
      showToast("Error signing out.");
    }
  };

  // Save Conversation to Firestore (chats/{id})
  const saveConversationToFirestore = async (conv: Conversation) => {
    if (!currentUser) return;
    try {
      const sessionRef = doc(db, "chats", conv.id);
      await setDoc(sessionRef, {
        id: conv.id,
        userId: currentUser.uid,
        title: conv.title,
        messages: conv.messages,
        messageCount: conv.messages.length,
        isPinned: conv.isPinned || false,
        updatedAt: serverTimestamp(),
        // Only set createdAt if it's not already set in the frontend, or let Firestore keep the old one via merge
      }, { merge: true });
      setFirebaseConnected(true);
    } catch (err: any) {
      console.error("Firestore Save Error in saveConversationToFirestore:", err);
      // Don't silently ignore, we need to see this error if it happens
    }
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
        const updated = {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              liked: m.liked === liked ? null : liked,
            };
          }),
        };
        saveConversationToFirestore(updated);
        return updated;
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

  const getAllGeneratedImages = () => {
    const images: { url: string; prompt: string; convId: string }[] = [];
    conversations.forEach((conv) => {
      conv.messages.forEach((msg) => {
        if (msg.role === "assistant") {
          const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
          let match;
          while ((match = regex.exec(msg.content)) !== null) {
            images.push({ prompt: match[1], url: match[2], convId: conv.id });
          }
        }
      });
    });
    return images;
  };

  // Delete Conversation
  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
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

    if (currentUser) {
      try {
        // Delete session from chats/{uid}/sessions/{id}
        await deleteDoc(doc(db, "chats", currentUser.uid, "sessions", id));
        showToast("Chat deleted");
      } catch { /* ignore */ }
    }
  };

  const handleRenameChat = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editChatTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      const updated = { ...conv, title: editChatTitle.trim(), updatedAt: Date.now() };
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
      saveConversationToFirestore(updated);
    }
    setEditingChatId(null);
    setOpenMenuId(null);
  };

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      const updated = { ...conv, isPinned: !conv.isPinned, updatedAt: Date.now() };
      setConversations((prev) => {
        const mapped = prev.map((c) => (c.id === id ? updated : c));
        return mapped.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.updatedAt - a.updatedAt;
        });
      });
      saveConversationToFirestore(updated);
    }
    setOpenMenuId(null);
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

  // File Upload (Cloudinary)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("File size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      setPreviewImage(base64Image);

      setIsUploadingImage(true);
      showToast("Uploading image securely...");

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: base64Image }),
        });

        const data = await res.json();
        if (data.secure_url) {
          setAttachedImage(data.secure_url);
          showToast("Image attached! 🖼️");
        } else {
          throw new Error(data.error || "Upload failed");
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        showToast(`Upload failed: ${err.message}`);
        setPreviewImage(null);
        setAttachedImage(null);
      } finally {
        setIsUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Check Daily Limit for Free Users
  const checkDailyLimitExceeded = () => {
    if (isProUser) return false;
    if (todayMessageCount >= globalConfig.dailyFreeMessages) return true;
    if (sessionMinutesSpent >= globalConfig.dailyFreeMinutes) return true;
    return false;
  };

  // Send Message with Firestore Sync & Ban / Limit Checks
  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const textToSend = customPrompt || input.trim();
    if ((!textToSend && !attachedImage) || isLoading) return;

    // 1. Check if Banned
    if (isBannedUser) {
      showToast("⛔ Your account has been suspended by Admin.");
      return;
    }

    // 2. Check Daily Free Tier Limits
    if (checkDailyLimitExceeded()) {
      setShowUpgradeModal(true);
      return;
    }

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

    // Increment daily message count (stored in users/{uid}/dailyUsage/{date})
    if (!isProUser && currentUser) {
      const newCount = todayMessageCount + 1;
      setTodayMessageCount(newCount);
      const today = new Date().toISOString().split("T")[0];
      setDoc(
        doc(db, "users", currentUser.uid, "dailyUsage", today),
        { messageCount: newCount, date: today },
        { merge: true }
      ).catch(() => {});
    }

    let currentConvId = activeConvId;
    let targetConv = conversations.find((c) => c.id === currentConvId);

    if (!targetConv || targetConv.id === "conv-new") {
      currentConvId = "conv-" + Date.now();
      targetConv = {
        id: currentConvId,
        title: textToSend.slice(0, 26) || "New chat",
        messages: [],
        updatedAt: Date.now(),
      };
      setConversations((prev) => [targetConv!, ...prev.filter((c) => c.id !== "conv-new")]);
      setActiveConvId(currentConvId);
    } else if (targetConv.messages.length === 0) {
      targetConv.title = textToSend.slice(0, 26) || "New chat";
    }

    const newMessages = [...(targetConv?.messages || []), userMsg];
    const updatedConv: Conversation = {
      ...targetConv!,
      title: targetConv!.messages.length === 0 ? textToSend.slice(0, 26) : targetConv!.title,
      messages: newMessages,
      updatedAt: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === currentConvId ? updatedConv : c))
    );

    saveConversationToFirestore(updatedConv);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
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

      const finalMessagesWithAi = [...newMessages, newAiMsg];

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConvId) return c;
          return {
            ...c,
            messages: finalMessagesWithAi,
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

      const completedConv: Conversation = {
        ...updatedConv,
        messages: newMessages.concat({
          ...newAiMsg,
          content: fullContent,
        }),
        updatedAt: Date.now(),
      };
      saveConversationToFirestore(completedConv);
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn("Fetch aborted due to ban.");
        setIsLoading(false);
        return;
      }
      console.error("Chat Error:", error);
      setIsLoading(false);
      const errorMsgId = "err-" + Date.now();
      const errorConv: Conversation = {
        ...updatedConv,
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
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConvId ? errorConv : c))
      );
      saveConversationToFirestore(errorConv);
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
  const renderInputForm = () => {
    const isMaintenanceBlocked = globalConfig.maintenanceMode && !isAdminUser;
    
    if (isMaintenanceBlocked) {
      return (
        <div className="flex items-center gap-2 bg-[#2f2f2f] border border-red-500/30 rounded-full shadow-2xl px-4 py-3 w-full justify-center">
          <span className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <Lock size={16} />
            System is currently in Maintenance Mode.
          </span>
        </div>
      );
    }

    return (
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
        disabled={isLoading || isBannedUser}
      />

      {/* Right Action Icons */}
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
          <span className="hidden sm:inline">Think</span>
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

        {/* Send Button */}
        <button
          type="submit"
          disabled={isLoading || isBannedUser || isUploadingImage}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            input.trim() || (attachedImage && !isUploadingImage)
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
  };

  const userDisplayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";
  const userInitials = (userDisplayName[0] || "U").toUpperCase();



  return (
    <div className="flex h-screen bg-[#212121] text-gray-100 font-sans overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#323232] text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl border border-white/10 animate-fade-in flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

        {/* ================= IMAGES MODAL ================= */}
      {showImagesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-[#1e1e1e] border border-white/10 rounded-3xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ImageIcon className="text-purple-400" />
                Generated Images
              </h2>
              <button onClick={() => setShowImagesModal(false)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {(() => {
                  const imgs = getAllGeneratedImages();
                  if (imgs.length === 0) return <div className="col-span-full text-center text-gray-500 py-10">No generated images yet. Create one with /image!</div>;
                  return imgs.map((img, i) => (
                    <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer" onClick={() => { setActiveConvId(img.convId); setShowImagesModal(false); }}>
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <p className="text-white text-[10px] font-medium line-clamp-2">{img.prompt}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= UPGRADE POPUP MODAL ================= */}
      {showUpgradeModal && !isProUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1e1e1e] border border-amber-500/30 rounded-3xl p-6 shadow-2xl animate-fade-in text-center">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 mb-3 shadow-xl text-white">
              <Crown size={28} />
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Daily Limit Reached!</h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              You have exhausted your daily free tier allowance ({globalConfig.dailyFreeMinutes} mins or {globalConfig.dailyFreeMessages} messages). Upgrade to <strong>PRO</strong> for unlimited AI generation, coding & faster responses!
            </p>

            <div className="bg-[#282828] p-4 rounded-2xl border border-white/10 mb-5 text-left text-xs space-y-2 text-gray-300">
              <div className="flex items-center gap-2 text-purple-300 font-semibold">
                <Check size={14} className="text-emerald-400" />
                <span>Unlimited daily time & messages</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                <span>Zero Upgrade Popups</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                <span>High-Speed Pollinations & Cohere Code</span>
              </div>
            </div>

            <button
              onClick={() => {
                showToast("Please contact Administrator (noyonxp25@gmail.com) for Pro Activation 👑");
                setShowUpgradeModal(false);
              }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-xl"
            >
              Upgrade to PRO (Unlimited)
            </button>
          </div>
        </div>
      )}

      {/* ================= AUTHENTICATION MODAL ================= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1e1e1e] border border-white/15 rounded-3xl p-6 shadow-2xl animate-fade-in">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 mb-3 shadow-lg">
                <Sparkles size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {authMode === "login" ? "Welcome back" : "Create your account"}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {authMode === "login"
                  ? "Log in to sync your globalgeniusai chats across devices."
                  : "Sign up to access AI features & unlimited cloud history."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmittingAuth}
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-white text-black font-semibold text-sm rounded-xl hover:bg-gray-100 transition-all shadow-md mb-4 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authMode === "signup" && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Your Name</label>
                  <input
                    type="text"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    placeholder="e.g. Imran Hossain"
                    className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-white/30"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 block mb-1">Email address</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isSubmittingAuth ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{authMode === "login" ? "Log in" : "Create account"}</span>
              </button>
            </form>

            <div className="text-center mt-5 text-xs text-gray-400">
              {authMode === "login" ? (
                <p>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                    }}
                    className="text-blue-400 hover:underline font-semibold"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                    }}
                    className="text-blue-400 hover:underline font-semibold"
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>
          </div>
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

      {/* ================= LEFT SIDEBAR ================= */}
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`${
          isSidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full w-0 md:w-0"
        } transition-all duration-300 ease-in-out bg-[#171717] flex flex-col h-full overflow-hidden shrink-0 border-r border-white/5 absolute md:relative z-40`}
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

        {/* Static Nav Links & Admin Shortcut */}
        <div className="px-3 py-1 space-y-0.5 text-xs text-gray-300">
          {isAdminUser && (
            <Link
              href="/admin"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 border border-red-500/30 text-amber-300 font-semibold hover:from-red-600/40 hover:to-amber-600/40 transition-all shadow-md mb-2"
            >
              <ShieldAlert size={16} className="text-amber-400" />
              <span>Admin Panel</span>
            </Link>
          )}

          <button onClick={() => setShowImagesModal(true)} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <ImageIcon size={15} className="text-gray-400" />
            <span>Images</span>
          </button>
          <button onClick={() => showToast("Coming soon")} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Folder size={15} className="text-gray-400" />
            <span>Library</span>
          </button>
          <button onClick={() => showToast("Coming soon")} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Calendar size={15} className="text-gray-400" />
            <span>Scheduled</span>
          </button>
          <button onClick={() => showToast("Coming soon")} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Sliders size={15} className="text-gray-400" />
            <span>Plugins</span>
          </button>
          <button onClick={() => showToast("Coming soon")} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <Layers size={15} className="text-gray-400" />
            <span>Projects</span>
          </button>
        </div>

        {/* Recents Section */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 pb-32 relative">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-1 flex items-center justify-between">
            <span>Recents</span>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${firebaseConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
              <span className="text-[9px] font-bold text-emerald-400">ACTIVE</span>
            </div>
          </div>

          {openMenuId && (
            <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)} />
          )}

          {conversations.map((c) => {
            const isActive = c.id === activeConvId;
            const isEditing = editingChatId === c.id;
            
            return (
              <div
                key={c.id}
                onClick={() => {
                  if (!isEditing) setActiveConvId(c.id);
                }}
                className={`group relative flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                  isActive ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                {isEditing ? (
                  <form onSubmit={(e) => handleRenameChat(e, c.id)} className="flex-1 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editChatTitle}
                      onChange={(e) => setEditChatTitle(e.target.value)}
                      onBlur={(e) => handleRenameChat(e as any, c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-white/30 rounded -ml-1 pl-1"
                    />
                  </form>
                ) : (
                  <div className="truncate flex-1 pr-4 flex items-center gap-1.5">
                    {c.isPinned && <Pin size={11} className="text-gray-500 shrink-0" />}
                    <span className="truncate">{c.title || "New chat"}</span>
                  </div>
                )}

                {!isEditing && (
                  <div className={`absolute right-2 flex items-center transition-opacity ${openMenuId === c.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <div className="w-4 h-full absolute -left-4 bg-gradient-to-r from-transparent to-[#171717] group-hover:to-[#222222]" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === c.id ? null : c.id);
                      }}
                      className="p-1 hover:text-white transition-colors text-gray-400 relative z-10 rounded-md hover:bg-white/10"
                      title="Options"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                )}

                {openMenuId === c.id && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-[#262626] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden text-gray-300 py-1">
                    <button
                      onClick={(e) => handleTogglePin(e, c.id)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left"
                    >
                      {c.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                      <span>{c.isPinned ? "Unpin" : "Pin"}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChatId(c.id);
                        setEditChatTitle(c.title || "New chat");
                        setOpenMenuId(null);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left"
                    >
                      <Edit3 size={13} />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(window.location.href);
                        showToast("Link copied!");
                        setOpenMenuId(null);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-white/10 transition-colors text-left"
                    >
                      <Share2 size={13} />
                      <span>Share</span>
                    </button>
                    <div className="h-px bg-white/10 my-1 w-full" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        handleDeleteChat(e, c.id);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-red-500/10 hover:text-red-400 transition-colors text-left text-red-500"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Profile / Auth Footer */}
        <div className="p-3 border-t border-white/10 relative">
          {currentUser ? (
            // LOGGED IN USER PILL
            <div>
              {showUserMenu && (
                <div className="absolute bottom-full mb-2 left-3 right-3 bg-[#242424] rounded-2xl border border-white/15 shadow-2xl p-2 z-30 animate-fade-in space-y-1">
                  <div className="px-3 py-2 border-b border-white/10">
                    <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                      <span>{userDisplayName}</span>
                      {isProUser && <Crown size={12} className="text-purple-400" />}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{currentUser.email}</div>
                  </div>

                  {isAdminUser && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-medium transition-colors"
                    >
                      <ShieldAlert size={14} className="text-amber-400" />
                      <span>Admin Dashboard</span>
                    </Link>
                  )}

                  {!isProUser && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowUpgradeModal(true);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-purple-300 font-semibold transition-colors"
                    >
                      <Crown size={14} className="text-purple-400" />
                      <span>Upgrade to Pro</span>
                    </button>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-red-500/10 text-xs text-red-400 transition-colors"
                  >
                    <LogOut size={14} />
                    <span>Log out</span>
                  </button>
                </div>
              )}

              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover shadow-md" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                      {userInitials}
                    </div>
                  )}
                  <div className="flex flex-col truncate max-w-[110px]">
                    <span className="text-xs font-semibold text-white truncate leading-tight flex items-center gap-1">
                      <span>{userDisplayName}</span>
                      {isProUser && <Crown size={11} className="text-purple-400" />}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {isProUser ? "PRO Unlimited" : "Free Tier"}
                    </span>
                  </div>
                </div>

                {/* Hide upgrade button for PRO users */}
                {!isProUser && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUpgradeModal(true);
                    }}
                    className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md transition-colors"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          ) : (
            // LOGGED OUT STATE
            <div className="space-y-2">
              <button
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl transition-all shadow-md"
              >
                <LogIn size={14} />
                <span>Log in</span>
              </button>
              <button
                onClick={() => {
                  setAuthMode("signup");
                  setShowAuthModal(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition-all"
              >
                <UserIcon size={14} />
                <span>Sign up for free</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ================= MAIN CHAT CONTAINER ================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#212121]">
        {/* Top Navbar */}
        <header className="h-14 flex items-center justify-between px-2 sm:px-4 border-b border-white/5 sticky top-0 bg-[#212121]/90 backdrop-blur-md z-10 gap-2">
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg text-gray-300 transition-colors"
                title="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <span className="font-semibold text-xs sm:text-sm text-gray-200 truncate max-w-[100px] sm:max-w-[200px]">
              {isNewChat ? "globalgeniusai" : activeConversation?.title || "globalgeniusai"}
            </span>
          </div>

          {isBannedUser && (
            <div className="absolute left-1/2 -translate-x-1/2 top-14 sm:top-auto sm:static bg-red-500/20 text-red-400 px-3 py-1 sm:px-4 sm:py-1.5 rounded-b-lg sm:rounded-full text-[10px] sm:text-xs font-bold border border-t-0 sm:border-t border-red-500/30 flex items-center gap-1 sm:gap-2 shadow-lg sm:shadow-none z-20 whitespace-nowrap">
              <Lock size={12} className="sm:w-3.5 sm:h-3.5" />
              <span>Your account is suspended</span>
            </div>
          )}

          {/* Center Chat / Work Tab Switcher */}
          <div className="hidden md:flex items-center bg-[#171717] p-0.5 rounded-full border border-white/10 flex-shrink-0">
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

          {/* Right Action Buttons / Auth */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {isAdminUser && (
              <Link
                href="/admin"
                className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold bg-red-600/30 text-amber-300 border border-red-500/30 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full hover:bg-red-600/40 transition-colors shadow-sm"
              >
                <ShieldCheck size={13} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {!currentUser ? (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
                className="text-[10px] sm:text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full transition-colors"
              >
                Log in
              </button>
            ) : null}

            {/* Upgrade Button only for Free Users */}
            {!isProUser && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-md transition-all whitespace-nowrap"
              >
                <Sparkles size={12} className="sm:w-[13px] sm:h-[13px]" />
                <span>Upgrade</span>
              </button>
            )}

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

            {currentUser && (
              <button
                onClick={handleSignOut}
                className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>

        {/* Chat Messages / New Chat Center Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 scroll-smooth flex flex-col">
          {isNewChat ? (
            // ================= NEW CHAT EXACT SCREEN =================
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
                    
                    {/* Uploading State Overlay */}
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center backdrop-blur-sm z-20">
                        <Loader2 size={16} className="text-white animate-spin" />
                      </div>
                    )}
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

              {/* 3 Action Chips */}
              <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                <button
                  onClick={() => setInput("/image ")}
                  className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-[#262626] hover:bg-[#303030] border border-white/10 text-xs text-gray-300 hover:text-white transition-all shadow-sm flex-1"
                >
                  <ImageIcon size={15} className="text-purple-400" />
                  <span>Create an image</span>
                </button>

                <button
                  onClick={() => setInput("/coding ")}
                  className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-[#262626] hover:bg-[#303030] border border-white/10 text-xs text-gray-300 hover:text-white transition-all shadow-sm flex-1"
                >
                  <PenLine size={15} className="text-emerald-400" />
                  <span>Write or edit</span>
                </button>

                <button
                  onClick={() => setInput("/search ")}
                  className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-[#262626] hover:bg-[#303030] border border-white/10 text-xs text-gray-300 hover:text-white transition-all shadow-sm flex-1"
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
                    // USER MESSAGE
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
                    // ASSISTANT MESSAGE
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

        {/* ================= BOTTOM INPUT BAR ================= */}
        {!isNewChat && (
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#212121] via-[#212121] to-transparent pt-6 pb-6 sm:pb-5 px-2 sm:px-4 z-20">
            <div className="max-w-3xl mx-auto relative">
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

/**
 * db.ts — Central Firestore helper library
 * All typed Firestore operations for globalgeniusai
 */
import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  getDocs,
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserTier = "free" | "pro";
export type UserRole = "admin" | "user";

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  tier: UserTier;
  isBanned: boolean;
  credits: number;           // Admin-controlled credits
  createdAt: Timestamp | number;
  lastActive: Timestamp | number;
}

export interface DailyUsage {
  messageCount: number;
  minutesUsed: number;
  date: string; // YYYY-MM-DD
}

export interface ChatSession {
  id: string;
  title: string;
  model?: string;
  messageCount: number;
  createdAt: Timestamp | number;
  updatedAt: Timestamp | number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Timestamp | number;
  imageUrl?: string | null;
  liked?: boolean | null;
  attachedFile?: string | null;
}

export interface GlobalConfig {
  dailyFreeMinutes: number;
  dailyFreeMessages: number;
  maintenanceMode: boolean;
  updatedAt?: Timestamp | number;
}

export interface AdminLog {
  action: string;
  targetUid: string;
  targetEmail: string;
  performedBy: string;
  timestamp: Timestamp | number;
  details?: Record<string, any>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function todayDateString(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

export function tsToMs(ts: Timestamp | number | undefined | null): number {
  if (!ts) return Date.now();
  if (typeof ts === "number") return ts;
  return ts.toMillis?.() ?? Date.now();
}

// ─── User Operations ─────────────────────────────────────────────────────────

/** Get user document from `users/{uid}` */
export async function getUser(uid: string): Promise<UserDoc | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserDoc) : null;
  } catch {
    return null;
  }
}

/** Create or merge user profile into `users/{uid}` */
export async function upsertUser(uid: string, data: Partial<UserDoc>): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid), { ...data, lastActive: serverTimestamp() }, { merge: true });
  } catch { /* ignore permissions */ }
}

/** Subscribe to realtime user profile changes */
export function subscribeToUser(uid: string, cb: (user: UserDoc | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => cb(snap.exists() ? (snap.data() as UserDoc) : null),
    () => cb(null)
  );
}

// ─── Daily Usage ─────────────────────────────────────────────────────────────

/** Get today's usage for a user */
export async function getTodayUsage(uid: string): Promise<DailyUsage> {
  const date = todayDateString();
  try {
    const snap = await getDoc(doc(db, "users", uid, "dailyUsage", date));
    if (snap.exists()) return snap.data() as DailyUsage;
  } catch { /* ignore */ }
  return { messageCount: 0, minutesUsed: 0, date };
}

/** Increment message count for today */
export async function incrementMessageCount(uid: string): Promise<number> {
  const date = todayDateString();
  const ref = doc(db, "users", uid, "dailyUsage", date);
  try {
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data().messageCount || 0) : 0;
    const newCount = current + 1;
    await setDoc(ref, { messageCount: newCount, minutesUsed: snap.data()?.minutesUsed || 0, date }, { merge: true });
    return newCount;
  } catch {
    return 0;
  }
}

/** Update minutes used for today */
export async function updateMinutesUsed(uid: string, minutes: number): Promise<void> {
  const date = todayDateString();
  const ref = doc(db, "users", uid, "dailyUsage", date);
  try {
    await setDoc(ref, { minutesUsed: minutes, date }, { merge: true });
  } catch { /* ignore */ }
}

// ─── Chat Sessions ────────────────────────────────────────────────────────────

/** Subscribe to all chat sessions for a user */
export function subscribeToSessions(
  uid: string,
  cb: (sessions: ChatSession[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "chats", uid, "sessions"),
    orderBy("updatedAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const sessions: ChatSession[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatSession, "id">),
      }));
      cb(sessions);
    },
    () => cb([])
  );
}

/** Create or update a chat session */
export async function upsertSession(uid: string, session: Partial<ChatSession> & { id: string }): Promise<void> {
  try {
    await setDoc(
      doc(db, "chats", uid, "sessions", session.id),
      { ...session, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch { /* ignore */ }
}

/** Delete a chat session and all its messages */
export async function deleteSession(uid: string, sessionId: string): Promise<void> {
  try {
    // Delete all messages first
    const msgsSnap = await getDocs(collection(db, "chats", uid, "sessions", sessionId, "messages"));
    await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
    // Delete session doc
    await deleteDoc(doc(db, "chats", uid, "sessions", sessionId));
  } catch { /* ignore */ }
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

/** Subscribe to messages in a session */
export function subscribeToMessages(
  uid: string,
  sessionId: string,
  cb: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "chats", uid, "sessions", sessionId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatMessage, "id">),
      }));
      cb(msgs);
    },
    () => cb([])
  );
}

/** Add a message to a session */
export async function addMessage(
  uid: string,
  sessionId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">
): Promise<string> {
  try {
    const ref = await addDoc(
      collection(db, "chats", uid, "sessions", sessionId, "messages"),
      { ...msg, createdAt: serverTimestamp() }
    );
    return ref.id;
  } catch {
    return "local-" + Date.now();
  }
}

/** Update a message (e.g. final AI content after streaming) */
export async function updateMessage(
  uid: string,
  sessionId: string,
  msgId: string,
  data: Partial<ChatMessage>
): Promise<void> {
  try {
    await updateDoc(doc(db, "chats", uid, "sessions", sessionId, "messages", msgId), data);
  } catch { /* ignore */ }
}

// ─── Global Settings ──────────────────────────────────────────────────────────

/** Subscribe to global config changes */
export function subscribeToConfig(cb: (config: GlobalConfig) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "settings", "global_config"),
    (snap) => {
      if (snap.exists()) {
        cb(snap.data() as GlobalConfig);
      } else {
        cb({ dailyFreeMinutes: 15, dailyFreeMessages: 25, maintenanceMode: false });
      }
    },
    () => cb({ dailyFreeMinutes: 15, dailyFreeMessages: 25, maintenanceMode: false })
  );
}

/** Get global config once */
export async function getGlobalConfig(): Promise<GlobalConfig> {
  try {
    const snap = await getDoc(doc(db, "settings", "global_config"));
    if (snap.exists()) return snap.data() as GlobalConfig;
  } catch { /* ignore */ }
  return { dailyFreeMinutes: 15, dailyFreeMessages: 25, maintenanceMode: false };
}

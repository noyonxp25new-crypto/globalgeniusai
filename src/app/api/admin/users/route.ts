import { NextResponse } from "next/server";
import { JWT } from "google-auth-library";
import fs from "fs";
import path from "path";

const ROOT_ADMIN_EMAIL = "noyonxp25@gmail.com";
const PROJECT_ID = "globalgeniusai-78d4f";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const IT_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

// ── Token cache ──────────────────────────────────────────────────────────────
let _token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  if (_token && _token.exp > Date.now() + 60_000) return _token.value;

  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  if (!privateKey) return null;

  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n");

  try {
    const client = new JWT({
      email: process.env.FIREBASE_CLIENT_EMAIL,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/firebase",
        "https://www.googleapis.com/auth/datastore",
      ],
    });
    const { access_token } = await client.authorize();
    if (access_token) {
      _token = { value: access_token, exp: Date.now() + 3_500_000 };
      return access_token;
    }
  } catch (e: any) {
    console.error("getToken error:", e.message);
  }
  return null;
}

// ── Firebase Auth REST ───────────────────────────────────────────────────────
async function listAuthUsers(token: string): Promise<any[]> {
  const users: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${IT_BASE}/accounts:batchGet?maxResults=1000${pageToken ? `&nextPageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data = await res.json();
    if (data.users) users.push(...data.users);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return users;
}

async function deleteAuthUser(token: string, uid: string) {
  await fetch(`${IT_BASE}/accounts:delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  }).catch(() => {});
}

// ── Firestore REST ───────────────────────────────────────────────────────────
async function fsGetCollection(token: string, col: string): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  try {
    const res = await fetch(`${FS_BASE}/${col}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return map;
    const data = await res.json();
    for (const docItem of data.documents ?? []) {
      map.set(docItem.name.split("/").pop()!, fsToObj(docItem.fields ?? {}));
    }
  } catch { /* ignore */ }
  return map;
}

async function fsGetDoc(token: string, docPath: string): Promise<any | null> {
  try {
    const res = await fetch(`${FS_BASE}/${docPath}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return fsToObj(data.fields ?? {});
  } catch { return null; }
}

async function fsPatch(token: string, docPath: string, obj: Record<string, any>) {
  const mask = Object.keys(obj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  await fetch(`${FS_BASE}/${docPath}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: objToFs(obj) }),
  }).catch(() => {});
}

async function fsCreate(token: string, col: string, obj: Record<string, any>) {
  await fetch(`${FS_BASE}/${col}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: objToFs(obj) }),
  }).catch(() => {});
}

async function fsDelete(token: string, docPath: string) {
  await fetch(`${FS_BASE}/${docPath}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ── Firestore converters ─────────────────────────────────────────────────────
function fsToObj(fields: Record<string, any>): any {
  const r: any = {};
  for (const [k, v] of Object.entries(fields)) r[k] = fsVal(v);
  return r;
}
function fsVal(v: any): any {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return new Date(v.timestampValue).getTime();
  if (v.mapValue !== undefined) return fsToObj(v.mapValue.fields ?? {});
  if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map(fsVal);
  return null;
}
function objToFs(obj: Record<string, any>): Record<string, any> {
  const f: any = {};
  for (const [k, v] of Object.entries(obj)) f[k] = toFsVal(v);
  return f;
}
function toFsVal(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === "object") return { mapValue: { fields: objToFs(v) } };
  return { stringValue: String(v) };
}

// ── Audit log helper ─────────────────────────────────────────────────────────
async function writeAuditLog(token: string, action: string, targetUid: string, targetEmail: string, performedBy: string, details: Record<string, any> = {}) {
  await fsCreate(token, "admin_logs", {
    action,
    targetUid,
    targetEmail,
    performedBy,
    timestamp: new Date().toISOString(),
    details,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
// ═══════════════════════════════════════════════════════════════════════════
export async function GET() {
  const token = await getToken();

  const authUsers: any[] = token ? await listAuthUsers(token) : [];
  const metaMap = new Map<string, any>();

  if (token) {
    const usersMap = await fsGetCollection(token, "users");
    usersMap.forEach((v, k) => metaMap.set(k, v));
  }

  const seen = new Set<string>();
  const userList: any[] = [];

  for (const u of authUsers) {
    const uid: string = u.localId;
    seen.add(uid);
    const meta = metaMap.get(uid) ?? {};
    const isRoot = (u.email ?? "").toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
    userList.push({
      uid,
      email: u.email ?? "",
      displayName: u.displayName ?? meta.displayName ?? (u.email ? u.email.split("@")[0] : "User"),
      photoURL: u.photoUrl ?? meta.photoURL ?? null,
      tier: isRoot ? "pro" : (meta.tier ?? "free"),
      isBanned: isRoot ? false : !!meta.isBanned,
      role: isRoot ? "admin" : (meta.role ?? "user"),
      credits: meta.credits ?? 0,
      createdAt: u.createdAt ? Number(u.createdAt) : (meta.createdAt ?? Date.now()),
      lastActive: u.lastLoginAt ? Number(u.lastLoginAt) : (meta.lastActive ?? Date.now()),
    });
  }

  // Include Firestore-only users
  metaMap.forEach((meta, uid) => {
    if (seen.has(uid)) return;
    const isRoot = (meta.email ?? "").toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
    userList.push({
      uid,
      email: meta.email ?? "",
      displayName: meta.displayName ?? (meta.email?.split("@")[0] ?? "User"),
      photoURL: meta.photoURL ?? null,
      tier: isRoot ? "pro" : (meta.tier ?? "free"),
      isBanned: isRoot ? false : !!meta.isBanned,
      role: isRoot ? "admin" : (meta.role ?? "user"),
      credits: meta.credits ?? 0,
      createdAt: meta.createdAt ?? Date.now(),
      lastActive: meta.lastActive ?? Date.now(),
    });
  });

  userList.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Settings
  let settings = { dailyFreeMinutes: 15, dailyFreeMessages: 25, maintenanceMode: false };
  if (token) {
    const sd = await fsGetDoc(token, "settings/global_config");
    if (sd) {
      settings = {
        dailyFreeMinutes: Number(sd.dailyFreeMinutes) || 15,
        dailyFreeMessages: Number(sd.dailyFreeMessages) || 25,
        maintenanceMode: !!sd.maintenanceMode,
      };
    }
  }

  // Recent audit logs (last 50)
  let auditLogs: any[] = [];
  if (token) {
    try {
      const logsRes = await fetch(`${FS_BASE}/admin_logs?pageSize=50&orderBy=timestamp%20desc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        auditLogs = (logsData.documents ?? []).map((d: any) => ({
          id: d.name.split("/").pop(),
          ...fsToObj(d.fields ?? {}),
        }));
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ users: userList, settings, auditLogs });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/admin/users
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(req: Request) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Service account unavailable." }, { status: 503 });
  }

  const body = await req.json();
  const { action, uid, email, role, tier, isBanned, credits, settings, newUserData, performedBy = "admin" } = body;

  // ── DELETE USER ────────────────────────────────────────────────────────────
  if (action === "delete_user") {
    if ((email ?? "").toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase())
      return NextResponse.json({ error: "Root admin cannot be deleted." }, { status: 400 });
    await deleteAuthUser(token, uid);
    await fsDelete(token, `users/${uid}`);
    await writeAuditLog(token, "DELETE_USER", uid, email, performedBy, { email });
    return NextResponse.json({ success: true });
  }

  // ── UPDATE ROLE ────────────────────────────────────────────────────────────
  if (action === "update_role") {
    if ((email ?? "").toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() && role !== "admin")
      return NextResponse.json({ error: "Root admin role is immutable." }, { status: 400 });
    await fsPatch(token, `users/${uid}`, { role });
    await writeAuditLog(token, "UPDATE_ROLE", uid, email, performedBy, { newRole: role });
    return NextResponse.json({ success: true, role });
  }

  // ── TOGGLE BAN ─────────────────────────────────────────────────────────────
  if (action === "toggle_ban") {
    if ((email ?? "").toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() && isBanned)
      return NextResponse.json({ error: "Root admin cannot be banned." }, { status: 400 });
    await fsPatch(token, `users/${uid}`, { isBanned });
    await writeAuditLog(token, isBanned ? "BAN_USER" : "UNBAN_USER", uid, email, performedBy);
    return NextResponse.json({ success: true, isBanned });
  }

  // ── TOGGLE TIER ────────────────────────────────────────────────────────────
  if (action === "toggle_tier") {
    await fsPatch(token, `users/${uid}`, { tier });
    await writeAuditLog(token, "UPDATE_TIER", uid, email, performedBy, { newTier: tier });
    return NextResponse.json({ success: true, tier });
  }

  // ── ADD / SET CREDITS ──────────────────────────────────────────────────────
  if (action === "add_credits") {
    const currentUser = await fsGetDoc(token, `users/${uid}`);
    const currentCredits = Number(currentUser?.credits ?? 0);
    const delta = Number(credits ?? 0);
    const newCredits = Math.max(0, currentCredits + delta);
    await fsPatch(token, `users/${uid}`, { credits: newCredits });
    await writeAuditLog(token, "UPDATE_CREDITS", uid, email, performedBy, { delta, newCredits, previousCredits: currentCredits });
    return NextResponse.json({ success: true, credits: newCredits });
  }

  // ── SAVE GLOBAL SETTINGS ───────────────────────────────────────────────────
  if (action === "save_settings") {
    const dailyFreeMinutes = Number(settings.dailyFreeMinutes) || 15;
    const dailyFreeMessages = Number(settings.dailyFreeMessages) || 25;
    const maintenanceMode = !!settings.maintenanceMode;
    await fsPatch(token, "settings/global_config", {
      dailyFreeMinutes,
      dailyFreeMessages,
      maintenanceMode,
      updatedAt: new Date().toISOString(),
    });
    await writeAuditLog(token, "UPDATE_SETTINGS", "system", "system", performedBy, { dailyFreeMinutes, dailyFreeMessages, maintenanceMode });
    return NextResponse.json({ success: true, settings: { dailyFreeMinutes, dailyFreeMessages, maintenanceMode } });
  }

  // ── CREATE USER (Firestore record) ─────────────────────────────────────────
  if (action === "create_user") {
    const cleanEmail = (newUserData.email ?? "").trim().toLowerCase();
    const record = {
      uid: newUserData.uid ?? `fs-${Date.now()}`,
      email: cleanEmail,
      displayName: newUserData.displayName ?? cleanEmail.split("@")[0],
      photoURL: null,
      tier: newUserData.tier ?? "free",
      role: newUserData.role ?? "user",
      isBanned: false,
      credits: 0,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    await fsPatch(token, `users/${record.uid}`, record);
    await writeAuditLog(token, "CREATE_USER", record.uid, cleanEmail, performedBy);
    return NextResponse.json({ success: true, user: record });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

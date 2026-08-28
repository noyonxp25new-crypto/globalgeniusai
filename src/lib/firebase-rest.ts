/**
 * Firebase Admin REST API Helper
 * Uses Google Identity Toolkit REST API to list/manage users WITHOUT firebase-admin SDK.
 * This avoids the OpenSSL ERR_OSSL_UNSUPPORTED issue with private keys on Windows.
 *
 * We use Google's OAuth2 "service account JWT" flow to get an access token,
 * then call Firebase Identity Toolkit & Firestore REST APIs directly.
 */

import { createSign } from "crypto";
import fs from "fs";
import path from "path";

let _cachedToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount() {
  const jsonPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  }
  return null;
}

// Build a JWT for OAuth2 service account auth
function buildJWT(sa: any): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;

  // Fix the private key: replace literal \n with real newlines and add = padding if needed
  let privateKey: string = sa.private_key;
  privateKey = privateKey.replace(/\\n/g, "\n");

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

export async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60000) {
    return _cachedToken.token;
  }

  const sa = getServiceAccount();
  if (!sa) return null;

  try {
    const jwt = buildJWT(sa);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("OAuth2 token error:", res.status, text);
      return null;
    }

    const data = await res.json();
    _cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return _cachedToken.token;
  } catch (e: any) {
    console.error("getAccessToken error:", e.message);
    return null;
  }
}

const PROJECT_ID = "globalgeniusai-78d4f";
const FIRETORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// List all Firebase Auth users via REST
export async function listAuthUsers(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const users: any[] = [];
  let nextPageToken: string | undefined;

  try {
    do {
      const body: any = { maxResults: 1000 };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?access_token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("listAuthUsers error:", res.status, text);
        break;
      }

      const data = await res.json();
      if (data.users) users.push(...data.users);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
  } catch (e: any) {
    console.error("listAuthUsers exception:", e.message);
  }

  return users;
}

// Delete a Firebase Auth user via REST
export async function deleteAuthUser(uid: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localId: uid }),
    }
  );
  return res.ok;
}

// Read all docs from a Firestore collection via REST
export async function firestoreGetCollection(collection: string): Promise<Map<string, any>> {
  const token = await getAccessToken();
  const result = new Map<string, any>();
  if (!token) return result;

  try {
    const res = await fetch(`${FIRETORE_BASE}/${collection}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return result;
    const data = await res.json();
    if (!data.documents) return result;

    for (const doc of data.documents) {
      const id = doc.name.split("/").pop();
      result.set(id, firestoreDocToObject(doc.fields || {}));
    }
  } catch (e: any) {
    console.error("firestoreGetCollection error:", e.message);
  }
  return result;
}

// Get a single Firestore doc
export async function firestoreGetDoc(docPath: string): Promise<any | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${FIRETORE_BASE}/${docPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return firestoreDocToObject(data.fields || {});
  } catch {
    return null;
  }
}

// Set/merge a Firestore doc
export async function firestoreSetDoc(docPath: string, obj: Record<string, any>): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const fields = objectToFirestoreFields(obj);
  const updateMask = Object.keys(obj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");

  try {
    const res = await fetch(`${FIRETORE_BASE}/${docPath}?${updateMask}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (e: any) {
    console.error("firestoreSetDoc error:", e.message);
    return false;
  }
}

// Delete a Firestore doc
export async function firestoreDeleteDoc(docPath: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(`${FIRETORE_BASE}/${docPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Convert Firestore REST format to plain object
function firestoreDocToObject(fields: Record<string, any>): any {
  const result: any = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = firestoreValueToJs(val);
  }
  return result;
}

function firestoreValueToJs(val: any): any {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return Number(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return new Date(val.timestampValue).getTime();
  if (val.mapValue !== undefined) return firestoreDocToObject(val.mapValue.fields || {});
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(firestoreValueToJs);
  return null;
}

// Convert plain object to Firestore REST field format
function objectToFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = jsToFirestoreValue(val);
  }
  return fields;
}

function jsToFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  if (typeof val === "object") return { mapValue: { fields: objectToFirestoreFields(val) } };
  return { stringValue: String(val) };
}

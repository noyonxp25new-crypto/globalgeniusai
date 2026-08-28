import { NextResponse } from "next/server";
import { JWT } from "google-auth-library";
import fs from "fs";
import path from "path";

const PROJECT_ID = "globalgeniusai-78d4f";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let _token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  if (_token && _token.exp > Date.now() + 60_000) return _token.value;
  const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (!fs.existsSync(keyPath)) return null;
  try {
    const sa = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/datastore"],
    });
    const { access_token } = await client.authorize();
    if (access_token) {
      _token = { value: access_token, exp: Date.now() + 3_500_000 };
      return access_token;
    }
  } catch (e: any) {
    console.error("Settings token error:", e.message);
  }
  return null;
}

function fsVal(v: any): any {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  return null;
}

export async function GET() {
  try {
    const token = await getToken();
    if (token) {
      const res = await fetch(`${FS_BASE}/settings/global_config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const f = data.fields ?? {};
        return NextResponse.json({
          dailyFreeMinutes: Number(fsVal(f.dailyFreeMinutes)) || 15,
          dailyFreeMessages: Number(fsVal(f.dailyFreeMessages)) || 25,
        });
      }
    }
    return NextResponse.json({ dailyFreeMinutes: 15, dailyFreeMessages: 25 });
  } catch {
    return NextResponse.json({ dailyFreeMinutes: 15, dailyFreeMessages: 25 });
  }
}

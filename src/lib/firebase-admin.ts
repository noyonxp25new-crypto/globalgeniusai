import { getApps, initializeApp, cert, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let adminApp: App | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApp();
    return adminApp;
  }

  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
    if (privateKey) {
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");

      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      return adminApp;
    } else {
      console.warn("No FIREBASE_PRIVATE_KEY found in environment variables.");
    }
  } catch (err: any) {
    console.error("Firebase Admin initialization error:", err.message);
  }

  return null;
}

export function getAdminAuth(): Auth | null {
  if (authInstance) return authInstance;
  const app = getAdminApp();
  if (app) {
    authInstance = getAuth(app);
    return authInstance;
  }
  return null;
}

export function getAdminDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  const app = getAdminApp();
  if (app) {
    dbInstance = getFirestore(app);
    return dbInstance;
  }
  return null;
}

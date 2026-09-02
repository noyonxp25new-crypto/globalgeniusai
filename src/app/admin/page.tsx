"use client";

import { useState, useEffect, useCallback } from "react";
import {
  auth,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  onAuthStateChanged,
  type User
} from "@/firebase";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Sparkles,
  Search,
  Check,
  X,
  Lock,
  Unlock,
  Crown,
  ArrowLeft,
  Settings,
  Clock,
  LogOut,
  Sliders,
  AlertTriangle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  UserPlus,
  Shield,
  Zap
} from "lucide-react";
import Link from "next/link";

const ROOT_ADMIN_EMAIL = "noyonxp25@gmail.com";
const MASTER_ADMIN_PASS = "805222";

type UserData = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  tier: "free" | "pro";
  isBanned: boolean;
  role: "admin" | "user";
  credits: number;
  createdAt?: any;
  lastActive?: any;
};

type GlobalSettings = {
  dailyFreeMinutes: number;
  dailyFreeMessages: number;
  maintenanceMode: boolean;
  updatedAt?: any;
};

type AuditLog = {
  id: string;
  action: string;
  targetEmail: string;
  performedBy: string;
  timestamp: any;
  details?: Record<string, any>;
};

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Admin login form states
  const [adminEmail, setAdminEmail] = useState(ROOT_ADMIN_EMAIL);
  const [adminPass, setAdminPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Data states
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<"all" | "admin" | "pro" | "free" | "banned">("all");
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    dailyFreeMinutes: 15,
    dailyFreeMessages: 25,
    maintenanceMode: false,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  // Add / Sync User Modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState<"free" | "pro">("free");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [isAddingUser, setIsAddingUser] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch real data from server API
  const fetchAdminData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.users && Array.isArray(data.users)) {
          setUsers(data.users);
        }
        if (data.settings) {
          setGlobalSettings({
            dailyFreeMinutes: Number(data.settings.dailyFreeMinutes) || 15,
            dailyFreeMessages: Number(data.settings.dailyFreeMessages) || 25,
            maintenanceMode: !!data.settings.maintenanceMode,
          });
        }
        if (data.auditLogs && Array.isArray(data.auditLogs)) {
          setAuditLogs(data.auditLogs);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch admin data:", err.message);
    } finally {
      if (!quiet) setIsLoadingUsers(false);
    }
  }, []);

  // Check auth and verify if user is admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const isRootAdmin = user.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
        if (isRootAdmin) {
          setIsAdmin(true);
        } else {
          // Check if admin in database
          try {
            const res = await fetch("/api/admin/users", { cache: "no-store" });
            if (res.ok) {
              const data = await res.json();
              const match = data.users?.find((u: any) => u.uid === user.uid || u.email?.toLowerCase() === user.email?.toLowerCase());
              if (match && match.role === "admin") {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            }
          } catch {
            setIsAdmin(false);
          }
        }
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // Polling data when Admin is active
  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminData();
    const interval = setInterval(() => {
      fetchAdminData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [isAdmin, fetchAdminData]);

  // Robust Admin Login Handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    const emailTrimmed = adminEmail.trim().toLowerCase();
    const passTrimmed = adminPass.trim();

    try {
      if (emailTrimmed === ROOT_ADMIN_EMAIL.toLowerCase() && passTrimmed === MASTER_ADMIN_PASS) {
        setIsAdmin(true);
        showToast("Super Admin Verified! 🛡️");
        setIsLoggingIn(false);
        return;
      }

      let authUser: any = null;
      try {
        const res = await signInWithEmailAndPassword(auth, emailTrimmed, passTrimmed);
        authUser = res.user;
      } catch (signInErr: any) {
        if (
          signInErr.code === "auth/invalid-credential" ||
          signInErr.code === "auth/user-not-found" ||
          signInErr.code === "auth/wrong-password"
        ) {
          try {
            const createRes = await createUserWithEmailAndPassword(auth, emailTrimmed, passTrimmed);
            authUser = createRes.user;
          } catch (createErr: any) {
            if (emailTrimmed === ROOT_ADMIN_EMAIL.toLowerCase() && passTrimmed === MASTER_ADMIN_PASS) {
              setIsAdmin(true);
              showToast("Super Admin Verified via Master Key 🛡️");
              return;
            }
            throw new Error(createErr.message || "Authentication failed.");
          }
        } else {
          throw signInErr;
        }
      }

      if (authUser) {
        if (emailTrimmed === ROOT_ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
          showToast("Admin access granted! 🛡️");
        } else {
          const res = await fetch("/api/admin/users", { cache: "no-store" });
          const data = await res.json();
          const match = data.users?.find((u: any) => u.uid === authUser.uid);
          if (match && match.role === "admin") {
            setIsAdmin(true);
            showToast("Admin access granted! 🛡️");
          } else {
            throw new Error("This account does not have Administrator permissions.");
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (emailTrimmed === ROOT_ADMIN_EMAIL.toLowerCase() && passTrimmed === MASTER_ADMIN_PASS) {
        setIsAdmin(true);
        showToast("Super Admin Verified via Master Key 🛡️");
      } else {
        setLoginError(err.message || "Invalid Admin Credentials.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google Login for Admin
  const handleAdminGoogleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
        showToast(`Welcome Super Admin, ${result.user.displayName}! 👑`);
      } else {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        const data = await res.json();
        const match = data.users?.find((u: any) => u.uid === result.user.uid);
        if (match && match.role === "admin") {
          setIsAdmin(true);
          showToast(`Welcome Admin, ${result.user.displayName}! 🛡️`);
        } else {
          setLoginError("This Google account is not an Administrator.");
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Google sign-in failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Toggle Admin Role
  const handleToggleAdminRole = async (user: UserData) => {
    if (user.email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) {
      showToast("Root administrator role cannot be removed.");
      return;
    }

    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_role", uid: user.uid, email: user.email, role: newRole }),
      });

      if (!res.ok) throw new Error("Failed to update role");

      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, role: newRole } : u))
      );

      showToast(
        newRole === "admin"
          ? `👑 ${user.email} is now an ADMINISTRATOR!`
          : `Admin privileges removed for ${user.email}.`
      );
    } catch (err: any) {
      showToast("Error updating role: " + err.message);
    }
  };

  // Toggle Ban / Unban
  const handleToggleBan = async (user: UserData) => {
    if (user.email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) {
      showToast("Root administrator cannot be banned.");
      return;
    }

    const newBanStatus = !user.isBanned;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_ban", uid: user.uid, email: user.email, isBanned: newBanStatus }),
      });

      if (!res.ok) throw new Error("Failed to update ban status");

      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, isBanned: newBanStatus } : u))
      );

      showToast(newBanStatus ? `User ${user.email} has been BANNED 🚫` : `User ${user.email} has been UNBANNED ✅`);
    } catch (err: any) {
      showToast("Error updating status: " + err.message);
    }
  };

  // Toggle Upgrade Pro / Free
  const handleToggleUpgrade = async (user: UserData) => {
    const newTier = user.tier === "pro" ? "free" : "pro";
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_tier", uid: user.uid, email: user.email, tier: newTier }),
      });

      if (!res.ok) throw new Error("Failed to update plan");

      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, tier: newTier } : u))
      );

      showToast(newTier === "pro" ? `User upgraded to PRO (Unlimited) 👑` : `User downgraded to Free Tier`);
    } catch (err: any) {
      showToast("Error updating plan: " + err.message);
    }
  };

  // Add / Sync New User
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsAddingUser(true);
    try {
      const cleanEmail = newEmail.trim().toLowerCase();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_user",
          newUserData: {
            email: cleanEmail,
            displayName: newName.trim() || cleanEmail.split("@")[0],
            tier: newTier,
            role: newRole,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to add user");

      showToast(`User ${cleanEmail} created & synced successfully! 🎉`);
      setShowAddUserModal(false);
      setNewEmail("");
      setNewName("");
      setNewTier("free");
      setNewRole("user");
      fetchAdminData();
    } catch (err: any) {
      showToast("Error adding user: " + err.message);
    } finally {
      setIsAddingUser(false);
    }
  };

  // Delete User completely from Firebase Auth & Database
  const handleDeleteUser = async (uid: string, email: string) => {
    if (email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase()) {
      showToast("Root administrator cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently remove user ${email}?`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_user", uid, email }),
      });

      if (!res.ok) throw new Error("Failed to delete user");

      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      showToast(`User ${email} permanently deleted from Authentication & Database`);
    } catch (err: any) {
      showToast("Error removing user: " + err.message);
    }
  };

  // Save Daily Limit Settings + Maintenance Mode
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_settings",
          settings: globalSettings,
          performedBy: currentUser?.email || "admin",
        }),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      showToast("Settings saved & applied! ⚙️");
    } catch (err: any) {
      showToast("Error saving settings: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Add / Deduct Credits for a user
  const handleAddCredits = async (user: UserData) => {
    const delta = parseInt(creditInputs[user.uid] || "0", 10);
    if (isNaN(delta) || delta === 0) {
      showToast("Enter a valid credit amount (positive to add, negative to deduct)");
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_credits",
          uid: user.uid,
          email: user.email,
          credits: delta,
          performedBy: currentUser?.email || "admin",
        }),
      });
      if (!res.ok) throw new Error("Failed to update credits");
      const data = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, credits: data.credits } : u))
      );
      setCreditInputs((prev) => ({ ...prev, [user.uid]: "" }));
      showToast(`Credits updated! New balance: ${data.credits} 💰`);
    } catch (err: any) {
      showToast("Error: " + err.message);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTier === "admin") return u.role === "admin";
    if (filterTier === "pro") return u.tier === "pro" && !u.isBanned;
    if (filterTier === "free") return u.tier === "free" && !u.isBanned;
    if (filterTier === "banned") return u.isBanned;
    return true;
  });

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const proUsers = users.filter((u) => u.tier === "pro").length;
  const freeUsers = users.filter((u) => u.tier === "free").length;
  const bannedUsers = users.filter((u) => u.isBanned).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <RefreshCw className="animate-spin text-blue-400" size={24} />
          <span>Verifying Admin Permissions...</span>
        </div>
      </div>
    );
  }

  // ================= ADMIN LOGIN SCREEN =================
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#121212] text-gray-100 flex flex-col items-center justify-center p-4">
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#323232] text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl border border-white/10 flex items-center gap-2">
            <Sparkles size={14} className="text-blue-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="w-full max-w-md bg-[#1e1e1e] border border-white/15 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 mb-3 shadow-xl">
              <ShieldAlert size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">globalgeniusai Admin</h2>
            <p className="text-xs text-gray-400 mt-1">
              Sign in with <strong>{ROOT_ADMIN_EMAIL}</strong> to manage users, roles & limits.
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleAdminGoogleLogin}
            disabled={isLoggingIn}
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
            <span>Sign in with Google</span>
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">or email & password</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Admin Password</label>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="Enter password (e.g. 805222)"
                className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              <span>Enter Admin Dashboard</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1">
              <ArrowLeft size={14} />
              <span>Back to Chat App</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ================= ADMIN DASHBOARD =================
  return (
    <div className="min-h-screen bg-[#121212] text-gray-100 font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#323232] text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl border border-white/10 flex items-center gap-2 animate-fade-in">
          <Sparkles size={14} className="text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add / Sync User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1e1e1e] border border-white/15 rounded-3xl p-6 shadow-2xl animate-fade-in">
            <button type="button"
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-2 text-white shadow-lg">
                <UserPlus size={22} />
              </div>
              <h3 className="text-lg font-bold text-white">Create / Sync User</h3>
              <p className="text-xs text-gray-400 mt-0.5">User will be saved directly to Firebase Auth & Database.</p>
            </div>

            <form onSubmit={handleAddUserSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">User Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="User Name"
                  className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Plan / Tier</label>
                  <select
                    value={newTier}
                    onChange={(e: any) => setNewTier(e.target.value)}
                    className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/30"
                  >
                    <option value="free">Free Tier</option>
                    <option value="pro">PRO (Unlimited) 👑</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e: any) => setNewRole(e.target.value)}
                    className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/30"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator 🛡️</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAddingUser}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {isAddingUser ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Create & Sync User</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Admin Navbar */}
      <header className="h-16 border-b border-white/10 bg-[#1a1a1a] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors flex items-center gap-1 sm:gap-2 text-xs"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-sm sm:text-lg text-white">
            <ShieldCheck size={20} className="text-emerald-400" />
            <span className="hidden sm:inline">globalgeniusai Admin</span>
            <span className="sm:hidden">Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button"
            onClick={() => {
              fetchAdminData();
              showToast("Refreshed with Firebase Authentication! ⚡");
            }}
            disabled={isLoadingUsers}
            className="px-2 py-1.5 sm:px-3 bg-[#2a2a2a] hover:bg-[#333] text-gray-200 border border-white/10 font-semibold text-[10px] sm:text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw size={14} className={isLoadingUsers ? "animate-spin text-blue-400" : "text-amber-400"} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>

          <button type="button"
            onClick={() => setShowAddUserModal(true)}
            className="px-2 py-1.5 sm:px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] sm:text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">Add / Sync User</span>
            <span className="sm:hidden">Add User</span>
          </button>

          <button type="button"
            onClick={() => {
              signOut(auth).catch(() => {});
              setIsAdmin(false);
            }}
            className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Log out from Admin"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Total Users</span>
              <div className="p-1.5 bg-blue-500/10 rounded-xl text-blue-400"><Users size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{totalUsers}</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Admins</span>
              <div className="p-1.5 bg-red-500/10 rounded-xl text-amber-400"><Shield size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1.5">{adminUsers}</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">PRO Users</span>
              <div className="p-1.5 bg-purple-500/10 rounded-xl text-purple-400"><Crown size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-purple-300 mt-1.5">{proUsers}</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Free Tier</span>
              <div className="p-1.5 bg-gray-500/10 rounded-xl text-gray-400"><Clock size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-gray-200 mt-1.5">{freeUsers}</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-lg col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Banned</span>
              <div className="p-1.5 bg-red-500/10 rounded-xl text-red-400"><Lock size={16} /></div>
            </div>
            <div className="text-2xl font-bold text-red-400 mt-1.5">{bannedUsers}</div>
          </div>
        </div>

        {/* Daily Limits Settings Panel */}
        <div className="p-6 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-xl">
          <div className="flex items-center gap-2.5 mb-2">
            <Sliders size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white">Daily Free User Limits Configuration</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Adjust daily limits for Free tier users. Pro & Admin users are unlimited and never see limit popups.
          </p>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">
                Daily Free Time Limit (Minutes/day)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={globalSettings.dailyFreeMinutes}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, dailyFreeMinutes: Number(e.target.value) })
                  }
                  className="w-full bg-[#262626] text-white border border-white/10 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-white/30"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-500">mins</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1.5">
                Daily Free Message Limit (Messages/day)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={globalSettings.dailyFreeMessages}
                  onChange={(e) =>
                    setGlobalSettings({ ...globalSettings, dailyFreeMessages: Number(e.target.value) })
                  }
                  className="w-full bg-[#262626] text-white border border-white/10 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-white/30"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-500">msgs</span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[#262626] border border-white/10 rounded-xl px-4 h-[38px]">
              <input
                type="checkbox"
                id="maintenanceToggle"
                checked={globalSettings.maintenanceMode}
                onChange={(e) => setGlobalSettings({ ...globalSettings, maintenanceMode: e.target.checked })}
                className="w-4 h-4 rounded bg-[#1e1e1e] border-white/20 text-red-500 focus:ring-red-500 focus:ring-offset-gray-900"
              />
              <label htmlFor="maintenanceToggle" className="text-xs font-medium text-red-400 cursor-pointer select-none">
                Enable Maintenance Mode (Block all users)
              </label>
            </div>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 h-[38px] sm:col-span-3"
            >
              {isSavingSettings ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              <span>Save & Apply Settings</span>
            </button>
          </form>
        </div>

        {/* Users Management Table */}
        <div className="p-6 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">All Users Directory ({filteredUsers.length})</h3>
              <p className="text-xs text-gray-400">
                Grant Admin privileges, Upgrade to Pro, or Ban accounts with one click.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#262626] text-white pl-9 pr-3.5 py-2 rounded-xl text-xs border border-white/10 focus:outline-none focus:border-white/30 w-40 sm:w-56"
                />
              </div>

              <select
                value={filterTier}
                onChange={(e: any) => setFilterTier(e.target.value)}
                className="bg-[#262626] text-white text-xs border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-white/30"
              >
                <option value="all">All Users</option>
                <option value="admin">Admins Only 🛡️</option>
                <option value="pro">Pro Only 👑</option>
                <option value="free">Free Only</option>
                <option value="banned">Banned 🚫</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#242424] text-gray-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Plan / Tier</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Credits</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#1e1e1e]">
                {isLoadingUsers && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-blue-400" />
                        <span>Loading real users from Firebase Authentication...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-500">
                      No users found. Click "Add / Sync User" button above to sync users directly.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                              {(user.displayName?.[0] || user.email?.[0] || "U").toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{user.displayName || "User"}</span>
                            </div>
                            <div className="text-[11px] text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Shield size={12} />
                            <span>ADMIN</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">User</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {user.tier === "pro" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Crown size={12} />
                            <span>PRO / Unlimited</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-500/20 text-gray-300">
                            <span>Free Tier</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {user.isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                            <XCircle size={12} />
                            <span>BANNED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 size={12} />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-300 w-8">{user.credits || 0}</span>
                          <input
                            type="number"
                            value={creditInputs[user.uid] ?? ""}
                            onChange={(e) => setCreditInputs({ ...creditInputs, [user.uid]: e.target.value })}
                            placeholder="±"
                            className="w-12 bg-[#2a2a2a] text-white border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none"
                          />
                          <button type="button"
                            onClick={() => handleAddCredits(user)}
                            className="p-1 bg-[#333] hover:bg-blue-600 rounded-lg transition-colors text-white"
                            title="Add/Deduct Credits"
                          >
                            <Zap size={14} />
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5 text-right space-x-1.5">
                        {/* 1. Toggle Admin Role Button */}
                        {user.email.toLowerCase() !== ROOT_ADMIN_EMAIL.toLowerCase() && (
                          <button type="button"
                            onClick={() => handleToggleAdminRole(user)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1 ${
                              user.role === "admin"
                                ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                                : "bg-white/10 hover:bg-white/20 text-gray-300"
                            }`}
                            title={user.role === "admin" ? "Remove Admin Role" : "Make this User an Administrator"}
                          >
                            <Shield size={11} />
                            <span>{user.role === "admin" ? "Demote" : "Make Admin"}</span>
                          </button>
                        )}

                        {/* 2. Upgrade / Downgrade Plan Button */}
                        {user.email.toLowerCase() !== ROOT_ADMIN_EMAIL.toLowerCase() && (
                          <button type="button"
                            onClick={() => handleToggleUpgrade(user)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1 ${
                              user.tier === "pro"
                                ? "bg-white/10 hover:bg-white/20 text-gray-300"
                                : "bg-purple-600 hover:bg-purple-500 text-white shadow-md"
                            }`}
                            title={user.tier === "pro" ? "Downgrade to Free" : "Upgrade to Pro (Unlimited)"}
                          >
                            <Crown size={11} />
                            <span>{user.tier === "pro" ? "Free" : "Upgrade Pro"}</span>
                          </button>
                        )}

                        {/* 3. Ban / Unban Button */}
                        {user.email.toLowerCase() !== ROOT_ADMIN_EMAIL.toLowerCase() && (
                          <button type="button"
                            onClick={() => handleToggleBan(user)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1 ${
                              user.isBanned
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                                : "bg-red-600/80 hover:bg-red-600 text-white shadow-md"
                            }`}
                            title={user.isBanned ? "Unban user" : "Ban user"}
                          >
                            {user.isBanned ? <Unlock size={11} /> : <Lock size={11} />}
                            <span>{user.isBanned ? "Unban" : "Ban"}</span>
                          </button>
                        )}

                        {/* 4. Delete User */}
                        {user.email.toLowerCase() !== ROOT_ADMIN_EMAIL.toLowerCase() && (
                          <button type="button"
                            onClick={() => handleDeleteUser(user.uid, user.email)}
                            className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors inline-flex items-center"
                            title="Delete user"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="p-6 rounded-2xl bg-[#1c1c1c] border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              <h3 className="text-base font-bold text-white">Admin Audit Log</h3>
            </div>
            <button type="button"
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              {showAuditLog ? "Hide Logs" : "Show Recent Logs"}
            </button>
          </div>
          
          {showAuditLog && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#141414] p-2 space-y-1">
              {auditLogs.length === 0 ? (
                <div className="text-center p-4 text-gray-500 text-xs">No admin actions logged yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="text-[11px] p-2 hover:bg-white/5 rounded-lg flex items-start gap-3 text-gray-400">
                    <span className="text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className="font-mono text-emerald-400 font-semibold">{log.action}</span>
                    <span className="text-gray-300">{log.performedBy}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-300">{log.targetEmail}</span>
                    {log.details && (
                      <span className="text-gray-500 italic ml-auto max-w-[200px] truncate">
                        {JSON.stringify(log.details)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

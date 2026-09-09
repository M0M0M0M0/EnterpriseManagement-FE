import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, UserRole } from "../types/domain";

function primaryRole(roles: string[]): UserRole | null {
  const upper = roles.map((role) => role.toUpperCase());
  if (upper.includes("ADMIN")) return "admin";
  if (upper.includes("MANAGER")) return "manager";
  if (upper.includes("EMPLOYEE")) return "employee";
  return null;
}

interface AuthState {
  session: AuthSession | null;
  role: UserRole | null;
  setSession: (session: AuthSession) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      role: null,
      setSession: (session) => set({ session, role: primaryRole(session.roles) }),
      logout: () => set({ session: null, role: null }),
    }),
    { name: "ems-auth" },
  ),
);

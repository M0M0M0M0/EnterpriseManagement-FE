import { useAuthStore } from "../store/useAuthStore";

// Tài khoản có mã quyền này không (giống AuthProvider.can bên mobile): ADMIN luôn có mọi quyền.
// Phiên đăng nhập cũ chưa lưu danh sách quyền thì coi như được phép (backend vẫn là nơi chặn thật).
export function useCan() {
  const session = useAuthStore((state) => state.session);
  return (permission: string) => {
    if (!session) return false;
    if (session.roles.some((r) => r.toUpperCase() === "ADMIN")) return true;
    if (!session.permissions) return true;
    return session.permissions.includes(permission);
  };
}

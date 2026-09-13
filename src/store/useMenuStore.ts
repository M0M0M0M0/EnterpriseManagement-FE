import { create } from "zustand";
import { menuApi } from "../services/api";
import type { MenuDto } from "../types/domain";

// Nguồn dữ liệu menu DÙNG CHUNG cho cả sidebar (AppShell) lẫn việc gác route
// (App.tsx) — chỉ fetch GET /api/menus/mine MỘT LẦN mỗi phiên đăng nhập, thay vì
// mỗi nơi tự fetch riêng. Menu trả về hoàn toàn do Role/Permission mà Admin cấu hình
// qua màn hình quản trị quyết định — không có route/trang nào gắn cứng theo role
// trong code, nên sau này thêm role mới (vd "SECURITY") chỉ cần Admin tick permission
// cho role đó, không cần sửa code.
interface MenuState {
  menus: MenuDto[] | null;
  status: "idle" | "loading" | "loaded" | "error";
  loadedForToken: string | null;
  load: (token: string) => void;
  reset: () => void;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  menus: null,
  status: "idle",
  loadedForToken: null,

  load: (token) => {
    const state = get();
    if (state.loadedForToken === token && (state.status === "loading" || state.status === "loaded")) {
      return;
    }

    set({ status: "loading", loadedForToken: token });
    menuApi
      .getMine()
      .then((menus) => {
        if (get().loadedForToken !== token) return; // phiên đã đổi trong lúc đang fetch
        set({ menus, status: "loaded" });
      })
      .catch(() => {
        if (get().loadedForToken !== token) return;
        set({ menus: null, status: "error" });
      });
  },

  reset: () => set({ menus: null, status: "idle", loadedForToken: null }),
}));

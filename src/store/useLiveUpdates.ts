import { create } from "zustand";
import { notificationApi } from "../services/api";
import type { NotificationDto } from "../types/domain";

// Sự kiện phát ra khi có thông báo mới (từ backend) trong lúc người dùng đang mở ứng dụng.
export interface LiveEvent {
  id: number;
  type: string;
  title: string;
  body: string;
  route?: string | null;
  refId?: number | null;
}

export const LIVE_POLL_MS = 10_000;

type Listener = (event: LiveEvent) => void;

interface LiveState {
  unread: number;
  setUnread: (updater: number | ((current: number) => number)) => void;
}

// Số thông báo chưa đọc dùng chung cho chuông.
export const useLiveState = create<LiveState>((set) => ({
  unread: 0,
  setUnread: (updater) =>
    set((state) => ({ unread: typeof updater === "function" ? updater(state.unread) : updater })),
}));

const listeners = new Set<Listener>();
const localListeners = new Set<Listener>();

// Tín hiệu cục bộ (không qua backend), vd. vừa chấm công xong.
export const LOCAL_ATTENDANCE_CHANGED = "AttendanceChanged";

export function emitLocal(type: string) {
  const event: LiveEvent = { id: 0, type, title: "", body: "" };
  localListeners.forEach((listener) => listener(event));
}

// Nghe cả thông báo từ backend lẫn tín hiệu cục bộ (dùng cho useAutoRefresh).
export function subscribeAll(listener: Listener) {
  const off = subscribeLive(listener);
  localListeners.add(listener);
  return () => {
    off();
    localListeners.delete(listener);
  };
}
let timer: number | undefined;
let running = false;
let polling = false;
let lastSeenId: number | null = null;
let lastUnreadSig = "";
let generation = 0;

const isVisible = () => document.visibilityState === "visible";

export function subscribeLive(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function syncUnread(items: NotificationDto[], gen: number) {
  // Chỉ hỏi lại số chưa đọc khi danh sách 10 tin mới nhất đổi, để bớt request.
  const sig = items.map((n) => `${n.id}:${n.isRead ? 1 : 0}`).join(",");
  if (sig === lastUnreadSig) return;
  lastUnreadSig = sig;
  try {
    const { count } = await notificationApi.getUnreadCount();
    if (gen === generation) useLiveState.getState().setUnread(count);
  } catch {
    lastUnreadSig = "";
  }
}

export async function pollNow() {
  if (!running || polling || !isVisible()) return;
  polling = true;
  const gen = generation;
  try {
    const items = await notificationApi.getList(10);
    if (gen !== generation) return;
    const maxId = items.reduce((max, n) => Math.max(max, n.id), 0);
    if (lastSeenId === null) {
      lastSeenId = maxId;
    } else {
      const fresh = items.filter((n) => n.id > (lastSeenId as number)).sort((a, b) => a.id - b.id);
      if (maxId > lastSeenId) lastSeenId = maxId;
      for (const n of fresh) {
        const event: LiveEvent = { id: n.id, type: n.type, title: n.title, body: n.body, route: n.route, refId: n.refId };
        listeners.forEach((listener) => listener(event));
      }
    }
    await syncUnread(items, gen);
  } catch {
    // Lỗi mạng/401: bỏ qua lần này (401 đã được http.ts xử lý chung).
  } finally {
    polling = false;
  }
}

const onWake = () => {
  if (isVisible()) void pollNow();
};

// Bật bộ poll duy nhất cho cả ứng dụng; trả về hàm dừng + reset.
export function startLiveUpdates() {
  if (running) return stopLiveUpdates;
  running = true;
  generation += 1;
  void pollNow();
  timer = window.setInterval(() => void pollNow(), LIVE_POLL_MS);
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  return stopLiveUpdates;
}

export function stopLiveUpdates() {
  running = false;
  generation += 1;
  polling = false;
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
  document.removeEventListener("visibilitychange", onWake);
  window.removeEventListener("focus", onWake);
  lastSeenId = null;
  lastUnreadSig = "";
  useLiveState.getState().setUnread(0);
}

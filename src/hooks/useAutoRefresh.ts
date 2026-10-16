import { useEffect, useRef } from "react";
import { subscribeAll } from "../store/useLiveUpdates";

interface AutoRefreshOptions {
  types?: string[];
  fallbackMs?: number;
}

// Tự gọi reload (tải im lặng) khi có thông báo đúng loại, định kỳ khi tab hiển thị, và khi tab hiện lại.
export function useAutoRefresh(reload: () => unknown, options: AutoRefreshOptions = {}) {
  const reloadRef = useRef(reload);
  const typesRef = useRef(options.types);
  reloadRef.current = reload;
  typesRef.current = options.types;
  const fallbackMs = options.fallbackMs ?? 60_000;

  useEffect(() => {
    let alive = true;
    let running = false;
    const run = async () => {
      if (!alive || running) return;
      running = true;
      try {
        await reloadRef.current();
      } catch {
        // Tải im lặng: bỏ qua lỗi.
      } finally {
        running = false;
      }
    };
    const visible = () => document.visibilityState === "visible";
    const unsubscribe = subscribeAll((event) => {
      const types = typesRef.current;
      if (!types || types.length === 0 || types.includes(event.type)) void run();
    });
    const timer = window.setInterval(() => {
      if (visible()) void run();
    }, fallbackMs);
    const onVisible = () => {
      if (visible()) void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fallbackMs]);
}

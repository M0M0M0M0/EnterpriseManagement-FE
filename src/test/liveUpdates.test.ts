import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { notificationApi } from "../services/api";
import { LIVE_POLL_MS, startLiveUpdates, stopLiveUpdates, subscribeLive, type LiveEvent } from "../store/useLiveUpdates";

const n = (id: number, type = "LeaveApproved") => ({
  id, type, title: `t${id}`, body: "", route: null, refId: null, isRead: false, createdAt: "2026-01-01T00:00:00Z",
});

describe("bộ poll thông báo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(notificationApi, "getUnreadCount").mockResolvedValue({ count: 0 });
  });
  afterEach(() => {
    stopLiveUpdates();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("không phát lần đầu, phát đúng thứ tự và không phát lại", async () => {
    const list = vi.spyOn(notificationApi, "getList");
    list.mockResolvedValueOnce([n(5), n(4)]);
    const events: LiveEvent[] = [];
    subscribeLive((e) => events.push(e));
    startLiveUpdates();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual([]);

    list.mockResolvedValueOnce([n(7), n(6), n(5)]);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);
    expect(events.map((e) => e.id)).toEqual([6, 7]);

    list.mockResolvedValueOnce([n(7), n(6), n(5)]);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);
    expect(events.map((e) => e.id)).toEqual([6, 7]);
  });

  it("bỏ qua lỗi mạng", async () => {
    const list = vi.spyOn(notificationApi, "getList");
    list.mockResolvedValueOnce([n(1)]).mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce([n(2), n(1)]);
    const events: LiveEvent[] = [];
    subscribeLive((e) => events.push(e));
    startLiveUpdates();
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 2);
    expect(events.map((e) => e.id)).toEqual([2]);
  });
});

describe("useAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(notificationApi, "getList").mockResolvedValue([]);
    vi.spyOn(notificationApi, "getUnreadCount").mockResolvedValue({ count: 0 });
  });
  afterEach(() => {
    stopLiveUpdates();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chỉ reload khi đúng loại", async () => {
    const list = vi.spyOn(notificationApi, "getList");
    list.mockResolvedValueOnce([]);
    const reload = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoRefresh(reload, { types: ["LeaveApproved"], fallbackMs: 10 * 60_000 }));
    startLiveUpdates();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    list.mockResolvedValueOnce([n(1, "AdjustmentApplied")]);
    await act(async () => { await vi.advanceTimersByTimeAsync(LIVE_POLL_MS); });
    expect(reload).not.toHaveBeenCalled();

    list.mockResolvedValueOnce([n(2, "LeaveApproved"), n(1, "AdjustmentApplied")]);
    await act(async () => { await vi.advanceTimersByTimeAsync(LIVE_POLL_MS); });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("không gọi chồng khi reload đang chạy", async () => {
    let release: () => void = () => {};
    const reload = vi.fn(() => new Promise<void>((r) => { release = r; }));
    renderHook(() => useAutoRefresh(reload, { fallbackMs: 1000 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(reload).toHaveBeenCalledTimes(1);
    release();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("không gọi sau khi unmount", async () => {
    const reload = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh(reload, { fallbackMs: 1000 }));
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("tín hiệu cục bộ", () => {
  it("emitLocal kích hoạt reload đúng loại, không toast qua subscribeLive", async () => {
    const { emitLocal, LOCAL_ATTENDANCE_CHANGED } = await import("../store/useLiveUpdates");
    const reload = vi.fn().mockResolvedValue(undefined);
    const other = vi.fn().mockResolvedValue(undefined);
    const live = vi.fn();
    const off = subscribeLive(live);
    renderHook(() => useAutoRefresh(reload, { types: [LOCAL_ATTENDANCE_CHANGED], fallbackMs: 10 * 60_000 }));
    renderHook(() => useAutoRefresh(other, { types: ["LeaveApproved"], fallbackMs: 10 * 60_000 }));
    await act(async () => { emitLocal(LOCAL_ATTENDANCE_CHANGED); });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(live).not.toHaveBeenCalled();
    off();
  });
});

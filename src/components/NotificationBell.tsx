import { Badge, Button, Popover, PopoverSurface, PopoverTrigger, Spinner } from "@fluentui/react-components";
import { AlertRegular, CheckmarkRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../utils/format";
import { notificationStyle, useOpenNotificationRoute } from "./notificationMeta";
import { errorMessage } from "../services/http";
import { notificationApi } from "../services/api";
import { startLiveUpdates, subscribeLive, useLiveState } from "../store/useLiveUpdates";
import { useAuthStore } from "../store/useAuthStore";
import type { NotificationDto } from "../types/domain";
import { useNotify } from "./useNotify";

// Nhắc chấm công thì không toast cho đỡ ồn.
const SILENT_TYPES = new Set(["CheckInReminder", "CheckOutReminder"]);

// Chuông thông báo trên header: hiện số chưa đọc, bấm để xem danh sách và đi tới trang liên quan.
export function NotificationBell() {
  const navigate = useNavigate();
  const openRoute = useOpenNotificationRoute();
  const [open, setOpen] = useState(false);
  const unread = useLiveState((state) => state.unread);
  const setUnread = useLiveState((state) => state.setUnread);
  const token = useAuthStore((state) => state.session?.token);
  const notify = useNotify();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshCount = useCallback(async () => {
    try {
      setUnread((await notificationApi.getUnreadCount()).count);
    } catch {
      // Lỗi tạm thời (mất mạng...) thì giữ số cũ, lần sau thử lại.
    }
  }, [setUnread]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await notificationApi.getList());
    } catch (err) {
      setError(errorMessage(err, "Không tải được thông báo."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Bộ poll duy nhất của ứng dụng: chạy khi đã đăng nhập, cập nhật số chưa đọc và phát toast.
  useEffect(() => {
    if (!token) return;
    const stop = startLiveUpdates();
    const unsubscribe = subscribeLive((event) => {
      if (!SILENT_TYPES.has(event.type)) notify({ ok: true, message: event.title });
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Khi mở danh sách thì làm tươi lại số chưa đọc.
  useEffect(() => {
    if (open) refreshCount();
  }, [open, refreshCount]);

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  const openItem = async (item: NotificationDto) => {
    setOpen(false);
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
      notificationApi.markRead(item.id).catch(() => refreshCount());
    }
    openRoute(item);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch (err) {
      setError(errorMessage(err, "Không đánh dấu được đã đọc."));
    }
  };

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)} positioning="below-end">
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          className="notification-bell"
          aria-label={unread > 0 ? `Thông báo (${unread} chưa đọc)` : "Thông báo"}
          icon={<AlertRegular />}
        >
          {unread > 0 ? (
            <Badge className="notification-badge" color="danger" size="small">
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className="notification-panel">
        <div className="notification-head">
          <strong>Thông báo</strong>
          <Button
            appearance="transparent"
            size="small"
            icon={<CheckmarkRegular />}
            disabled={unread === 0}
            onClick={markAll}
          >
            Đọc tất cả
          </Button>
        </div>
        <div className="notification-list">
          {loading && items.length === 0 ? <Spinner size="small" label="Đang tải..." /> : null}
          {error ? <p className="notification-empty">{error}</p> : null}
          {!loading && !error && items.length === 0 ? <p className="notification-empty">Chưa có thông báo nào.</p> : null}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`notification-item${item.isRead ? "" : " unread"}`}
              onClick={() => openItem(item)}
            >
              <strong>
                <span className="nf-mini-icon" style={{ color: notificationStyle(item.type).color }}>
                  {notificationStyle(item.type).icon}
                </span>
                {item.title}
              </strong>
              <span>{item.body}</span>
              <small>{formatRelativeTime(item.createdAt)}</small>
            </button>
          ))}
        </div>
        <div className="notification-foot">
          <Button
            appearance="transparent"
            size="small"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            Xem tất cả
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  );
}

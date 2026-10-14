import { Badge, Button, Popover, PopoverSurface, PopoverTrigger, Spinner } from "@fluentui/react-components";
import { AlertRegular, CheckmarkRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../services/http";
import { notificationApi } from "../services/api";
import type { NotificationDto } from "../types/domain";

const POLL_MS = 30_000;

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

// Chuông thông báo trên header: hiện số chưa đọc, bấm để xem danh sách và đi tới trang liên quan.
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshCount = useCallback(async () => {
    try {
      setUnread((await notificationApi.getUnreadCount()).count);
    } catch {
      // Lỗi tạm thời (mất mạng...) thì giữ số cũ, lần sau thử lại.
    }
  }, []);

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

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

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
    if (item.route) navigate(item.route);
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
              <strong>{item.title}</strong>
              <span>{item.body}</span>
              <small>{timeAgo(item.createdAt)}</small>
            </button>
          ))}
        </div>
      </PopoverSurface>
    </Popover>
  );
}

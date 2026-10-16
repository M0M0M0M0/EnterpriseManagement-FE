import { Button, Spinner } from "@fluentui/react-components";
import { ArrowClockwiseRegular, CheckmarkRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { notificationStyle, useOpenNotificationRoute } from "../components/notificationMeta";
import { EmptyState, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { notificationApi } from "../services/api";
import { errorMessage } from "../services/http";
import { useLiveState } from "../store/useLiveUpdates";
import type { NotificationDto } from "../types/domain";
import { formatRelativeTime } from "../utils/format";

const PAGE_SIZE = 30;

// Hộp thư thông báo: lọc Tất cả/Chưa đọc, đọc tất cả, bấm vào đi tới trang liên quan, tải thêm trang cũ hơn.
export function NotificationsPage() {
  const notify = useNotify();
  const openRoute = useOpenNotificationRoute();
  const unread = useLiveState((state) => state.unread);
  const setUnread = useLiveState((state) => state.setUnread);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  // Bỏ kết quả của request cũ trả về muộn khi vừa đổi bộ lọc.
  const seq = useRef(0);

  const refreshCount = useCallback(async () => {
    try {
      setUnread((await notificationApi.getUnreadCount()).count);
    } catch {
      // Lỗi tạm thời: giữ số cũ.
    }
  }, [setUnread]);

  // Tải lại từ đầu (trang mới nhất). silent: không bật vòng tải, giữ nguyên lỗi hiện tại.
  const load = useCallback(
    async (filterUnread: boolean, silent = false) => {
      const current = ++seq.current;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const list = await notificationApi.getPage({ unreadOnly: filterUnread, take: PAGE_SIZE });
        if (current !== seq.current) return;
        setItems(list);
        setHasMore(list.length >= PAGE_SIZE);
      } catch (err) {
        if (current !== seq.current) return;
        if (!silent) setError(errorMessage(err, "Không tải được thông báo."));
      } finally {
        if (current === seq.current && !silent) setLoading(false);
      }
      void refreshCount();
    },
    [refreshCount],
  );

  useEffect(() => {
    void load(unreadOnly);
  }, [unreadOnly, load]);

  // Có thông báo mới (hoặc định kỳ) thì tải lại im lặng.
  useAutoRefresh(() => load(unreadOnly, true));

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore || items.length === 0) return;
    const current = seq.current;
    setLoadingMore(true);
    try {
      const list = await notificationApi.getPage({
        unreadOnly,
        take: PAGE_SIZE,
        beforeId: items[items.length - 1].id,
      });
      if (current !== seq.current) return;
      setItems((prev) => [...prev, ...list]);
      setHasMore(list.length >= PAGE_SIZE);
    } catch {
      // Giữ danh sách hiện tại; bấm lại để thử tiếp.
    } finally {
      setLoadingMore(false);
    }
  };

  const openItem = (item: NotificationDto) => {
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
      notificationApi.markRead(item.id).catch(() => void refreshCount());
    }
    openRoute(item);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
      // Đang lọc chưa đọc thì danh sách phải trống sau khi đọc hết.
      if (unreadOnly) void load(true, true);
    } catch (err) {
      notify({ ok: false, message: errorMessage(err, "Không đánh dấu được đã đọc.") });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Thông báo"
        description="Các thông báo về chấm công, đơn nghỉ phép và yêu cầu của bạn."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<ArrowClockwiseRegular />} onClick={() => void load(unreadOnly)}>
              Làm mới
            </Button>
            <Button appearance="primary" icon={<CheckmarkRegular />} disabled={unread === 0} onClick={markAll}>
              Đọc tất cả
            </Button>
          </div>
        }
      />
      <SectionPanel
        title="Hộp thư"
        action={
          <div className="view-toggle">
            <Button size="small" appearance={!unreadOnly ? "primary" : "outline"} onClick={() => setUnreadOnly(false)}>
              Tất cả
            </Button>
            <Button size="small" appearance={unreadOnly ? "primary" : "outline"} onClick={() => setUnreadOnly(true)}>
              Chưa đọc{unread > 0 ? ` (${unread > 99 ? "99+" : unread})` : ""}
            </Button>
          </div>
        }
      >
        {loading && items.length === 0 ? (
          <Spinner label="Đang tải..." />
        ) : error && items.length === 0 ? (
          <EmptyState
            title="Không tải được thông báo"
            description={error}
            actionLabel="Thử lại"
            onAction={() => void load(unreadOnly)}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
            description="Thông báo mới sẽ hiển thị tại đây."
          />
        ) : (
          <div className="nf-list">
            {items.map((item) => {
              const style = notificationStyle(item.type);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nf-card${item.isRead ? "" : " is-unread"}`}
                  onClick={() => openItem(item)}
                >
                  <span className="nf-icon" style={{ color: style.color, background: `${style.color}1f` }}>
                    {style.icon}
                  </span>
                  <span className="nf-body">
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <small>{formatRelativeTime(item.createdAt)}</small>
                  </span>
                  {item.isRead ? null : <i className="nf-dot" aria-label="Chưa đọc" />}
                </button>
              );
            })}
            {hasMore ? (
              <div className="nf-more">
                <Button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Spinner size="tiny" /> : "Tải thêm"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

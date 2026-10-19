import { Badge, Button, Spinner } from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { ReasonDialog, RetryError } from "../components/ReviewParts";
import { ConfirmDialog, EmptyState, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCan } from "../hooks/useCan";
import { errorMessage } from "../services/http";
import {
  LEAVE_CANCEL_EVENTS,
  leaveCancelApi,
  leaveCancelStatusLabels,
  type LeaveCancelRequestDto,
} from "../services/leaveCancelApi";
import { formatDate } from "../utils/format";

const statusColors: Record<string, "success" | "warning" | "danger" | "subtle"> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
  Withdrawn: "subtle",
};

function dateLabel(item: LeaveCancelRequestDto) {
  const start = formatDate(item.startDate);
  const end = formatDate(item.endDate);
  return start === end ? start : `${start} - ${end}`;
}

function CancelItem({ item, actions }: { item: LeaveCancelRequestDto; actions?: React.ReactNode }) {
  return (
    <article className="review-content">
      <div>
        <strong>{item.employeeName}</strong>
        <span>Loại nghỉ: {item.leaveTypeName}</span>
        <span>
          Ngày nghỉ: {dateLabel(item)} · {String(item.totalTime).replace(".", ",")} {item.unit === "Hours" ? "giờ" : "ngày"}
        </span>
        <p>Lý do hủy: {item.reason}</p>
        {item.status === "Rejected" && item.rejectionReason ? <small>Lý do từ chối: {item.rejectionReason}</small> : null}
        <div>
          <Badge appearance="tint" shape="rounded" color={statusColors[item.status] ?? "subtle"}>
            {leaveCancelStatusLabels[item.status] ?? item.status}
          </Badge>
        </div>
      </div>
      {actions}
    </article>
  );
}

// Quản lý: duyệt yêu cầu hủy đơn nghỉ đã duyệt nhưng chưa bắt đầu (tab "Hủy phép" trong "Duyệt đơn từ"). Duyệt thì hoàn phép.
export function LeaveCancelApprovalPanel() {
  const notify = useNotify();
  const canApprove = useCan()("leave.request.approve");
  const [pending, setPending] = useState<LeaveCancelRequestDto[]>([]);
  const [history, setHistory] = useState<LeaveCancelRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<LeaveCancelRequestDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveCancelRequestDto | null>(null);

  const fetchAll = useCallback(
    () =>
      Promise.all([leaveCancelApi.getPending(), leaveCancelApi.getHistory()]).then(([p, h]) => {
        setPending(p);
        setHistory(h);
      }),
    [],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchAll()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(load, [load]);
  useAutoRefresh(() => fetchAll().catch(() => undefined), { types: LEAVE_CANCEL_EVENTS });

  const approve = async () => {
    if (!approveTarget) return;
    setBusyId(approveTarget.id);
    try {
      await leaveCancelApi.approve(approveTarget.id);
      notify({ ok: true, message: "Đã hủy đơn nghỉ phép, phép được hoàn lại." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
      setApproveTarget(null);
      load();
    }
  };

  const reject = async (reason: string) => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await leaveCancelApi.reject(rejectTarget.id, reason || undefined);
      notify({ ok: true, message: "Đã từ chối yêu cầu hủy." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
      setRejectTarget(null);
      load();
    }
  };

  if (loading && !pending.length && !history.length) return <Spinner label="Đang tải..." />;
  if (error && !pending.length && !history.length) return <RetryError message={error} onRetry={load} />;

  return (
    <>
      <SectionPanel title={`Chờ duyệt (${pending.length})`}>
        {pending.length ? (
          <div className="review-list">
            {pending.map((item) => (
              <CancelItem
                key={item.id}
                item={item}
                actions={
                  canApprove ? (
                    <div className="review-actions">
                      <Button appearance="primary" disabled={busyId === item.id} onClick={() => setApproveTarget(item)}>
                        Duyệt hủy
                      </Button>
                      <Button disabled={busyId === item.id} onClick={() => setRejectTarget(item)}>
                        Từ chối
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState title="Không có yêu cầu chờ duyệt" description="Danh sách sẽ cập nhật khi nhân viên xin hủy đơn nghỉ." />
        )}
      </SectionPanel>
      <SectionPanel title="Đã xử lý">
        {history.length ? (
          <div className="review-list">
            {history.map((item) => (
              <CancelItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có lịch sử" description="Chưa có yêu cầu hủy nào được xử lý." />
        )}
      </SectionPanel>
      <ConfirmDialog
        open={!!approveTarget}
        title="Duyệt hủy đơn nghỉ"
        description={
          approveTarget
            ? `Hủy đơn ${approveTarget.leaveTypeName} của ${approveTarget.employeeName} (${dateLabel(approveTarget)})? Phép đã trừ sẽ được hoàn lại.`
            : ""
        }
        confirmLabel="Duyệt hủy"
        confirming={busyId !== null}
        onConfirm={approve}
        onCancel={() => setApproveTarget(null)}
      />
      <ReasonDialog
        open={!!rejectTarget}
        title={rejectTarget ? `Từ chối hủy đơn của ${rejectTarget.employeeName}` : "Từ chối yêu cầu hủy"}
        busy={busyId !== null}
        onSubmit={reject}
        onCancel={() => setRejectTarget(null)}
      />
    </>
  );
}

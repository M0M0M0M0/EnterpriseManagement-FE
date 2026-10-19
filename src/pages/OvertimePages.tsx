import { Button, Field, Input, ProgressBar, Spinner, Textarea } from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { FilterSelect, ReasonDialog, RetryError } from "../components/ReviewParts";
import { ConfirmDialog, EmptyState, PageHeader, RequestBadge, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCan } from "../hooks/useCan";
import { errorMessage } from "../services/http";
import { overtimeApi } from "../services/overtimeApi";
import type { OvertimeQuotaDto, OvertimeRequestDto } from "../types/overtime";
import { formatDate, isoDate } from "../utils/format";
import { OVERTIME_EVENTS, overtimeDurationLabel } from "../utils/overtime";

const statusFilters = [
  { value: "", label: "Tất cả" },
  { value: "Approved", label: "Đã duyệt" },
  { value: "Rejected", label: "Từ chối" },
  { value: "Cancelled", label: "Đã huỷ" },
];

function OvertimeItem({
  item,
  showEmployee,
  actions,
}: {
  item: OvertimeRequestDto;
  showEmployee?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <article className="review-content">
      <div>
        <strong>{showEmployee ? item.employeeName : `Ngày ${formatDate(item.date)}`}</strong>
        {showEmployee ? <span>Ngày: {formatDate(item.date)}</span> : null}
        <span>
          Thời gian: {item.startTime} - {item.endTime} · {overtimeDurationLabel(item.minutes)}
        </span>
        <p>Lý do: {item.reason}</p>
        {item.status === "Approved" && item.approverName ? <small>Người duyệt: {item.approverName}</small> : null}
        {item.status === "Rejected" && item.rejectionReason ? <small>Lý do từ chối: {item.rejectionReason}</small> : null}
        <div>
          <RequestBadge status={item.status} />
        </div>
      </div>
      {actions}
    </article>
  );
}

function QuotaPanel({ quota }: { quota: OvertimeQuotaDto }) {
  const bar = (label: string, used: number, limit: number) => (
    <div className="quota-row">
      <span>
        {label}: {overtimeDurationLabel(used)} / {limit / 60} giờ
      </span>
      <ProgressBar value={Math.min(used / limit, 1)} color={used / limit >= 0.9 ? "error" : "brand"} />
    </div>
  );
  return (
    <SectionPanel title="Hạn mức làm thêm giờ theo luật">
      <p className="field-hint">Tính cả đơn đang chờ duyệt.</p>
      {bar(`Tháng ${quota.month}`, quota.monthUsedMinutes, quota.monthLimitMinutes)}
      {bar(`Năm ${quota.year}`, quota.yearUsedMinutes, quota.yearLimitMinutes)}
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// Nhân viên: xin làm thêm giờ (route /employee/overtime)
// ---------------------------------------------------------------------------

export function EmployeeOvertimePage() {
  const notify = useNotify();
  const todayIso = isoDate();
  const [items, setItems] = useState<OvertimeRequestDto[]>([]);
  const [quota, setQuota] = useState<OvertimeQuotaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ date: todayIso, startTime: "17:30", endTime: "19:30", reason: "" });
  const [sending, setSending] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OvertimeRequestDto | null>(null);

  const fetchAll = useCallback(
    () =>
      Promise.all([overtimeApi.getMine(), overtimeApi.getQuota()]).then(([mine, q]) => {
        setItems([...mine].sort((a, b) => b.id - a.id));
        setQuota(q);
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
  useAutoRefresh(() => fetchAll().catch(() => undefined), { types: OVERTIME_EVENTS });

  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return isoDate(d);
  })();

  const send = async () => {
    setSending(true);
    try {
      await overtimeApi.submit({ date: form.date, startTime: form.startTime, endTime: form.endTime, reason: form.reason.trim() });
      notify({ ok: true, message: "Đã gửi đơn làm thêm giờ, chờ quản lý duyệt." });
      setForm((v) => ({ ...v, reason: "" }));
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!cancelTarget) return;
    try {
      await overtimeApi.cancel(cancelTarget.id);
      notify({ ok: true, message: "Đã huỷ đơn." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setCancelTarget(null);
      load();
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Làm thêm giờ"
        description="Xin làm thêm giờ (OT). Đơn được quản lý duyệt như đơn nghỉ; đơn đã duyệt được cộng vào công của chính ngày đó."
      />
      {loading && !items.length && !quota ? (
        <Spinner label="Đang tải..." />
      ) : error && !items.length && !quota ? (
        <RetryError message={error} onRetry={load} />
      ) : (
        <>
          {quota ? <QuotaPanel quota={quota} /> : null}
          <SectionPanel title="Xin làm thêm giờ">
            <div className="form-stack">
              <p className="field-hint">
                Ngày làm việc: từ 17:00 đến 22:00, tối đa 4 giờ. Cuối tuần và ngày lễ: từ 06:00 đến 22:00, tối đa 12 giờ.
                Mỗi đơn từ 30 phút, theo bước 30 phút.
              </p>
              <Field label="Ngày làm thêm" required>
                <Input
                  type="date"
                  min={todayIso}
                  max={maxDate}
                  value={form.date}
                  onChange={(_, data) => setForm((v) => ({ ...v, date: data.value }))}
                />
              </Field>
              <div className="form-grid">
                <Field label="Giờ bắt đầu" required>
                  <Input
                    type="time"
                    step={1800}
                    value={form.startTime}
                    onChange={(_, data) => setForm((v) => ({ ...v, startTime: data.value }))}
                  />
                </Field>
                <Field label="Giờ kết thúc" required>
                  <Input
                    type="time"
                    step={1800}
                    value={form.endTime}
                    onChange={(_, data) => setForm((v) => ({ ...v, endTime: data.value }))}
                  />
                </Field>
              </div>
              <Field label="Lý do" required>
                <Textarea
                  resize="vertical"
                  maxLength={500}
                  value={form.reason}
                  onChange={(_, data) => setForm((v) => ({ ...v, reason: data.value }))}
                />
              </Field>
              <div>
                <Button appearance="primary" onClick={send} disabled={sending || !form.date || !form.startTime || !form.endTime}>
                  {sending ? <Spinner size="tiny" /> : "Gửi đơn"}
                </Button>
              </div>
            </div>
          </SectionPanel>
          <SectionPanel title="Đơn của tôi">
            {items.length ? (
              <div className="review-list">
                {items.map((item) => (
                  <OvertimeItem
                    key={item.id}
                    item={item}
                    actions={
                      item.status === "Pending" ? (
                        <div className="review-actions">
                          <Button onClick={() => setCancelTarget(item)}>Huỷ đơn</Button>
                        </div>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có đơn" description="Bạn chưa có đơn làm thêm giờ nào." />
            )}
          </SectionPanel>
        </>
      )}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Huỷ đơn làm thêm giờ"
        description={cancelTarget ? `Huỷ đơn ngày ${formatDate(cancelTarget.date)} (${cancelTarget.startTime} - ${cancelTarget.endTime})?` : ""}
        confirmLabel="Huỷ đơn"
        onConfirm={cancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quản lý: duyệt đơn làm thêm giờ của team (tab trong "Duyệt đơn từ")
// ---------------------------------------------------------------------------

export function OvertimeApprovalPanel({ onPendingCount }: { onPendingCount?: (count: number) => void }) {
  const notify = useNotify();
  const canApprove = useCan()("overtime.request.approve");
  const [pending, setPending] = useState<OvertimeRequestDto[]>([]);
  const [history, setHistory] = useState<OvertimeRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [approveTarget, setApproveTarget] = useState<OvertimeRequestDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OvertimeRequestDto | null>(null);

  const fetchAll = useCallback(
    () =>
      Promise.all([overtimeApi.getPending(), overtimeApi.getHistory()]).then(([p, h]) => {
        const sortedPending = [...p].sort((a, b) => b.id - a.id);
        setPending(sortedPending);
        setHistory([...h].filter((r) => r.status !== "Pending").sort((a, b) => b.id - a.id));
        onPendingCount?.(sortedPending.length);
      }),
    [onPendingCount],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchAll()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(load, [load]);
  useAutoRefresh(() => fetchAll().catch(() => undefined), { types: OVERTIME_EVENTS });

  const approve = async () => {
    if (!approveTarget) return;
    setBusyId(approveTarget.id);
    try {
      await overtimeApi.approve(approveTarget.id);
      notify({ ok: true, message: "Đã duyệt đơn làm thêm giờ." });
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
      await overtimeApi.reject(rejectTarget.id, reason || undefined);
      notify({ ok: true, message: "Đã từ chối đơn làm thêm giờ." });
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

  const filteredHistory = history.filter((r) => !status || r.status === status);

  return (
    <>
      <SectionPanel title={`Chờ duyệt (${pending.length})`}>
        {pending.length ? (
          <div className="review-list">
            {pending.map((item) => (
              <OvertimeItem
                key={item.id}
                item={item}
                showEmployee
                actions={
                  canApprove ? (
                    <div className="review-actions">
                      <Button appearance="primary" disabled={busyId === item.id} onClick={() => setApproveTarget(item)}>
                        Duyệt
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
          <EmptyState title="Không có đơn chờ duyệt" description="Danh sách sẽ cập nhật khi có đơn làm thêm giờ mới." />
        )}
      </SectionPanel>
      <SectionPanel title="Đã xử lý">
        <div className="filter-grid">
          <FilterSelect label="Trạng thái" value={status} options={statusFilters} onChange={setStatus} />
        </div>
        {filteredHistory.length ? (
          <div className="review-list">
            {filteredHistory.map((item) => (
              <OvertimeItem key={item.id} item={item} showEmployee />
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có lịch sử" description="Chưa có đơn làm thêm giờ nào được xử lý." />
        )}
      </SectionPanel>
      <ConfirmDialog
        open={!!approveTarget}
        title="Duyệt làm thêm giờ"
        description={
          approveTarget
            ? `Duyệt đơn của ${approveTarget.employeeName}: ${formatDate(approveTarget.date)}, ${approveTarget.startTime} - ${approveTarget.endTime} (${overtimeDurationLabel(approveTarget.minutes)})?`
            : ""
        }
        confirmLabel="Duyệt"
        confirming={busyId !== null}
        onConfirm={approve}
        onCancel={() => setApproveTarget(null)}
      />
      <ReasonDialog
        open={!!rejectTarget}
        title={rejectTarget ? `Từ chối đơn của ${rejectTarget.employeeName}` : "Từ chối đơn"}
        busy={busyId !== null}
        onSubmit={reject}
        onCancel={() => setRejectTarget(null)}
      />
    </>
  );
}

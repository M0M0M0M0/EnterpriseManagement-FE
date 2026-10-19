import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Spinner,
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  CalendarRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
} from "@fluentui/react-icons";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCan } from "../hooks/useCan";
import {
  AdjustmentBadge,
  ConfirmDialog,
  AttendanceStatusCell,
  EmptyState,
  FieldError,
  MetricRail,
  PageHeader,
  RequestBadge,
  ReturnSessionBadge,
  ReturnStatusBadge,
  SectionPanel,
} from "../components/ui";
import { AttendanceMonthCalendar } from "../components/AttendanceMonthCalendar";
import { PunchHero } from "../components/PunchHero";
import { useNotify } from "../components/useNotify";
import {
  attendanceApi,
  dashboardApi,
  leaveBalanceApi,
  leaveRequestApi,
  leaveTypeApi,
} from "../services/api";
import { leaveReturnApi } from "../services/hrApi";
import { LEAVE_CANCEL_EVENTS, leaveCancelApi, type LeaveCancelRequestDto } from "../services/leaveCancelApi";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
import type {
  DaySession,
  LeaveReturnPreviewDto,
  LeaveReturnRequestDto,
} from "../types/attendanceHr";
import type {
  AttendanceAdjustmentDto,
  AttendanceRecordDto,
  EmployeeDashboardDto,
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveSession,
  LeaveTypeDto,
} from "../types/domain";
import {
  attendanceLabels,
  formatDate,
  formatDateTime,
  formatLeaveTime,
  formatNumber,
  formatTime,
  isoDate,
  leaveSessionLabels,
  sessionNames,
  shortLeaveSlotLabel,
  shortLeaveSlots,
} from "../utils/format";
import { PagedItems } from "../components/PagedItems";

// Chuỗi ngày yyyy-MM-dd có rơi vào thứ Bảy/Chủ nhật không (tính theo giờ địa phương, tránh lệch múi giờ).
function isWeekendDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

function useEmployeeCode() {
  return useAuthStore((state) => state.session?.employeeCode);
}

// Lời chào theo giờ trong ngày (như Trang chủ mobile).
function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 13) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

// Tên người Việt: lấy từ cuối (tên gọi) cho lời chào ngắn gọn.
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

// Hộp "Chi tiết tình trạng nghỉ phép": số dư từng loại kèm phân loại có lương/không lương.
// Mở từ thẻ "Ngày phép còn lại" ở trang Xin nghỉ phép; chỉ tải dữ liệu khi mở.
function LeaveStatusDialog({ employeeCode, open, onClose }: { employeeCode: string; open: boolean; onClose: () => void }) {
  const [balances, setBalances] = useState<LeaveBalanceDto[]>([]);
  const [paidByCode, setPaidByCode] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      leaveBalanceApi.getByEmployee(employeeCode, new Date().getFullYear()),
      leaveTypeApi.getAll().catch(() => [] as LeaveTypeDto[]),
    ])
      .then(([b, t]) => {
        setBalances(b);
        setPaidByCode(Object.fromEntries(t.map((type) => [type.leaveTypeCode, type.isPaid])));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open, employeeCode]);

  const value = (b: LeaveBalanceDto) => formatLeaveTime(b.remainingTime, b.unit);
  const category = (b: LeaveBalanceDto) => ((paidByCode[b.leaveTypeCode] ?? true) ? "Nghỉ có lương" : "Nghỉ không lương");

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Chi tiết tình trạng nghỉ phép</DialogTitle>
          <DialogContent>
            {loading ? (
              <Spinner size="small" label="Đang tải..." />
            ) : balances.length ? (
              <div className="compact-list">
                {balances.map((b) => (
                  <div className="compact-row" key={`${b.leaveTypeCode}-${b.month ?? "y"}`}>
                    <div>
                      <strong>{b.leaveTypeName}</strong>
                      <span>{category(b)}</span>
                    </div>
                    <strong>{value(b)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p>Chưa có thông tin số dư nghỉ phép.</p>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose}>
              Đóng
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function EmployeeDashboardPage() {
  const employeeCode = useEmployeeCode();
  const notify = useNotify();
  const [data, setData] = useState<EmployeeDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Chỉ hiện Spinner toàn trang ở lần tải đầu tiên. Các lần load lại sau (vd. sau khi
  // chấm công) không được set loading=true nữa, để tránh unmount cả trang chỉ để refresh
  // dữ liệu — nút chấm công (PunchHero) tự có Spinner riêng cho việc đó.
  const load = () => {
    if (!employeeCode) return;
    dashboardApi
      .employee(employeeCode)
      .then(setData)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải lại im lặng khi có thông báo liên quan (không Spinner, không toast lỗi).
  useAutoRefresh(
    () => (employeeCode ? dashboardApi.employee(employeeCode).then(setData).catch(() => undefined) : undefined),
    { types: ["AttendanceChanged", "LeaveApproved", "LeaveRejected", "LeaveSubmitted", "ReturnApproved", "ReturnRejected", "AdjustmentApplied", "AdjustmentManagerApproved", "AdjustmentRejected", "AttendanceNoteCreated"] },
  );

  if (!employeeCode)
    return (
      <EmptyState
        title="Tài khoản chưa gắn hồ sơ nhân viên"
        description="Liên hệ quản trị viên để được liên kết hồ sơ nhân viên."
      />
    );
  if (loading || !data) return <Spinner label="Đang tải dashboard..." />;

  return (
    <div className="page-stack">
      <PageHeader
        title={`${greeting()}, ${shortName(data.employeeName)}`}
        description="Chúc bạn một ngày hiệu quả. Tổng quan chấm công, phép và các yêu cầu đang chờ duyệt."
      />

      <PunchHero employeeCode={employeeCode} onPunched={load} />

      <MetricRail
        items={[
          {
            label: "Phép còn lại",
            value: `${data.totalRemainingLeaveDays} ngày`,
            tone: "brand",
          },
          {
            label: "Đơn nghỉ chờ duyệt",
            value: data.pendingLeaveRequestsCount,
            tone: data.pendingLeaveRequestsCount ? "warning" : "success",
          },
          {
            label: "Điều chỉnh chấm công chờ duyệt",
            value: data.pendingAttendanceAdjustmentsCount,
            tone: data.pendingAttendanceAdjustmentsCount ? "warning" : "success",
          },
        ]}
      />

    </div>
  );
}

export function EmployeeAttendancePage() {
  const notify = useNotify();
  const [history, setHistory] = useState<AttendanceRecordDto[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    attendanceDate: formatDate(new Date().toISOString(), "yyyy-MM-dd"),
    reason: "",
    newCheckInTime: "08:00",
    newCheckOutTime: "17:30",
  });
  const [historyView, setHistoryView] = useState<"list" | "calendar">("calendar");
  const employeeCode = useEmployeeCode();
  const can = useCan();
  // Yêu cầu điều chỉnh chỉ tải/gửi được khi có quyền (endpoint cần attendance.adjustment.self).
  const canAdjust = can("attendance.adjustment.self");

  // Chỉ hiện Spinner toàn trang ở lần tải đầu tiên (xem EmployeeDashboardPage.load ở trên).
  const load = () => {
    if (!employeeCode) return;
    Promise.all([
      attendanceApi.getHistory(employeeCode),
      canAdjust ? attendanceApi.getMyAdjustments() : Promise.resolve([] as AttendanceAdjustmentDto[]),
    ])
      .then(([h, a]) => {
        setHistory(h);
        setAdjustments(a);
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải lại im lặng; dialog/form đang nhập không bị ảnh hưởng. Lịch & PunchHero tự làm mới qua hook riêng.
  useAutoRefresh(
    () =>
      employeeCode
        ? Promise.all([
            attendanceApi.getHistory(employeeCode),
            canAdjust ? attendanceApi.getMyAdjustments() : Promise.resolve([] as AttendanceAdjustmentDto[]),
          ])
            .then(([h, a]) => {
              setHistory(h);
              setAdjustments(a);
            })
            .catch(() => undefined)
        : undefined,
    { types: ["AttendanceChanged", "AdjustmentApplied", "AdjustmentManagerApproved", "AdjustmentRejected", "AttendanceNoteCreated", "LeaveApproved", "ReturnApproved"] },
  );

  // Mở form yêu cầu, đặt sẵn ngày cần chỉnh sửa.
  const openDialog = (date: Date) => {
    setForm((v) => ({ ...v, attendanceDate: isoDate(date) }));
    setDialogOpen(true);
  };

  // Xuất lịch sử chấm công ra CSV (có BOM để Excel đọc đúng tiếng Việt), mới nhất lên đầu.
  const exportCsv = () => {
    if (!history.length) {
      notify({ ok: false, message: "Không có dữ liệu để xuất." });
      return;
    }
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const stamp = (value?: string) => (value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "--");
    const rows = [...history].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
    const lines = ["Ngày,Giờ vào,Giờ ra,Số giờ làm,Trạng thái"];
    for (const r of rows) {
      lines.push(
        [
          formatDate(r.attendanceDate),
          stamp(r.checkInTime),
          stamp(r.checkOutTime),
          r.workingHours != null ? r.workingHours.toFixed(2) : "",
          attendanceLabels[r.status] ?? r.status,
        ]
          .map(cell)
          .join(","),
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cham_cong_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const todayIso = isoDate();
  const earliestAdjustDate = isoDate(new Date(Date.now() - 366 * 24 * 3600 * 1000));

  const send = async () => {
    if (!form.reason.trim()) {
      notify({ ok: false, message: "Vui lòng nhập lý do điều chỉnh." });
      return;
    }
    if (!form.newCheckInTime && !form.newCheckOutTime) {
      notify({ ok: false, message: "Hãy đề xuất ít nhất một giờ vào hoặc giờ ra." });
      return;
    }
    if (!form.attendanceDate || form.attendanceDate > todayIso || form.attendanceDate < earliestAdjustDate) {
      notify({ ok: false, message: "Ngày cần chỉnh sửa phải trong vòng 366 ngày gần đây và không ở tương lai." });
      return;
    }
    setSending(true);
    try {
      await attendanceApi.submitAdjustment({
        attendanceDate: form.attendanceDate,
        reason: form.reason.trim(),
        newCheckInTime: form.newCheckInTime
          ? `${form.attendanceDate}T${form.newCheckInTime}:00`
          : undefined,
        newCheckOutTime: form.newCheckOutTime
          ? `${form.attendanceDate}T${form.newCheckOutTime}:00`
          : undefined,
      });
      notify({ ok: true, message: "Đã gửi yêu cầu điều chỉnh chấm công." });
      setDialogOpen(false);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Điều chỉnh chấm công"
        description="Xem lịch chấm công của bạn và gửi yêu cầu khi một ngày bị ghi sai."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<ArrowDownloadRegular />} onClick={exportCsv} title="Xuất CSV lịch sử chấm công">
              Xuất CSV
            </Button>
            {canAdjust ? (
              <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={() => openDialog(new Date())}>
                Yêu cầu chỉnh sửa
              </Button>
            ) : null}
          </div>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <>
          <div className="two-column-grid attendance-columns">
          <SectionPanel
            title="Lịch sử chấm công"
            action={
              <div className="view-toggle">
                <Button
                  size="small"
                  appearance={historyView === "list" ? "primary" : "outline"}
                  onClick={() => setHistoryView("list")}
                >
                  Danh sách
                </Button>
                <Button
                  size="small"
                  appearance={historyView === "calendar" ? "primary" : "outline"}
                  onClick={() => setHistoryView("calendar")}
                >
                  Lịch
                </Button>
              </div>
            }
          >
            {historyView === "calendar" ? (
              employeeCode ? <AttendanceMonthCalendar employeeCode={employeeCode} onRequestAdjustment={canAdjust ? openDialog : undefined} /> : null
            ) : history.length ? (
              <PagedItems items={history} resetKey={history.length}>
{(shown) => (
<div className="attendance-list">
                {shown.map((record) => (
                  <article className="attendance-list-item" key={record.attendanceDate}>
                    <div className="date-block">
                      <strong>{formatDate(record.attendanceDate, "dd")}</strong>
                      <span>{formatDate(record.attendanceDate, "EEE")}</span>
                    </div>
                    <div className="attendance-times">
                      <div>
                        <span>Vào</span>
                        <strong>{formatDateTime(record.checkInTime)}</strong>
                      </div>
                      <div>
                        <span>Ra</span>
                        <strong>{formatDateTime(record.checkOutTime)}</strong>
                      </div>
                    </div>
                    <div className="attendance-state">
                      <AttendanceStatusCell record={record} />
                    </div>
                  </article>
                ))}
              </div>
)}
</PagedItems>
            ) : (
              <EmptyState title="Không có dữ liệu" description="Chưa có bản ghi chấm công." />
            )}
          </SectionPanel>
          <SectionPanel title="Yêu cầu chỉnh sửa chấm công">
            {adjustments.length ? (
              <div className="compact-list">
                {adjustments.map((item) => (
                  <div className="compact-row" key={item.id}>
                    <div>
                      <strong>{formatDate(item.attendanceDate)}</strong>
                      {item.newCheckInTime ? (
                        <span>
                          Giờ vào: {formatTime(item.oldCheckInTime)} → {formatTime(item.newCheckInTime)}
                        </span>
                      ) : null}
                      {item.newCheckOutTime ? (
                        <span>
                          Giờ ra: {formatTime(item.oldCheckOutTime)} → {formatTime(item.newCheckOutTime)}
                        </span>
                      ) : null}
                      <span>Lý do: {item.reason}</span>
                      {item.status === "Rejected" && item.rejectionReason ? (
                        <small>Lý do từ chối: {item.rejectionReason}</small>
                      ) : null}
                      {item.approverName ? (
                        <small>
                          Quản lý xác nhận: {item.approverName}
                          {item.approvedAt ? ` · ${formatDateTime(item.approvedAt)}` : ""}
                        </small>
                      ) : null}
                      {item.processedByName ? (
                        <small>
                          HR xử lý: {item.processedByName}
                          {item.processedAt ? ` · ${formatDateTime(item.processedAt)}` : ""}
                        </small>
                      ) : null}
                    </div>
                    <AdjustmentBadge status={item.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có yêu cầu" description="Chưa có yêu cầu chỉnh sửa chấm công." />
            )}
          </SectionPanel>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Yêu cầu chỉnh sửa chấm công</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Ngày cần chỉnh sửa" required>
                <Input
                  type="date"
                  min={earliestAdjustDate}
                  max={todayIso}
                  value={form.attendanceDate}
                  onChange={(_, data) => setForm((v) => ({ ...v, attendanceDate: data.value }))}
                />
              </Field>
              <div className="form-grid">
                <Field label="Giờ vào đề xuất (bỏ trống nếu quên check-out)">
                  <Input
                    type="time"
                    value={form.newCheckInTime}
                    onChange={(_, data) => setForm((v) => ({ ...v, newCheckInTime: data.value }))}
                  />
                </Field>
                <Field label="Giờ ra đề xuất (bỏ trống nếu quên check-in)">
                  <Input
                    type="time"
                    value={form.newCheckOutTime}
                    onChange={(_, data) => setForm((v) => ({ ...v, newCheckOutTime: data.value }))}
                  />
                </Field>
              </div>
              <p className="field-hint">
                Bỏ trống giờ vào nếu quên chấm công ra, bỏ trống giờ ra nếu quên chấm công vào.
              </p>
              <Field label="Lý do" required>
                <Textarea
                  resize="vertical"
                  value={form.reason}
                  onChange={(_, data) => setForm((v) => ({ ...v, reason: data.value }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={send} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Gửi yêu cầu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Nhãn khoảng ngày của đơn: một ngày thì dd/MM/yyyy, nhiều ngày thì "từ - đến".
function leaveDateLabel(item: LeaveRequestDto) {
  const start = formatDate(item.startDate);
  const end = formatDate(item.endDate);
  return start === end ? start : `${start} - ${end}`;
}

// Nhãn buổi/khung giờ: đơn chọn buổi thì tên buổi, nghỉ ngắn thì giờ bắt đầu - kết thúc.
function leaveTimeLabel(item: LeaveRequestDto) {
  if (item.session) return leaveSessionLabels[item.session];
  return `${formatTime(item.startDate)} - ${formatTime(item.endDate)}`;
}

// Ngày làm việc kế tiếp (nếu rơi vào thứ Bảy/Chủ nhật thì nhảy sang thứ Hai).
function nextWorkday(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

const leaveStatusFilters: { value: string | null; label: string }[] = [
  { value: null, label: "Tất cả" },
  { value: "Pending", label: "Chờ duyệt" },
  { value: "Approved", label: "Đã duyệt" },
  { value: "Rejected", label: "Từ chối" },
  { value: "Cancelled", label: "Đã hủy" },
];

type LeaveTab = "requests" | "balances" | "calendar";

// Lịch tháng các ngày nghỉ: chỉ đánh dấu đơn Chờ duyệt / Đã duyệt (đơn bị từ chối, đã hủy không chiếm ngày).
function LeaveCalendar({ requests, onOpen }: { requests: LeaveRequestDto[]; onOpen: (item: LeaveRequestDto) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const eventsFor = (day: Date) => {
    const key = isoDate(day);
    return requests.filter(
      (r) =>
        (r.status === "Pending" || r.status === "Approved") &&
        key >= r.startDate.slice(0, 10) &&
        key <= r.endDate.slice(0, 10),
    );
  };

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leading = (startOfMonth(month).getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array<null>(leading).fill(null), ...days];
  const todayKey = isoDate();
  const selectedEvents = eventsFor(selected);

  return (
    <div className="leave-calendar">
      <div className="leave-calendar-head">
        <Button appearance="subtle" icon={<ChevronLeftRegular />} aria-label="Tháng trước" onClick={() => setMonth(subMonths(month, 1))} />
        <strong>{format(month, "'Tháng' M, yyyy", { locale: vi })}</strong>
        <Button appearance="subtle" icon={<ChevronRightRegular />} aria-label="Tháng sau" onClick={() => setMonth(addMonths(month, 1))} />
      </div>
      <div className="leave-calendar-grid">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => (
          <div key={w} className="weekday">
            {w}
          </div>
        ))}
        {cells.map((day, index) =>
          day ? (
            <button
              type="button"
              key={isoDate(day)}
              className={`leave-day${isoDate(day) === todayKey ? " is-today" : ""}${isoDate(day) === isoDate(selected) ? " is-selected" : ""}`}
              onClick={() => setSelected(day)}
            >
              <span>{day.getDate()}</span>
              {eventsFor(day).length ? <i /> : null}
            </button>
          ) : (
            <div key={`blank-${index}`} />
          ),
        )}
      </div>
      <h3 className="leave-calendar-title">Ngày {format(selected, "dd/MM/yyyy")}</h3>
      {selectedEvents.length ? (
        <div className="compact-list">
          {selectedEvents.map((r) => (
            <button type="button" className="compact-row leave-row-button" key={r.id} onClick={() => onOpen(r)}>
              <div>
                <strong>{r.leaveTypeName}</strong>
                <span>
                  {leaveDateLabel(r)} · {leaveTimeLabel(r)}
                </span>
              </div>
              <RequestBadge status={r.status} />
            </button>
          ))}
        </div>
      ) : (
        <p className="field-hint">Không có đơn nghỉ trong ngày này.</p>
      )}
    </div>
  );
}

export function EmployeeLeavePage() {
  const notify = useNotify();
  const can = useCan();
  // Tạo/huỷ đơn và đi làm lại chỉ hiện với tài khoản có quyền leave.request.self (như PermissionGate bên mobile).
  const canSelf = can("leave.request.self");
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceDto[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returns, setReturns] = useState<LeaveReturnRequestDto[]>([]);
  // Yêu cầu hủy đơn nghỉ đã duyệt (chưa bắt đầu) của tôi
  const [cancels, setCancels] = useState<LeaveCancelRequestDto[]>([]);
  const [cancelReqTarget, setCancelReqTarget] = useState<LeaveRequestDto | null>(null);
  const [cancelReqReason, setCancelReqReason] = useState("");
  const [cancelReqSending, setCancelReqSending] = useState(false);
  const [tab, setTab] = useState<LeaveTab>("requests");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeaveRequestDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequestDto | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const employeeCode = useEmployeeCode();
  const [statusOpen, setStatusOpen] = useState(false);

  // Nghỉ có phép phải xin trước ít nhất 1 ngày làm việc để quản lý kịp duyệt và sắp xếp
  // công việc: xin trước/đúng 17h thì sớm nhất là ngày mai, xin sau 17h thì sớm nhất là
  // ngày kia (rơi vào cuối tuần thì sang thứ Hai). Khớp với ResolveRequestedTime ở backend
  // (LeaveRequestService.cs) và màn tạo đơn bên mobile.
  const minAnnualDate = (() => {
    const now = new Date();
    const daysAhead = now.getHours() * 60 + now.getMinutes() <= 17 * 60 ? 1 : 2;
    return isoDate(nextWorkday(new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead)));
  })();
  // Đơn thường cho chọn lùi tối đa 365 ngày (như bộ chọn ngày bên mobile).
  const minLeaveDate = isoDate(new Date(Date.now() - 365 * 24 * 3600 * 1000));

  const [form, setForm] = useState({
    leaveTypeCode: "",
    startDate: isoDate(nextWorkday(new Date())),
    endDate: isoDate(nextWorkday(new Date())),
    session: "FullDay" as LeaveSession,
    shortSlot: shortLeaveSlots[0],
    reason: "",
  });

  const activeTypes = leaveTypes.filter((t) => t.isActive);

  const load = () => {
    if (!employeeCode) return;
    setLoading(true);
    Promise.all([
      leaveRequestApi.getMine(),
      leaveBalanceApi.getByEmployee(employeeCode, new Date().getFullYear()),
      leaveTypeApi.getAll(),
      // Danh sách đi làm lại lỗi (vd. thiếu quyền) thì bỏ qua, không làm hỏng cả trang
      leaveReturnApi.getMine().catch(() => [] as LeaveReturnRequestDto[]),
      leaveCancelApi.getMine().catch(() => [] as LeaveCancelRequestDto[]),
    ])
      .then(([r, b, t, rt, cx]) => {
        setCancels(cx);
        // Đơn tạo sau (id lớn hơn) lên đầu.
        setRequests([...r].sort((a, c) => c.id - a.id));
        setBalances(b);
        setLeaveTypes(t);
        setReturns(rt);
        const active = t.filter((type) => type.isActive);
        if (active.length) {
          setForm((v) => {
            const nextCode = active.some((type) => type.leaveTypeCode === v.leaveTypeCode) ? v.leaveTypeCode : active[0].leaveTypeCode;
            if (nextCode === "ANNUAL" && v.startDate < minAnnualDate) {
              return { ...v, leaveTypeCode: nextCode, startDate: minAnnualDate, endDate: minAnnualDate };
            }
            return { ...v, leaveTypeCode: nextCode };
          });
        }
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải lại im lặng: chỉ đổi dữ liệu nền, không đụng tới form đang nhập.
  useAutoRefresh(
    () =>
      employeeCode
        ? Promise.all([
            leaveRequestApi.getMine(),
            leaveBalanceApi.getByEmployee(employeeCode, new Date().getFullYear()),
            leaveReturnApi.getMine().catch(() => [] as LeaveReturnRequestDto[]),
            leaveCancelApi.getMine().catch(() => [] as LeaveCancelRequestDto[]),
          ])
            .then(([r, b, rt, cx]) => {
              setCancels(cx);
              setRequests([...r].sort((a, c) => c.id - a.id));
              setBalances(b);
              setReturns(rt);
            })
            .catch(() => undefined)
        : undefined,
    { types: ["LeaveApproved", "LeaveRejected", "ReturnApproved", "ReturnRejected", "LeaveSubmitted", ...LEAVE_CANCEL_EVENTS] },
  );

  const selectedType = leaveTypes.find((t) => t.leaveTypeCode === form.leaveTypeCode);
  const isShortLeave = selectedType?.accrualPeriod === "MonthlyReset";
  const isAnnualLeave = form.leaveTypeCode === "ANNUAL";
  const isMultiDay = form.startDate !== form.endDate;

  const submit = async () => {
    if (!form.leaveTypeCode) {
      notify({ ok: false, message: "Vui lòng chọn loại nghỉ." });
      return;
    }
    if (isShortLeave) {
      if (!form.shortSlot) {
        notify({ ok: false, message: "Vui lòng chọn khung giờ nghỉ." });
        return;
      }
    } else if (!form.startDate || !form.endDate) {
      notify({ ok: false, message: "Vui lòng nhập đầy đủ ngày nghỉ." });
      return;
    } else if (isWeekendDate(form.startDate) || isWeekendDate(form.endDate)) {
      notify({ ok: false, message: "Ngày bắt đầu và ngày kết thúc phải là ngày làm việc (thứ Hai đến thứ Sáu)." });
      return;
    } else if (form.endDate < form.startDate) {
      notify({ ok: false, message: "Ngày kết thúc không được trước ngày bắt đầu." });
      return;
    } else if (isAnnualLeave && form.startDate < minAnnualDate) {
      notify({ ok: false, message: `Nghỉ có phép phải xin trước ít nhất 1 ngày. Ngày sớm nhất có thể xin: ${formatDate(minAnnualDate)}.` });
      return;
    }
    if (!form.reason.trim()) {
      notify({ ok: false, message: "Vui lòng nhập lý do xin nghỉ." });
      return;
    }
    setSending(true);
    try {
      if (isShortLeave) {
        const today = isoDate();
        await leaveRequestApi.submit({
          leaveTypeCode: form.leaveTypeCode,
          startDate: `${today}T${form.shortSlot}:00`,
          endDate: `${today}T${shortLeaveSlotLabel(form.shortSlot).split(" - ")[1]}:00`,
          reason: form.reason.trim(),
        });
      } else {
        await leaveRequestApi.submit({
          leaveTypeCode: form.leaveTypeCode,
          startDate: `${form.startDate}T00:00:00`,
          endDate: `${form.endDate}T00:00:00`,
          session: isMultiDay ? "FullDay" : form.session,
          reason: form.reason.trim(),
        });
      }
      notify({ ok: true, message: "Đơn nghỉ phép đã được gửi." });
      setOpen(false);
      setForm((v) => ({ ...v, shortSlot: shortLeaveSlots[0], reason: "" }));
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err, "Đăng ký nghỉ thất bại") });
    } finally {
      setSending(false);
    }
  };

  // Đơn đã duyệt nhưng chưa có buổi nào bắt đầu thì xin quản lý hủy (backend kiểm tra lại); đơn đang chờ duyệt thì hủy thẳng.
  const pendingCancelOf = (leaveId: number) => cancels.find((c) => c.leaveRequestId === leaveId && c.status === "Pending");
  const canRequestCancel = (item: LeaveRequestDto) =>
    item.status === "Approved" && new Date(item.startDate).getTime() > Date.now() && !pendingCancelOf(item.id);

  const sendCancelRequest = async () => {
    if (!cancelReqTarget) return;
    setCancelReqSending(true);
    try {
      await leaveCancelApi.submit(cancelReqTarget.id, cancelReqReason.trim());
      notify({ ok: true, message: "Đã gửi yêu cầu hủy đơn, chờ quản lý duyệt." });
      setCancelReqTarget(null);
      setCancelReqReason("");
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err, "Không gửi được yêu cầu hủy.") });
    } finally {
      setCancelReqSending(false);
    }
  };

  const withdrawCancelRequest = async (cancelId: number) => {
    try {
      await leaveCancelApi.withdraw(cancelId);
      notify({ ok: true, message: "Đã rút lại yêu cầu hủy." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err, "Không rút lại được.") });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await leaveRequestApi.cancel(cancelTarget.id);
      notify({ ok: true, message: "Đã hủy đơn nghỉ phép." });
      setCancelTarget(null);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err, "Không thể hủy đơn.") });
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const remainingDays = balances.filter((b) => b.unit === "Days").reduce((sum, b) => sum + b.remainingTime, 0);
  const pending = requests.filter((r) => r.status === "Pending").length;

  const filteredRequests = requests.filter(
    (r) => (!statusFilter || r.status === statusFilter) && (!typeFilter || r.leaveTypeCode === typeFilter),
  );

  return (
    <div className="page-stack">
      {employeeCode ? (
        <LeaveStatusDialog employeeCode={employeeCode} open={statusOpen} onClose={() => setStatusOpen(false)} />
      ) : null}
      <PageHeader
        title="Xin nghỉ phép"
        description="Tạo đơn nghỉ, theo dõi trạng thái và số dư còn lại."
        action={
          canSelf ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button icon={<ArrowClockwiseRegular />} onClick={() => setReturnOpen(true)}>
                Rút ngắn phép
              </Button>
              <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
                Tạo đơn
              </Button>
            </div>
          ) : undefined
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <>
          <MetricRail
            items={[
              {
                label: "Ngày phép còn lại",
                value: `${formatNumber(remainingDays)} ngày`,
                detail: "Bấm để xem chi tiết",
                tone: "brand",
                onClick: () => setStatusOpen(true),
              },
              { label: "Đang chờ duyệt", value: pending, tone: pending ? "warning" : "success" },
            ]}
          />
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as LeaveTab)}>
            <Tab value="requests">Đơn nghỉ</Tab>
            <Tab value="balances">Số dư</Tab>
            <Tab value="calendar">Lịch</Tab>
          </TabList>

          {tab === "requests" ? (
            <>
              <SectionPanel title="Lịch sử đơn nghỉ">
                <div className="leave-filters">
                  <div className="view-toggle">
                    {leaveStatusFilters.map((f) => (
                      <Button
                        key={f.label}
                        size="small"
                        appearance={statusFilter === f.value ? "primary" : "outline"}
                        onClick={() => setStatusFilter(f.value)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                  {leaveTypes.length > 1 ? (
                    <Dropdown
                      size="small"
                      aria-label="Loại nghỉ"
                      value={leaveTypes.find((t) => t.leaveTypeCode === typeFilter)?.leaveTypeName ?? "Tất cả loại nghỉ"}
                      selectedOptions={[typeFilter ?? ""]}
                      onOptionSelect={(_, data) => setTypeFilter(data.optionValue ? data.optionValue : null)}
                    >
                      <Option value="">Tất cả loại nghỉ</Option>
                      {leaveTypes.map((t) => (
                        <Option key={t.leaveTypeCode} value={t.leaveTypeCode}>
                          {t.leaveTypeName}
                        </Option>
                      ))}
                    </Dropdown>
                  ) : null}
                </div>
                {filteredRequests.length ? (
                  <div className="request-list">
                    {filteredRequests.map((item) => (
                      <article key={item.id} className="leave-request-item" onClick={() => setDetail(item)}>
                        <div className="request-icon">
                          <CalendarRegular />
                        </div>
                        <div className="request-main">
                          <strong>{item.leaveTypeName}</strong>
                          <span>
                            Ngày nghỉ: {leaveDateLabel(item)} · {leaveTimeLabel(item)} · {formatLeaveTime(item.totalTime, item.unit)}
                          </span>
                          {item.reason ? <p>Lý do: {item.reason}</p> : null}
                          {item.rejectionReason ? <small>Lý do từ chối: {item.rejectionReason}</small> : null}
                        </div>
                        <div className="row-actions">
                          <RequestBadge status={item.status} />
                          {item.status === "Pending" && canSelf ? (
                            <Button
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCancelTarget(item);
                              }}
                            >
                              Hủy đơn
                            </Button>
                          ) : null}
                          {item.status === "Approved" && canSelf ? (
                            pendingCancelOf(item.id) ? (
                              <>
                                <small>Đang chờ quản lý duyệt hủy</small>
                                <Button
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void withdrawCancelRequest(pendingCancelOf(item.id)!.id);
                                  }}
                                >
                                  Rút lại
                                </Button>
                              </>
                            ) : canRequestCancel(item) ? (
                              <Button
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setCancelReqTarget(item);
                                }}
                              >
                                Xin hủy đơn
                              </Button>
                            ) : null
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={requests.length ? "Không có đơn phù hợp" : "Chưa có đơn nghỉ"}
                    description={
                      requests.length
                        ? "Không có đơn phù hợp bộ lọc."
                        : "Chưa có đơn nghỉ. Tạo đơn đầu tiên để bắt đầu quy trình duyệt."
                    }
                    actionLabel={requests.length || !canSelf ? undefined : "Tạo đơn"}
                    onAction={() => setOpen(true)}
                  />
                )}
              </SectionPanel>
              <SectionPanel title="Yêu cầu rút ngắn nghỉ phép của tôi">
                {returns.length ? (
                  <div className="request-list">
                    {returns.map((item) => (
                      <article key={item.id}>
                        <div className="request-icon">
                          <ArrowClockwiseRegular />
                        </div>
                        <div className="request-main">
                          <strong>
                            Đi làm lại từ {formatDate(item.fromDate)} ({sessionNames[item.fromSession]})
                          </strong>
                          <p>Lý do: {item.reason}</p>
                          <div className="return-session-lines">
                            {item.sessions.map((s) => (
                              <span key={`${s.date}-${s.session}`}>
                                <small>
                                  {formatDate(s.date)} · {sessionNames[s.session]} · đơn #{s.leaveRequestId}
                                  {s.workedStatus ? ` · ${s.workedStatus === "Late" ? "đi muộn" : "đúng giờ"}` : ""}
                                </small>
                                <ReturnSessionBadge state={s.state} />
                              </span>
                            ))}
                          </div>
                          {item.status === "Rejected" && item.rejectionReason ? (
                            <small>Lý do từ chối: {item.rejectionReason}</small>
                          ) : null}
                          {item.managerName ? <small>Quản lý: {item.managerName}</small> : null}
                          {item.processedByName ? <small>Người xác nhận: {item.processedByName}</small> : null}
                        </div>
                        <div className="row-actions">
                          <ReturnStatusBadge status={item.status} />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Chưa có yêu cầu rút ngắn nghỉ phép"
                    description="Khi cần quay lại làm việc trong thời gian đã được duyệt nghỉ, hãy gửi yêu cầu tại đây."
                  />
                )}
              </SectionPanel>
            </>
          ) : null}

          {tab === "balances" ? (
            <SectionPanel title="Số dư phép theo loại">
              {balances.length ? (
                <div className="compact-list">
                  {balances.map((balance) => {
                    const ratio = balance.allocatedTime <= 0 ? 0 : Math.min(1, balance.usedTime / balance.allocatedTime);
                    return (
                      <div className="compact-row leave-balance-row" key={`${balance.leaveTypeCode}-${balance.month ?? "y"}`}>
                        <div>
                          <strong>{balance.leaveTypeName}</strong>
                          <span>{balance.month ? `Tháng ${balance.month}/${balance.year}` : `Năm ${balance.year}`}</span>
                          <div className="leave-progress" aria-hidden>
                            <i style={{ width: `${ratio * 100}%` }} />
                          </div>
                          <small>Đã dùng {formatLeaveTime(balance.usedTime, balance.unit)}</small>
                          {balance.refundedTime && balance.refundedTime > 0 ? (
                            <small className="leave-refunded">
                              Đã hoàn {formatLeaveTime(balance.refundedTime, balance.unit)} do rút ngắn phép
                            </small>
                          ) : null}
                        </div>
                        <strong>
                          {formatLeaveTime(balance.remainingTime, balance.unit)} / {formatLeaveTime(balance.allocatedTime, balance.unit)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Chưa có số dư"
                  description="Chưa có số dư. Số dư nghỉ phép sẽ hiển thị sau khi quản trị viên cấu hình."
                />
              )}
            </SectionPanel>
          ) : null}

          {tab === "calendar" ? (
            <SectionPanel title="Lịch nghỉ">
              <LeaveCalendar requests={requests} onOpen={setDetail} />
            </SectionPanel>
          ) : null}
        </>
      )}

      <ReturnLeaveDialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        onSubmitted={() => {
          setReturnOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Hủy đơn nghỉ phép"
        description={
          cancelTarget
            ? `Bạn có chắc muốn hủy đơn ${cancelTarget.leaveTypeName} (${leaveDateLabel(cancelTarget)}) không?`
            : ""
        }
        confirmLabel="Hủy đơn"
        confirming={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <Dialog open={Boolean(cancelReqTarget)} onOpenChange={(_, data) => !data.open && setCancelReqTarget(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Xin hủy đơn nghỉ phép</DialogTitle>
            <DialogContent className="form-stack">
              <p className="field-hint">
                {cancelReqTarget ? `${cancelReqTarget.leaveTypeName} (${leaveDateLabel(cancelReqTarget)}). ` : ""}
                Quản lý duyệt thì đơn được hủy và phép được hoàn lại.
              </p>
              <Field label="Lý do hủy" required>
                <Textarea resize="vertical" value={cancelReqReason} onChange={(_, data) => setCancelReqReason(data.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCancelReqTarget(null)}>Đóng</Button>
              <Button appearance="primary" onClick={sendCancelRequest} disabled={cancelReqSending || !cancelReqReason.trim()}>
                {cancelReqSending ? <Spinner size="tiny" /> : "Gửi yêu cầu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(_, data) => !data.open && setDetail(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Chi tiết đơn nghỉ</DialogTitle>
            <DialogContent>
              {detail ? (
                <dl className="detail-list">
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      <RequestBadge status={detail.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Loại nghỉ</dt>
                    <dd>{detail.leaveTypeName}</dd>
                  </div>
                  <div>
                    <dt>Ngày nghỉ</dt>
                    <dd>{leaveDateLabel(detail)}</dd>
                  </div>
                  <div>
                    <dt>Thời gian</dt>
                    <dd>{leaveTimeLabel(detail)}</dd>
                  </div>
                  <div>
                    <dt>Tổng thời gian</dt>
                    <dd>{formatLeaveTime(detail.totalTime, detail.unit)}</dd>
                  </div>
                  {detail.reason ? (
                    <div>
                      <dt>Lý do</dt>
                      <dd>{detail.reason}</dd>
                    </div>
                  ) : null}
                  {detail.approverName ? (
                    <div>
                      <dt>Người duyệt</dt>
                      <dd>{detail.approverName}</dd>
                    </div>
                  ) : null}
                  {detail.approvedAt ? (
                    <div>
                      <dt>Xử lý lúc</dt>
                      <dd>{format(new Date(detail.approvedAt), "dd/MM/yyyy HH:mm")}</dd>
                    </div>
                  ) : null}
                  {detail.rejectionReason ? (
                    <div>
                      <dt>Lý do từ chối</dt>
                      <dd>{detail.rejectionReason}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setDetail(null)}>
                Đóng
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tạo đơn nghỉ phép</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Loại nghỉ" required>
                <Dropdown
                  value={selectedType?.leaveTypeName ?? ""}
                  selectedOptions={[form.leaveTypeCode]}
                  onOptionSelect={(_, data) =>
                    setForm((v) => {
                      const nextCode = data.optionValue ?? "";
                      if (nextCode === "ANNUAL" && v.startDate < minAnnualDate) {
                        return { ...v, leaveTypeCode: nextCode, startDate: minAnnualDate, endDate: minAnnualDate };
                      }
                      return { ...v, leaveTypeCode: nextCode };
                    })
                  }
                >
                  {activeTypes.map((t) => (
                    <Option key={t.leaveTypeCode} value={t.leaveTypeCode}>
                      {t.leaveTypeName}
                    </Option>
                  ))}
                </Dropdown>
                {!activeTypes.length ? <FieldError message="Chưa có loại nghỉ nào được cấu hình." /> : null}
                {selectedType?.description ? <p className="field-hint">{selectedType.description}</p> : null}
              </Field>

              {isShortLeave ? (
                <Field label="Khung giờ nghỉ (hôm nay)" required>
                  <Dropdown
                    value={shortLeaveSlotLabel(form.shortSlot)}
                    selectedOptions={[form.shortSlot]}
                    onOptionSelect={(_, data) =>
                      setForm((v) => ({ ...v, shortSlot: data.optionValue ?? shortLeaveSlots[0] }))
                    }
                  >
                    {shortLeaveSlots.map((slot) => (
                      <Option key={slot} value={slot}>
                        {shortLeaveSlotLabel(slot)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              ) : (
                <>
                  <div className="form-grid">
                    <Field
                      label="Từ ngày"
                      required
                      hint={isAnnualLeave ? `Chọn ngày làm việc (thứ Hai đến thứ Sáu). Nghỉ có phép phải xin trước ít nhất 1 ngày làm việc (sớm nhất ${formatDate(minAnnualDate)}).` : "Chọn ngày làm việc (thứ Hai đến thứ Sáu)."}
                    >
                      <Input
                        type="date"
                        min={isAnnualLeave ? minAnnualDate : minLeaveDate}
                        value={form.startDate}
                        onChange={(_, data) =>
                          setForm((v) => ({
                            ...v,
                            startDate: data.value,
                            // Ngày kết thúc không được trước ngày bắt đầu.
                            endDate: data.value && v.endDate < data.value ? data.value : v.endDate,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Đến ngày" required>
                      <Input
                        type="date"
                        min={form.startDate || undefined}
                        value={form.endDate}
                        onChange={(_, data) => setForm((v) => ({ ...v, endDate: data.value }))}
                      />
                    </Field>
                  </div>
                  {isAnnualLeave && form.startDate < minAnnualDate ? (
                    <FieldError message={`Ngày sớm nhất có thể xin nghỉ có phép là ${formatDate(minAnnualDate)}.`} />
                  ) : null}
                  <Field label="Buổi nghỉ" required>
                    <Dropdown
                      value={isMultiDay ? leaveSessionLabels.FullDay : leaveSessionLabels[form.session]}
                      selectedOptions={[isMultiDay ? "FullDay" : form.session]}
                      disabled={isMultiDay}
                      onOptionSelect={(_, data) =>
                        setForm((v) => ({ ...v, session: (data.optionValue as LeaveSession) ?? "FullDay" }))
                      }
                    >
                      <Option value="Morning">{leaveSessionLabels.Morning}</Option>
                      <Option value="Afternoon">{leaveSessionLabels.Afternoon}</Option>
                      <Option value="FullDay">{leaveSessionLabels.FullDay}</Option>
                    </Dropdown>
                    {isMultiDay ? <FieldError message="Nghỉ nhiều ngày chỉ có thể chọn Cả ngày." /> : null}
                  </Field>
                </>
              )}

              <Field label="Lý do" required>
                <Textarea
                  resize="vertical"
                  placeholder="Nhập lý do chi tiết..."
                  value={form.reason}
                  onChange={(_, data) => setForm((v) => ({ ...v, reason: data.value }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Gửi đơn"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Dialog đi làm lại: nhân viên chỉ chọn ngày/buổi bắt đầu + lý do; hệ thống tự tìm đơn nghỉ liên quan
// và trả bản xem trước, chỉ cho gửi khi xem trước thành công.
// Buổi làm việc đầu tiên chưa bắt đầu (sáng 08:00, chiều 13:00; bỏ qua thứ Bảy, Chủ nhật). Cùng quy tắc với backend.
function earliestReturnSlot(): { date: string; session: DaySession } {
  const now = new Date();
  const date = new Date(now);
  let session: DaySession;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 13 * 60 || date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
    session = "Morning";
  } else {
    session = minutes < 8 * 60 ? "Morning" : "Afternoon";
  }
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
    session = "Morning";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, session };
}

function ReturnLeaveDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const notify = useNotify();
  // Mặc định là buổi sớm nhất còn xin được (buổi đã bắt đầu thì backend không nhận), tránh báo lỗi ngay khi vừa mở.
  const earliest = earliestReturnSlot();
  const [fromDate, setFromDate] = useState(earliest.date);
  const [fromSession, setFromSession] = useState<DaySession>(earliest.session);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<LeaveReturnPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  // Mỗi lần đổi ngày/buổi (khi dialog đang mở) thì tải lại bản xem trước; bỏ kết quả cũ nếu đã đổi lựa chọn.
  useEffect(() => {
    if (!open || !fromDate) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError("");
    setPreviewing(true);
    leaveReturnApi
      .preview(fromDate, fromSession)
      .then((p) => !cancelled && setPreview(p))
      .catch((err) => !cancelled && setPreviewError(errorMessage(err)))
      .finally(() => !cancelled && setPreviewing(false));
    return () => {
      cancelled = true;
    };
  }, [open, fromDate, fromSession]);

  const submit = async () => {
    if (!reason.trim()) {
      notify({ ok: false, message: "Vui lòng nhập lý do rút ngắn phép." });
      return;
    }
    setSending(true);
    try {
      await leaveReturnApi.submit({ fromDate, fromSession, reason });
      notify({ ok: true, message: "Đã gửi yêu cầu rút ngắn nghỉ phép." });
      setReason("");
      onSubmitted();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const orderIds = preview ? [...new Set(preview.sessions.map((s) => s.leaveRequestId))] : [];

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Rút ngắn nghỉ phép</DialogTitle>
          <DialogContent className="form-stack">
            <p className="field-hint">
              Dùng khi kỳ nghỉ đã bắt đầu nhưng bạn muốn đi làm sớm. Chỉ chọn được buổi chưa bắt đầu và không phải buổi đầu của kỳ nghỉ; hệ thống bỏ các buổi nghỉ còn
              lại của đơn đó và hoàn phép. Chưa bắt đầu nghỉ mà không đi nữa thì dùng "Xin hủy đơn" ở danh sách đơn nghỉ.
            </p>
            <div className="form-grid">
              <Field label="Bắt đầu đi làm lại từ ngày" required>
                <Input type="date" min={isoDate()} value={fromDate} onChange={(_, data) => setFromDate(data.value)} />
              </Field>
              <Field label="Buổi" required>
                <Dropdown
                  value={leaveSessionLabels[fromSession]}
                  selectedOptions={[fromSession]}
                  onOptionSelect={(_, data) => setFromSession((data.optionValue as DaySession) ?? "Morning")}
                >
                  <Option value="Morning">{leaveSessionLabels.Morning}</Option>
                  <Option value="Afternoon">{leaveSessionLabels.Afternoon}</Option>
                </Dropdown>
              </Field>
            </div>
            {previewing ? <Spinner size="tiny" label="Đang kiểm tra..." /> : null}
            <FieldError message={previewError} />
            {preview ? (
              <div className="compact-list">
                <strong>
                  Sẽ đi làm lại {preview.sessionCount} buổi, thuộc đơn {orderIds.map((id) => `#${id}`).join(", ")}, hoàn{" "}
                  {preview.refundDays} ngày phép.
                </strong>
                {preview.sessions.map((s) => (
                  <div className="compact-row" key={`${s.date}-${s.session}`}>
                    <span>
                      {formatDate(s.date)} · {sessionNames[s.session]}
                    </span>
                    <small>
                      {s.leaveTypeName} (đơn #{s.leaveRequestId})
                      {s.workedStatus ? ` · ${s.workedStatus === "Late" ? "đi muộn" : "đúng giờ"}` : ""}
                    </small>
                  </div>
                ))}
              </div>
            ) : null}
            <Field label="Lý do" required>
              <Textarea resize="vertical" value={reason} onChange={(_, data) => setReason(data.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Huỷ</Button>
            <Button appearance="primary" onClick={submit} disabled={sending || previewing || !preview}>
              {sending ? <Spinner size="tiny" /> : "Gửi yêu cầu"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

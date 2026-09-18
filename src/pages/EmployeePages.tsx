import {
  Badge,
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
  Textarea,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowClockwiseRegular,
  CalendarRegular,
  CheckmarkCircleRegular,
  ClockRegular,
} from "@fluentui/react-icons";
import { addMonths, eachDayOfInterval, endOfMonth, format as formatDateFns, getDay, startOfMonth, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import {
  AttendanceBadge,
  attendanceColors,
  EmptyState,
  FieldError,
  MetricRail,
  PageHeader,
  RequestBadge,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import {
  attendanceApi,
  dashboardApi,
  leaveBalanceApi,
  leaveRequestApi,
  leaveTypeApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
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
  formatTime,
  isoDate,
  leaveSessionLabels,
  shortLeaveSlotLabel,
  shortLeaveSlots,
} from "../utils/format";

function useEmployeeCode() {
  return useAuthStore((state) => state.session?.employeeCode);
}

export function EmployeeDashboardPage() {
  const employeeCode = useEmployeeCode();
  const notify = useNotify();
  const [data, setData] = useState<EmployeeDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);

  // Chỉ hiện Spinner toàn trang ở lần tải đầu tiên. Các lần load lại sau (vd. sau khi
  // chấm công) không được set loading=true nữa, để tránh unmount cả trang chỉ để refresh
  // dữ liệu — nút chấm công tự có Spinner riêng (state `punching`) cho việc đó.
  const load = () => {
    if (!employeeCode) return;
    dashboardApi
      .employee(employeeCode)
      .then(setData)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!employeeCode)
    return (
      <EmptyState
        title="Tài khoản chưa gắn hồ sơ nhân viên"
        description="Liên hệ Admin để được liên kết hồ sơ nhân viên."
      />
    );
  if (loading || !data) return <Spinner label="Đang tải dashboard..." />;

  const punch = async () => {
    setPunching(true);
    try {
      const record = await attendanceApi.punch();
      notify({
        ok: true,
        message: record.checkOutTime ? "Check-out thành công." : "Check-in thành công.",
      });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setPunching(false);
    }
  };

  const today = data.todayAttendance;
  // Lần punch đầu tiên trong ngày luôn là Check-in; mọi lần sau luôn là Check-out (đè lên giờ
  // ra cũ nếu bấm nhiều lần) — khớp PunchAsync ở backend (AttendanceService.cs).
  const nextAction = !today?.checkInTime ? "Check-in" : "Check-out";

  return (
    <div className="page-stack">
      <PageHeader
        title={`Chào ${data.employeeName}`}
        description="Tổng quan chấm công, phép và các yêu cầu đang chờ duyệt."
      />

      <section className="attendance-hero">
        <div className="attendance-hero-main">
          <span className="shift-icon">
            <ClockRegular />
          </span>
          <div>
            <span>Chấm công hôm nay</span>
            <h2>{today ? today.status : "Chưa chấm công"}</h2>
            <p>
              Vào: {formatDateTime(today?.checkInTime)} · Ra: {formatDateTime(today?.checkOutTime)}
            </p>
          </div>
        </div>
        <div className="attendance-state">
          {today ? <AttendanceBadge status={today.status} /> : <Badge appearance="outline">Chưa chấm công</Badge>}
          <Button
            size="large"
            appearance="primary"
            icon={<CheckmarkCircleRegular />}
            disabled={punching}
            onClick={punch}
          >
            {punching ? <Spinner size="tiny" /> : nextAction}
          </Button>
        </div>
      </section>

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

// Tái dùng đúng bảng màu attendanceColors (ui.tsx) để tô chấm màu trên lịch, tránh 2 nguồn màu
// lệch nhau giữa Badge và ô lịch cho cùng 1 trạng thái.
function attendanceStatusClass(status: string) {
  switch (attendanceColors[status]) {
    case "warning":
      return "has-late";
    case "danger":
      return "has-absent";
    case "informative":
      return "has-missing-checkout";
    default:
      return "";
  }
}

export function EmployeeAttendancePage() {
  const notify = useNotify();
  const [history, setHistory] = useState<AttendanceRecordDto[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    attendanceDate: formatDate(new Date().toISOString(), "yyyy-MM-dd"),
    reason: "",
    newCheckInTime: "08:00",
    newCheckOutTime: "17:30",
  });
  const [historyView, setHistoryView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const employeeCode = useEmployeeCode();

  // Chỉ hiện Spinner toàn trang ở lần tải đầu tiên (xem EmployeeDashboardPage.load ở trên).
  const load = () => {
    if (!employeeCode) return;
    Promise.all([
      attendanceApi.getHistory(employeeCode),
      attendanceApi.getMyAdjustments(),
    ])
      .then(([h, a]) => {
        setHistory(h);
        setAdjustments(a);
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = history.find((record) => record.attendanceDate === isoDate());
  // Lần punch đầu tiên trong ngày luôn là Check-in; mọi lần sau luôn là Check-out (đè lên giờ
  // ra cũ nếu bấm nhiều lần) — khớp PunchAsync ở backend (AttendanceService.cs).
  const nextAction = !today?.checkInTime ? "Check-in" : "Check-out";

  const recordsByDate = useMemo(() => new Map(history.map((r) => [r.attendanceDate, r])), [history]);

  // Ô trống đầu lưới = số ngày lệch giữa Chủ nhật và ngày 1 của tháng (date-fns getDay: 0 = CN).
  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leadingBlanks = getDay(monthStart);
    return [...Array(leadingBlanks).fill(null), ...days];
  }, [calendarMonth]);

  const punch = async () => {
    setPunching(true);
    try {
      const record = await attendanceApi.punch();
      notify({
        ok: true,
        message: record.checkOutTime ? "Check-out thành công." : "Check-in thành công.",
      });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setPunching(false);
    }
  };

  const send = async () => {
    if (!form.reason.trim()) {
      notify({ ok: false, message: "Vui lòng nhập lý do điều chỉnh." });
      return;
    }
    setSending(true);
    try {
      await attendanceApi.submitAdjustment({
        attendanceDate: form.attendanceDate,
        reason: form.reason,
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
        title="Chấm công của tôi"
        description="Xem lịch sử và gửi yêu cầu khi bản ghi chưa chính xác."
        action={
          <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={() => setDialogOpen(true)}>
            Yêu cầu chỉnh sửa
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <>
          <section className="attendance-hero">
            <div className="attendance-hero-main">
              <span className="shift-icon">
                <ClockRegular />
              </span>
              <div>
                <span>Chấm công hôm nay</span>
                <h2>{today ? today.status : "Chưa chấm công"}</h2>
                <p>
                  Vào: {formatDateTime(today?.checkInTime)} · Ra: {formatDateTime(today?.checkOutTime)}
                </p>
              </div>
            </div>
            <div className="attendance-state">
              {today ? <AttendanceBadge status={today.status} /> : <Badge appearance="outline">Chưa chấm công</Badge>}
              <Button
                size="large"
                appearance="primary"
                icon={<CheckmarkCircleRegular />}
                disabled={punching}
                onClick={punch}
              >
                {punching ? <Spinner size="tiny" /> : nextAction}
              </Button>
            </div>
          </section>
          <div className="two-column-grid">
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
              <div>
                <div className="attendance-calendar-header">
                  <Button size="small" onClick={() => setCalendarMonth((m) => subMonths(m, 1))}>
                    ‹
                  </Button>
                  <strong>{formatDateFns(calendarMonth, "MMMM yyyy", { locale: vi })}</strong>
                  <Button size="small" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
                    ›
                  </Button>
                </div>
                <div className="month-calendar">
                  {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((dow) => (
                    <div className="calendar-weekday" key={dow}>
                      {dow}
                    </div>
                  ))}
                  {calendarCells.map((day, index) => {
                    if (!day) {
                      return <div className="calendar-day is-outside" key={`blank-${index}`} />;
                    }
                    const key = formatDateFns(day, "yyyy-MM-dd");
                    const record = recordsByDate.get(key);
                    return (
                      <div
                        className={`calendar-day${record ? ` ${attendanceStatusClass(record.status)}` : " is-outside"}`}
                        key={key}
                        title={record ? attendanceLabels[record.status] ?? record.status : undefined}
                      >
                        {formatDateFns(day, "d")}
                        {record ? <i /> : null}
                      </div>
                    );
                  })}
                </div>
                <div className="attendance-calendar-legend">
                  <span><i className="legend-dot" style={{ background: "var(--success)" }} />Đúng giờ</span>
                  <span><i className="legend-dot" style={{ background: "#d97706" }} />Đi muộn / Nửa ngày</span>
                  <span><i className="legend-dot" style={{ background: "var(--danger)" }} />Vắng mặt</span>
                  <span><i className="legend-dot" style={{ background: "var(--brand)" }} />Nghỉ phép</span>
                </div>
              </div>
            ) : history.length ? (
              <div className="attendance-list">
                {history.map((record) => (
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
                    <AttendanceBadge status={record.status} />
                  </article>
                ))}
              </div>
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
                      <span>{item.reason}</span>
                    </div>
                    <RequestBadge status={item.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có yêu cầu" description="Yêu cầu chỉnh sửa chấm công sẽ hiển thị tại đây." />
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
              <Field label="Lý do" required>
                <Textarea
                  resize="vertical"
                  value={form.reason}
                  onChange={(_, data) => setForm((v) => ({ ...v, reason: data.value }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
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

export function EmployeeLeavePage() {
  const notify = useNotify();
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceDto[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const employeeCode = useEmployeeCode();
  const [form, setForm] = useState({
    leaveTypeCode: "",
    startDate: isoDate(),
    endDate: isoDate(),
    session: "FullDay" as LeaveSession,
    shortSlot: shortLeaveSlots[0],
    reason: "",
  });

  // Nghỉ có phép phải xin trước ít nhất 1 ngày làm việc để quản lý kịp duyệt và sắp xếp
  // công việc: xin trước/đúng 17h thì sớm nhất là ngày mai, xin sau 17h thì sớm nhất là
  // ngày kia. Khớp với ResolveRequestedTime ở backend (LeaveRequestService.cs).
  const minAnnualDate = (() => {
    const now = new Date();
    const daysAhead = now.getHours() < 17 ? 1 : 2;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
    return isoDate(d);
  })();

  const load = () => {
    if (!employeeCode) return;
    setLoading(true);
    Promise.all([
      leaveRequestApi.getMine(),
      leaveBalanceApi.getByEmployee(employeeCode, new Date().getFullYear()),
      leaveTypeApi.getAll(),
    ])
      .then(([r, b, t]) => {
        setRequests(r);
        setBalances(b);
        setLeaveTypes(t);
        if (t.length) {
          setForm((v) => {
            const nextCode = v.leaveTypeCode || t[0].leaveTypeCode;
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
          reason: form.reason,
        });
      } else {
        await leaveRequestApi.submit({
          leaveTypeCode: form.leaveTypeCode,
          startDate: `${form.startDate}T00:00:00`,
          endDate: `${form.endDate}T00:00:00`,
          session: isMultiDay ? "FullDay" : form.session,
          reason: form.reason,
        });
      }
      notify({ ok: true, message: "Đơn nghỉ phép đã được gửi." });
      setOpen(false);
      setForm((v) => ({ ...v, shortSlot: shortLeaveSlots[0], reason: "" }));
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const cancel = async (id: number) => {
    try {
      await leaveRequestApi.cancel(id);
      notify({ ok: true, message: "Đã hủy đơn nghỉ phép." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const remainingDays = balances.filter((b) => b.unit === "Days").reduce((sum, b) => sum + b.remainingTime, 0);
  const shortLeaveBalance = balances.find((b) => b.unit === "Hours");
  const pending = requests.filter((r) => r.status === "Pending").length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Xin nghỉ phép"
        description="Tạo đơn nghỉ, theo dõi trạng thái và số dư còn lại."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
            Tạo đơn
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <>
          <MetricRail
            items={[
              { label: "Ngày phép còn lại", value: `${remainingDays} ngày`, tone: "brand" },
              shortLeaveBalance
                ? {
                    label: "Nghỉ ngắn tháng này",
                    value: formatLeaveTime(shortLeaveBalance.remainingTime, shortLeaveBalance.unit),
                    tone: "brand",
                  }
                : { label: "Nghỉ ngắn tháng này", value: "--", tone: "brand" },
              { label: "Đang chờ duyệt", value: pending, tone: pending ? "warning" : "success" },
            ]}
          />
          <SectionPanel title="Lịch sử đơn nghỉ">
            {requests.length ? (
              <div className="request-list">
                {requests.map((item) => (
                  <article key={item.id}>
                    <div className="request-icon">
                      <CalendarRegular />
                    </div>
                    <div className="request-main">
                      <strong>{item.leaveTypeName}</strong>
                      <span>
                        {item.unit === "Hours"
                          ? `${formatDate(item.startDate)}, ${formatTime(item.startDate)} - ${formatTime(item.endDate)}`
                          : `${formatDate(item.startDate)} - ${formatDate(item.endDate)}${item.session ? ` · ${leaveSessionLabels[item.session]}` : ""}`}
                        {" · "}
                        {formatLeaveTime(item.totalTime, item.unit)}
                      </span>
                      <p>{item.reason}</p>
                      {item.rejectionReason ? <small>Lý do từ chối: {item.rejectionReason}</small> : null}
                    </div>
                    <div className="row-actions">
                      <RequestBadge status={item.status} />
                      {item.status === "Pending" ? (
                        <Button size="small" onClick={() => cancel(item.id)}>
                          Hủy
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có đơn nghỉ"
                description="Tạo đơn đầu tiên để bắt đầu quy trình duyệt."
                actionLabel="Tạo đơn"
                onAction={() => setOpen(true)}
              />
            )}
          </SectionPanel>
          <SectionPanel title="Số dư phép theo loại">
            {balances.length ? (
              <div className="compact-list">
                {balances.map((balance) => (
                  <div className="compact-row" key={`${balance.leaveTypeCode}-${balance.month ?? "y"}`}>
                    <div>
                      <strong>{balance.leaveTypeName}</strong>
                      <span>{balance.month ? `Tháng ${balance.month}/${balance.year}` : `Năm ${balance.year}`}</span>
                    </div>
                    <strong>
                      {formatLeaveTime(balance.remainingTime, balance.unit)} / {formatLeaveTime(balance.allocatedTime, balance.unit)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có số dư" description="Số dư nghỉ phép sẽ hiển thị sau khi Admin cấu hình." />
            )}
          </SectionPanel>
        </>
      )}

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
                  {leaveTypes.map((t) => (
                    <Option key={t.leaveTypeCode} value={t.leaveTypeCode}>
                      {t.leaveTypeName}
                    </Option>
                  ))}
                </Dropdown>
                {!leaveTypes.length ? <FieldError message="Chưa có loại nghỉ nào được cấu hình." /> : null}
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
                      hint={isAnnualLeave ? `Nghỉ có phép phải xin trước ít nhất 1 ngày làm việc.` : undefined}
                    >
                      <Input
                        type="date"
                        min={isAnnualLeave ? minAnnualDate : undefined}
                        value={form.startDate}
                        onChange={(_, data) => setForm((v) => ({ ...v, startDate: data.value }))}
                      />
                    </Field>
                    <Field label="Đến ngày" required>
                      <Input
                        type="date"
                        min={isAnnualLeave ? minAnnualDate : undefined}
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
                  value={form.reason}
                  onChange={(_, data) => setForm((v) => ({ ...v, reason: data.value }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
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

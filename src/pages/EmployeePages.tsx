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
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowClockwiseRegular,
  CalendarCheckmarkRegular,
  CalendarRegular,
  CheckmarkCircleRegular,
  ClockRegular,
  LocationRegular,
  PersonRegular,
} from "@fluentui/react-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { vi } from "date-fns/locale";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  AttendanceBadge,
  EmptyState,
  FieldError,
  MetricRail,
  PageHeader,
  RequestBadge,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAppStore } from "../store/useAppStore";
import type { LeaveType } from "../types/domain";
import {
  formatDate,
  formatTime,
  isoDate,
  leaveTypeLabels,
} from "../utils/format";

function useCurrentEmployee() {
  const currentEmployeeId = useAppStore((state) => state.currentEmployeeId);
  return useAppStore((state) =>
    state.employees.find((item) => item.id === currentEmployeeId),
  );
}

export function EmployeeHomePage() {
  const employee = useCurrentEmployee();
  const demo = useAppStore((state) => state.demo);
  const shifts = useAppStore((state) => state.shifts);
  const attendance = useAppStore((state) => state.attendanceRecords);
  const leaveRequests = useAppStore((state) => state.leaveRequests);
  const adjustmentRequests = useAppStore((state) => state.adjustmentRequests);
  const checkIn = useAppStore((state) => state.checkIn);
  const checkOut = useAppStore((state) => state.checkOut);
  const notify = useNotify();
  if (!employee)
    return (
      <EmptyState
        title="Không tìm thấy hồ sơ"
        description="Hãy đăng nhập lại bằng tài khoản nhân viên mẫu."
      />
    );

  const date = demo.simulatedDate || isoDate();
  const shift = shifts.find((item) => item.id === employee.shiftId);
  const todayRecord = attendance.find(
    (item) => item.employeeId === employee.id && item.date === date,
  );
  const weekStart = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const weekRecords = attendance.filter(
    (item) =>
      item.employeeId === employee.id &&
      item.date >= format(weekStart, "yyyy-MM-dd") &&
      item.date <= format(addDays(weekStart, 6), "yyyy-MM-dd"),
  );
  const worked = weekRecords.filter((item) => item.checkIn).length;
  const late = weekRecords.filter((item) => item.status === "late").length;
  const latestRequest = [
    ...leaveRequests.filter((item) => item.employeeId === employee.id),
    ...adjustmentRequests.filter((item) => item.employeeId === employee.id),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const action = !todayRecord?.checkIn
    ? { label: "Check-in", run: checkIn }
    : !todayRecord.checkOut
      ? { label: "Check-out", run: checkOut }
      : null;

  return (
    <div className="page-stack">
      <PageHeader
        title={`Chào ${employee.fullName.split(" ").slice(-2).join(" ")}`}
        description={`Hôm nay, ${format(parseISO(date), "EEEE, dd/MM/yyyy", { locale: vi })}`}
      />

      <section className="attendance-hero">
        <div className="attendance-hero-main">
          <span className="shift-icon">
            <ClockRegular />
          </span>
          <div>
            <span>Ca hôm nay</span>
            <h2>{shift?.name}</h2>
            <p>
              {shift?.startTime} - {shift?.endTime} · Nghỉ {shift?.breakMinutes}{" "}
              phút
            </p>
          </div>
        </div>
        <div className="attendance-state">
          <div className="location-line">
            <LocationRegular />
            <span>
              {demo.locationMode === "inside"
                ? "Trong bán kính văn phòng"
                : "Ngoài bán kính văn phòng"}
            </span>
          </div>
          {todayRecord ? (
            <AttendanceBadge status={todayRecord.status} />
          ) : (
            <Badge appearance="outline">Chưa chấm công</Badge>
          )}
          <div className="time-pair">
            <div>
              <span>Check-in</span>
              <strong>{formatTime(todayRecord?.checkIn)}</strong>
            </div>
            <div>
              <span>Check-out</span>
              <strong>{formatTime(todayRecord?.checkOut)}</strong>
            </div>
          </div>
          {action ? (
            <Button
              size="large"
              appearance="primary"
              icon={<CheckmarkCircleRegular />}
              onClick={() => notify(action.run())}
            >
              {action.label}
            </Button>
          ) : (
            <div className="complete-state">
              <CheckmarkCircleRegular />
              <span>Đã hoàn thành ca làm hôm nay</span>
            </div>
          )}
        </div>
      </section>

      <MetricRail
        items={[
          {
            label: "Ngày đã làm tuần này",
            value: worked,
            detail: "Trên 5 ngày dự kiến",
            tone: "brand",
          },
          {
            label: "Đi muộn",
            value: late,
            detail: late ? "Cần theo dõi" : "Đúng giờ trong tuần",
            tone: late ? "warning" : "success",
          },
          {
            label: "Phép còn lại",
            value: `${employee.leaveBalance} ngày`,
            detail: "Dữ liệu minh họa",
            tone: "success",
          },
        ]}
      />

      <div className="two-column-grid">
        <SectionPanel title="Chấm công gần đây">
          <div className="compact-list">
            {attendance
              .filter((item) => item.employeeId === employee.id)
              .slice(0, 5)
              .map((record) => (
                <div className="compact-row" key={record.id}>
                  <div>
                    <strong>{formatDate(record.date, "EEEE, dd/MM")}</strong>
                    <span>
                      {formatTime(record.checkIn)} -{" "}
                      {formatTime(record.checkOut)}
                    </span>
                  </div>
                  <AttendanceBadge status={record.status} />
                </div>
              ))}
          </div>
        </SectionPanel>
        <SectionPanel title="Yêu cầu gần nhất">
          {latestRequest ? (
            <div className="request-summary">
              <CalendarCheckmarkRegular />
              <div>
                <strong>
                  {"type" in latestRequest
                    ? leaveTypeLabels[latestRequest.type]
                    : "Điều chỉnh chấm công"}
                </strong>
                <p>
                  {"startDate" in latestRequest
                    ? `${formatDate(latestRequest.startDate)} - ${formatDate(latestRequest.endDate)}`
                    : formatDate(latestRequest.date)}
                </p>
              </div>
              <RequestBadge status={latestRequest.status} />
            </div>
          ) : (
            <EmptyState
              title="Chưa có yêu cầu"
              description="Các đơn và yêu cầu điều chỉnh sẽ xuất hiện tại đây."
            />
          )}
        </SectionPanel>
      </div>
    </div>
  );
}

export function EmployeeAttendancePage() {
  const employee = useCurrentEmployee();
  const records = useAppStore((state) => state.attendanceRecords);
  const adjustments = useAppStore((state) => state.adjustmentRequests);
  const submitAdjustment = useAppStore((state) => state.submitAdjustment);
  const notify = useNotify();
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM"),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    date: isoDate(subDays(new Date(), 1)),
    requestedCheckIn: "08:00",
    requestedCheckOut: "17:30",
    reason: "",
  });
  if (!employee) return null;
  const filtered = records
    .filter(
      (item) =>
        item.employeeId === employee.id && item.date.startsWith(selectedMonth),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });

  const send = () => {
    const result = submitAdjustment({
      date: form.date,
      requestedCheckIn: form.requestedCheckIn
        ? new Date(
            `${form.date}T${form.requestedCheckIn}:00+07:00`,
          ).toISOString()
        : undefined,
      requestedCheckOut: form.requestedCheckOut
        ? new Date(
            `${form.date}T${form.requestedCheckOut}:00+07:00`,
          ).toISOString()
        : undefined,
      reason: form.reason,
    });
    notify(result);
    if (result.ok) setDialogOpen(false);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Chấm công của tôi"
        description="Xem lịch sử và gửi yêu cầu khi bản ghi chưa chính xác."
        action={
          <Button
            appearance="primary"
            icon={<ArrowClockwiseRegular />}
            onClick={() => setDialogOpen(true)}
          >
            Điều chỉnh
          </Button>
        }
      />
      <div className="toolbar">
        <Field label="Tháng">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(_, data) => setSelectedMonth(data.value)}
          />
        </Field>
      </div>
      <div className="employee-attendance-layout">
        <SectionPanel
          title={`Lịch sử tháng ${selectedMonth.slice(5)}/${selectedMonth.slice(0, 4)}`}
        >
          <div
            className="month-calendar"
            aria-label={`Lịch chấm công tháng ${selectedMonth.slice(5)}`}
          >
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
              <strong className="calendar-weekday" key={label}>
                {label}
              </strong>
            ))}
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const record = filtered.find((item) => item.date === dayKey);
              const inMonth = format(day, "yyyy-MM") === selectedMonth;
              return (
                <div
                  className={`calendar-day ${inMonth ? "" : "is-outside"} ${record ? `has-${record.status}` : ""}`}
                  key={dayKey}
                >
                  <span>{format(day, "d")}</span>
                  {record ? <i aria-label={record.status} /> : null}
                </div>
              );
            })}
          </div>
          <div className="monthly-divider">
            <span>Chi tiết từng ngày</span>
          </div>
          {filtered.length ? (
            <div className="attendance-list">
              {filtered.map((record) => (
                <article className="attendance-list-item" key={record.id}>
                  <div className="date-block">
                    <strong>{formatDate(record.date, "dd")}</strong>
                    <span>{formatDate(record.date, "EEE")}</span>
                  </div>
                  <div className="attendance-times">
                    <div>
                      <span>Vào</span>
                      <strong>{formatTime(record.checkIn)}</strong>
                    </div>
                    <div>
                      <span>Ra</span>
                      <strong>{formatTime(record.checkOut)}</strong>
                    </div>
                  </div>
                  <AttendanceBadge status={record.status} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Không có dữ liệu"
              description="Tháng đã chọn chưa có bản ghi chấm công."
            />
          )}
        </SectionPanel>
        <SectionPanel title="Yêu cầu điều chỉnh">
          <div className="compact-list">
            {adjustments
              .filter((item) => item.employeeId === employee.id)
              .map((item) => (
                <div className="compact-row" key={item.id}>
                  <div>
                    <strong>{formatDate(item.date)}</strong>
                    <span>{item.reason}</span>
                  </div>
                  <RequestBadge status={item.status} />
                </div>
              ))}
          </div>
        </SectionPanel>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(_, data) => setDialogOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Yêu cầu điều chỉnh</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Ngày cần điều chỉnh" required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(_, data) =>
                    setForm((value) => ({ ...value, date: data.value }))
                  }
                />
              </Field>
              <div className="form-grid">
                <Field label="Giờ vào đề xuất">
                  <Input
                    type="time"
                    value={form.requestedCheckIn}
                    onChange={(_, data) =>
                      setForm((value) => ({
                        ...value,
                        requestedCheckIn: data.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Giờ ra đề xuất">
                  <Input
                    type="time"
                    value={form.requestedCheckOut}
                    onChange={(_, data) =>
                      setForm((value) => ({
                        ...value,
                        requestedCheckOut: data.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Lý do" required>
                <Textarea
                  resize="vertical"
                  value={form.reason}
                  onChange={(_, data) =>
                    setForm((value) => ({ ...value, reason: data.value }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={send}>
                Gửi yêu cầu
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function EmployeeSchedulePage() {
  const employee = useCurrentEmployee();
  const shifts = useAppStore((state) => state.shifts);
  const demoDate = useAppStore((state) => state.demo.simulatedDate);
  const [view, setView] = useState("week");
  if (!employee) return null;
  const shift = shifts.find((item) => item.id === employee.shiftId);
  const baseDate = parseISO(demoDate || isoDate());
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(baseDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(baseDate), { weekStartsOn: 1 }),
  });
  return (
    <div className="page-stack">
      <PageHeader
        title="Lịch ca"
        description="Lịch làm việc theo tuần, tháng và thông tin mẫu ca hiện tại."
        action={
          <TabList
            selectedValue={view}
            onTabSelect={(_, data) => setView(String(data.value))}
          >
            <Tab value="week">Tuần</Tab>
            <Tab value="month">Tháng</Tab>
          </TabList>
        }
      />
      <SectionPanel>
        {view === "week" ? (
          <div className="week-strip">
            {days.map((day, index) => {
              const weekend = index > 4;
              return (
                <article
                  className={`day-card ${format(day, "yyyy-MM-dd") === format(baseDate, "yyyy-MM-dd") ? "is-today" : ""}`}
                  key={day.toISOString()}
                >
                  <span>{format(day, "EEEE", { locale: vi })}</span>
                  <strong>{format(day, "dd")}</strong>
                  {weekend ? (
                    <small>Nghỉ</small>
                  ) : (
                    <Badge appearance="tint" color="informative">
                      {shift?.name}
                    </Badge>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="month-calendar schedule-calendar">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
              <strong className="calendar-weekday" key={label}>
                {label}
              </strong>
            ))}
            {monthDays.map((day) => {
              const outside = format(day, "MM") !== format(baseDate, "MM");
              const weekend = Number(format(day, "i")) > 5;
              return (
                <div
                  className={`calendar-day ${outside ? "is-outside" : ""} ${format(day, "yyyy-MM-dd") === format(baseDate, "yyyy-MM-dd") ? "is-today" : ""}`}
                  key={day.toISOString()}
                >
                  <span>{format(day, "d")}</span>
                  <small>{weekend ? "Nghỉ" : shift?.startTime}</small>
                </div>
              );
            })}
          </div>
        )}
      </SectionPanel>
      <div className="two-column-grid">
        <SectionPanel title="Ca đang áp dụng">
          <div className="shift-detail">
            <span
              className="shift-color"
              style={{ background: shift?.color }}
            />
            <div>
              <h3>{shift?.name}</h3>
              <p>
                {shift?.startTime} - {shift?.endTime}
              </p>
              <small>Nghỉ giữa ca {shift?.breakMinutes} phút</small>
            </div>
          </div>
        </SectionPanel>
        <SectionPanel title="Quy định ghi nhận">
          <div className="policy-list">
            <p>
              <CheckmarkCircleRegular /> Cho phép check-in sớm trước ca.
            </p>
            <p>
              <ClockRegular /> Sau 5 phút được ghi nhận đi muộn.
            </p>
            <p>
              <LocationRegular /> Vị trí phải nằm trong bán kính văn phòng.
            </p>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

const leaveSchema = z
  .object({
    type: z.enum(["annual", "sick", "unpaid", "other"]),
    startDate: z.string().min(1, "Chọn ngày bắt đầu."),
    endDate: z.string().min(1, "Chọn ngày kết thúc."),
    reason: z.string().trim().min(8, "Lý do cần ít nhất 8 ký tự."),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
    path: ["endDate"],
  });

type LeaveForm = z.infer<typeof leaveSchema>;

export function EmployeeLeavePage() {
  const employee = useCurrentEmployee();
  const requests = useAppStore((state) => state.leaveRequests);
  const leaveBalances = useAppStore((state) => state.leaveBalances);
  const overtimeRequests = useAppStore((state) => state.overtimeRequests);
  const submitLeave = useAppStore((state) => state.submitLeave);
  const submitOvertime = useAppStore((state) => state.submitOvertime);
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [otOpen, setOtOpen] = useState(false);
  const [otForm, setOtForm] = useState({
    date: isoDate(),
    hours: 2,
    reason: "",
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "annual", startDate: "", endDate: "", reason: "" },
  });
  if (!employee) return null;
  const ownRequests = requests.filter(
    (item) => item.employeeId === employee.id,
  );
  const ownBalances = leaveBalances.filter(
    (item) => item.employeeId === employee.id,
  );
  const ownOtRequests = overtimeRequests.filter(
    (item) => item.employeeId === employee.id,
  );
  const pending = ownRequests.filter(
    (item) => item.status === "pending",
  ).length;
  const approved = ownRequests
    .filter((item) => item.status === "approved")
    .reduce((sum, item) => sum + item.days, 0);

  const onSubmit = (data: LeaveForm) => {
    const result = submitLeave({ ...data, type: data.type as LeaveType });
    notify(result);
    if (result.ok) {
      setOpen(false);
      reset();
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Nghỉ phép"
        description="Theo dõi số dư và trạng thái các đơn đã gửi."
        action={
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => setOpen(true)}
          >
            Tạo đơn
          </Button>
        }
      />
      <MetricRail
        items={[
          {
            label: "Phép còn lại",
            value: `${employee.leaveBalance} ngày`,
            detail: "Số dư hiện tại",
            tone: "brand",
          },
          {
            label: "Đang chờ duyệt",
            value: pending,
            detail: "Yêu cầu chưa xử lý",
            tone: pending ? "warning" : "success",
          },
          {
            label: "Đã nghỉ",
            value: `${approved} ngày`,
            detail: "Theo đơn đã duyệt",
            tone: "success",
          },
        ]}
      />
      <SectionPanel title="Lịch sử đơn nghỉ">
        {ownRequests.length ? (
          <div className="request-list">
            {ownRequests.map((item) => (
              <article key={item.id}>
                <div className="request-icon">
                  <CalendarRegular />
                </div>
                <div className="request-main">
                  <strong>{leaveTypeLabels[item.type]}</strong>
                  <span>
                    {formatDate(item.startDate)} - {formatDate(item.endDate)} ·{" "}
                    {item.days} ngày
                  </span>
                  <p>{item.reason}</p>
                  {item.reviewNote ? (
                    <small>Phản hồi: {item.reviewNote}</small>
                  ) : null}
                </div>
                <RequestBadge status={item.status} />
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

      <div className="two-column-grid">
        <SectionPanel title="Số dư phép theo loại">
          {ownBalances.length ? (
            <div className="compact-list">
              {ownBalances.map((balance) => (
                <div className="compact-row" key={balance.id}>
                  <div>
                    <strong>{leaveTypeLabels[balance.leaveType]}</strong>
                    <span>Năm {balance.year}</span>
                  </div>
                  <strong>
                    {balance.remaining}/{balance.allocated} ngày
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có số dư"
              description="Số dư nghỉ phép sẽ hiển thị sau khi HR cấu hình."
            />
          )}
        </SectionPanel>
        <SectionPanel
          title="Đăng ký OT"
          action={
            <Button
              appearance="primary"
              icon={<AddRegular />}
              onClick={() => setOtOpen(true)}
            >
              Tạo OT
            </Button>
          }
        >
          {ownOtRequests.length ? (
            <div className="compact-list">
              {ownOtRequests.map((item) => (
                <div className="compact-row" key={item.id}>
                  <div>
                    <strong>{formatDate(item.date)}</strong>
                    <span>
                      {item.hours} giờ · {item.reason}
                    </span>
                  </div>
                  <RequestBadge status={item.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có OT"
              description="Các đăng ký làm thêm giờ sẽ xuất hiện tại đây."
            />
          )}
        </SectionPanel>
      </div>

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody>
              <DialogTitle>Tạo đơn nghỉ phép</DialogTitle>
              <DialogContent className="form-stack">
                <Field label="Loại nghỉ" required>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        value={leaveTypeLabels[field.value as LeaveType]}
                        selectedOptions={[field.value]}
                        onOptionSelect={(_, data) =>
                          field.onChange(data.optionValue)
                        }
                      >
                        {Object.entries(leaveTypeLabels).map(
                          ([value, label]) => (
                            <Option key={value} value={value}>
                              {label}
                            </Option>
                          ),
                        )}
                      </Dropdown>
                    )}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Từ ngày" required>
                    <Input type="date" {...register("startDate")} />
                    <FieldError message={errors.startDate?.message} />
                  </Field>
                  <Field label="Đến ngày" required>
                    <Input type="date" {...register("endDate")} />
                    <FieldError message={errors.endDate?.message} />
                  </Field>
                </div>
                <Field label="Lý do" required>
                  <Textarea resize="vertical" {...register("reason")} />
                  <FieldError message={errors.reason?.message} />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button type="button" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" appearance="primary">
                  Gửi đơn
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      <Dialog open={otOpen} onOpenChange={(_, data) => setOtOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Đăng ký OT</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Ngày OT">
                  <Input
                    type="date"
                    value={otForm.date}
                    onChange={(_, data) =>
                      setOtForm((value) => ({ ...value, date: data.value }))
                    }
                  />
                </Field>
                <Field label="Số giờ">
                  <Input
                    type="number"
                    min={1}
                    value={String(otForm.hours)}
                    onChange={(_, data) =>
                      setOtForm((value) => ({
                        ...value,
                        hours: Number(data.value),
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Lý do">
                <Textarea
                  resize="vertical"
                  value={otForm.reason}
                  onChange={(_, data) =>
                    setOtForm((value) => ({ ...value, reason: data.value }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOtOpen(false)}>Hủy</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  const result = submitOvertime(otForm);
                  notify(result);
                  if (result.ok) setOtOpen(false);
                }}
              >
                Gửi OT
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function EmployeeProfilePage() {
  const employee = useCurrentEmployee();
  const departments = useAppStore((state) => state.departments);
  const positions = useAppStore((state) => state.positions);
  const shifts = useAppStore((state) => state.shifts);
  if (!employee) return null;
  const department = departments.find(
    (item) => item.id === employee.departmentId,
  );
  const position = positions.find((item) => item.id === employee.positionId);
  const shift = shifts.find((item) => item.id === employee.shiftId);
  return (
    <div className="page-stack">
      <PageHeader
        title="Hồ sơ của tôi"
        description="Thông tin được quản lý bởi phòng nhân sự."
      />
      <section className="profile-banner">
        <div
          className="profile-large-avatar"
          style={{ background: employee.avatarColor }}
        >
          {employee.fullName
            .split(" ")
            .slice(-2)
            .map((part) => part[0])
            .join("")}
        </div>
        <div>
          <h2>{employee.fullName}</h2>
          <p>
            {employee.employeeCode} · {position?.name}
          </p>
          <Badge
            appearance="tint"
            color={employee.status === "active" ? "success" : "danger"}
          >
            {employee.status === "active" ? "Đang làm việc" : "Ngừng hoạt động"}
          </Badge>
        </div>
      </section>
      <div className="two-column-grid">
        <SectionPanel title="Thông tin cá nhân">
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{employee.email}</dd>
            </div>
            <div>
              <dt>Điện thoại</dt>
              <dd>{employee.phone}</dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{formatDate(employee.birthDate)}</dd>
            </div>
            <div>
              <dt>Địa chỉ</dt>
              <dd>{employee.address}</dd>
            </div>
          </dl>
        </SectionPanel>
        <SectionPanel title="Thông tin công việc">
          <dl className="detail-list">
            <div>
              <dt>Phòng ban</dt>
              <dd>{department?.name}</dd>
            </div>
            <div>
              <dt>Chức vụ</dt>
              <dd>{position?.name}</dd>
            </div>
            <div>
              <dt>Ngày vào làm</dt>
              <dd>{formatDate(employee.startDate)}</dd>
            </div>
            <div>
              <dt>Ca làm</dt>
              <dd>
                {shift?.name} ({shift?.startTime} - {shift?.endTime})
              </dd>
            </div>
          </dl>
        </SectionPanel>
      </div>
      <SectionPanel title="Cập nhật thông tin">
        <div className="info-banner">
          <PersonRegular />
          <div>
            <strong>Cần thay đổi thông tin?</strong>
            <p>Liên hệ phòng Nhân sự để cập nhật hồ sơ chính thức.</p>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}

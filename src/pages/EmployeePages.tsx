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
  CalendarCheckmarkRegular,
  CalendarRegular,
  CheckmarkCircleRegular,
  ClockRegular,
  PeopleTeamRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
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
import {
  attendanceApi,
  customerApi,
  dashboardApi,
  leaveBalanceApi,
  leaveRequestApi,
  leaveTypeApi,
  saleApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
import type {
  AttendanceAdjustmentDto,
  AttendanceRecordDto,
  CustomerDto,
  EmployeeDashboardDto,
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveTypeDto,
  SaleDto,
} from "../types/domain";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";

function useEmployeeCode() {
  return useAuthStore((state) => state.session?.employeeCode);
}

export function EmployeeDashboardPage() {
  const employeeCode = useEmployeeCode();
  const notify = useNotify();
  const [data, setData] = useState<EmployeeDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);

  const load = () => {
    if (!employeeCode) return;
    setLoading(true);
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
  const nextAction = !today?.checkInTime ? "Check-in" : !today?.checkOutTime ? "Check-out" : null;

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
          {nextAction ? (
            <Button
              size="large"
              appearance="primary"
              icon={<CheckmarkCircleRegular />}
              disabled={punching}
              onClick={punch}
            >
              {punching ? <Spinner size="tiny" /> : nextAction}
            </Button>
          ) : (
            <div className="complete-state">
              <CheckmarkCircleRegular />
              <span>Đã hoàn thành chấm công hôm nay</span>
            </div>
          )}
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
            label: "Sale chờ duyệt",
            value: data.pendingSalesCount,
            tone: data.pendingSalesCount ? "warning" : "success",
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
  const employeeCode = useEmployeeCode();

  const load = () => {
    if (!employeeCode) return;
    setLoading(true);
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
        <div className="two-column-grid">
          <SectionPanel title="Lịch sử chấm công">
            {history.length ? (
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
    startDate: "",
    endDate: "",
    reason: "",
  });

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
        if (t.length) setForm((v) => ({ ...v, leaveTypeCode: v.leaveTypeCode || t[0].leaveTypeCode }));
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!form.leaveTypeCode || !form.startDate || !form.endDate) {
      notify({ ok: false, message: "Vui lòng nhập đầy đủ thông tin đơn nghỉ." });
      return;
    }
    setSending(true);
    try {
      await leaveRequestApi.submit(form);
      notify({ ok: true, message: "Đơn nghỉ phép đã được gửi." });
      setOpen(false);
      setForm((v) => ({ ...v, startDate: "", endDate: "", reason: "" }));
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

  const totalRemaining = balances.reduce((sum, b) => sum + b.remainingDays, 0);
  const pending = requests.filter((r) => r.status === "Pending").length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Xin nghỉ phép"
        description="Tạo đơn nghỉ, theo dõi trạng thái và số ngày phép còn lại."
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
              { label: "Phép còn lại", value: `${totalRemaining} ngày`, tone: "brand" },
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
                        {formatDate(item.startDate)} - {formatDate(item.endDate)} · {item.totalDays} ngày
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
                  <div className="compact-row" key={balance.leaveTypeCode}>
                    <div>
                      <strong>{balance.leaveTypeName}</strong>
                      <span>Năm {balance.year}</span>
                    </div>
                    <strong>
                      {balance.remainingDays}/{balance.allocatedDays} ngày
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
                  value={leaveTypes.find((t) => t.leaveTypeCode === form.leaveTypeCode)?.leaveTypeName ?? ""}
                  selectedOptions={[form.leaveTypeCode]}
                  onOptionSelect={(_, data) =>
                    setForm((v) => ({ ...v, leaveTypeCode: data.optionValue ?? "" }))
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
              <div className="form-grid">
                <Field label="Từ ngày" required>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(_, data) => setForm((v) => ({ ...v, startDate: data.value }))}
                  />
                </Field>
                <Field label="Đến ngày" required>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(_, data) => setForm((v) => ({ ...v, endDate: data.value }))}
                  />
                </Field>
              </div>
              <Field label="Lý do">
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

export function EmployeeSalesPage() {
  const notify = useNotify();
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SaleDto | null>(null);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ customerCode: "", amount: "", note: "" });

  const load = () => {
    setLoading(true);
    Promise.all([saleApi.getMine(), customerApi.getAll()])
      .then(([s, c]) => {
        setSales(s);
        setCustomers(c);
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setForm({ customerCode: customers[0]?.customerCode ?? "", amount: "", note: "" });
    setOpen(true);
  };

  const openEdit = (sale: SaleDto) => {
    setEditing(sale);
    setForm({ customerCode: sale.customerCode, amount: String(sale.amount), note: sale.note ?? "" });
    setOpen(true);
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      notify({ ok: false, message: "Giá trị hợp đồng phải lớn hơn 0." });
      return;
    }
    setSending(true);
    try {
      if (editing) {
        await saleApi.update(editing.id, { amount, note: form.note });
        notify({ ok: true, message: "Đã cập nhật sale." });
      } else {
        if (!form.customerCode) {
          notify({ ok: false, message: "Vui lòng chọn khách hàng." });
          setSending(false);
          return;
        }
        await saleApi.submit({ customerCode: form.customerCode, amount, note: form.note });
        notify({ ok: true, message: "Đã tạo sale mới." });
      }
      setOpen(false);
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
        title="Sale & KPI của tôi"
        description="Ghi nhận hợp đồng mới và theo dõi trạng thái duyệt."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={openCreate}>
            Tạo sale
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <SectionPanel title="Lịch sử sale">
          {sales.length ? (
            <div className="request-list">
              {sales.map((sale) => (
                <article key={sale.id}>
                  <div className="request-icon">
                    <PeopleTeamRegular />
                  </div>
                  <div className="request-main">
                    <strong>{sale.customerName}</strong>
                    <span>
                      {formatCurrency(sale.amount)} · {formatDate(sale.orderDate)}
                    </span>
                    {sale.note ? <p>{sale.note}</p> : null}
                  </div>
                  <div className="row-actions">
                    <RequestBadge status={sale.status} />
                    {sale.status === "Pending" ? (
                      <Button size="small" onClick={() => openEdit(sale)}>
                        Sửa
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có sale" description="Tạo sale đầu tiên của bạn." actionLabel="Tạo sale" onAction={openCreate} />
          )}
        </SectionPanel>
      )}

      <SectionPanel title="KPI">
        <div className="info-banner">
          <CalendarCheckmarkRegular />
          <div>
            <strong>Chưa khả dụng</strong>
            <p>Backend hiện chưa có API tính target/KPI theo kỳ. Mục này sẽ hiển thị khi API sẵn sàng.</p>
          </div>
        </div>
      </SectionPanel>

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editing ? "Cập nhật sale" : "Tạo sale mới"}</DialogTitle>
            <DialogContent className="form-stack">
              {!editing ? (
                <Field label="Khách hàng" required>
                  <Dropdown
                    value={customers.find((c) => c.customerCode === form.customerCode)?.customerName ?? ""}
                    selectedOptions={[form.customerCode]}
                    onOptionSelect={(_, data) => setForm((v) => ({ ...v, customerCode: data.optionValue ?? "" }))}
                  >
                    {customers.map((c) => (
                      <Option key={c.customerCode} value={c.customerCode}>
                        {c.customerName}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              ) : null}
              <Field label="Giá trị hợp đồng (VND)" required>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(_, data) => setForm((v) => ({ ...v, amount: data.value }))}
                />
              </Field>
              <Field label="Ghi chú">
                <Textarea
                  resize="vertical"
                  value={form.note}
                  onChange={(_, data) => setForm((v) => ({ ...v, note: data.value }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function EmployeeCustomersPage() {
  const notify = useNotify();
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ customerName: "", phone: "", email: "", address: "" });

  const load = () => {
    setLoading(true);
    customerApi
      .getAll()
      .then(setCustomers)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = customers.filter((c) =>
    c.customerName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const possibleDuplicate =
    search.trim().length > 1 &&
    customers.some((c) => c.customerName.toLowerCase() === search.trim().toLowerCase());

  const submit = async () => {
    if (!form.customerName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập tên khách hàng." });
      return;
    }
    setSending(true);
    try {
      await customerApi.create(form);
      notify({ ok: true, message: "Đã thêm khách hàng." });
      setOpen(false);
      setForm({ customerName: "", phone: "", email: "", address: "" });
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
        title="Khách hàng"
        description="Tìm kiếm khách hàng hiện có hoặc tạo mới, tránh trùng lặp."
        action={
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => {
              setForm({ customerName: search, phone: "", email: "", address: "" });
              setOpen(true);
            }}
          >
            Tạo khách hàng
          </Button>
        }
      />
      <Field label="Tìm kiếm theo tên">
        <Input value={search} onChange={(_, data) => setSearch(data.value)} placeholder="Nhập tên khách hàng..." />
      </Field>
      {possibleDuplicate ? (
        <div className="info-banner">
          <PeopleTeamRegular />
          <div>
            <strong>Có thể đã tồn tại</strong>
            <p>Đã tìm thấy khách hàng trùng tên. Kiểm tra danh sách bên dưới trước khi tạo mới.</p>
          </div>
        </div>
      ) : null}
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : filtered.length ? (
        <div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Mã KH</th>
                <th>Tên khách hàng</th>
                <th>Điện thoại</th>
                <th>Email</th>
                <th>Phụ trách</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.customerCode}>
                  <td>{c.customerCode}</td>
                  <td>{c.customerName}</td>
                  <td>{c.phone ?? "--"}</td>
                  <td>{c.email ?? "--"}</td>
                  <td>{c.assignedEmployeeName ?? "--"}</td>
                  <td>
                    <Badge appearance="tint">{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Không tìm thấy khách hàng" description="Thử tạo khách hàng mới với tên đã tìm." />
      )}

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tạo khách hàng mới</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Tên khách hàng" required>
                <Input
                  value={form.customerName}
                  onChange={(_, data) => setForm((v) => ({ ...v, customerName: data.value }))}
                />
              </Field>
              <div className="form-grid">
                <Field label="Điện thoại">
                  <Input value={form.phone} onChange={(_, data) => setForm((v) => ({ ...v, phone: data.value }))} />
                </Field>
                <Field label="Email">
                  <Input value={form.email} onChange={(_, data) => setForm((v) => ({ ...v, email: data.value }))} />
                </Field>
              </div>
              <Field label="Địa chỉ">
                <Input value={form.address} onChange={(_, data) => setForm((v) => ({ ...v, address: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Tạo mới"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

import {
  Badge,
  Button,
  Combobox,
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
  Tooltip,
  type BadgeProps,
} from "@fluentui/react-components";
import { InfoRegular } from "@fluentui/react-icons";
import { startOfMonth } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { ConfirmDialog, EmptyState, FieldError, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { departmentApi, employeeApi } from "../services/api";
import { errorMessage } from "../services/http";
import { adjustmentProcessingApi, attendanceNoteApi, attendanceViewApi, leaveReturnApi } from "../services/hrApi";
import type {
  AttendanceNoteDto,
  DaySession,
  LeaveReturnRequestDto,
  NoteStatus,
  ProcessLeaveReturnItem,
} from "../types/attendanceHr";
import type { AttendanceAdjustmentDto, AttendanceRecordDto, DepartmentDto, EmployeeDto } from "../types/domain";
import { formatDate, formatDateTime, formatTime, isoDate, leaveSessionLabels } from "../utils/format";

// ---- Nhãn/màu dùng chung cho trạng thái từng buổi (backend đã tính sẵn, client chỉ hiển thị) ----

const sessionStatusLabels: Record<string, string> = {
  OnTime: "Đúng giờ",
  Late: "Đi muộn",
  Absent: "Vắng",
  OnLeave: "Nghỉ phép",
  None: "--",
};

const sessionStatusColors: Record<string, BadgeProps["color"]> = {
  OnTime: "success",
  Late: "warning",
  Absent: "danger",
  OnLeave: "subtle",
};

const sourceLabels: Record<string, string> = {
  Note: "Ghi chú của nhân sự",
  ReturnConfirmed: "Xác nhận đi làm lại",
};

const noteStatusLabels: Record<string, string> = {
  OnTime: "Đi làm đúng giờ",
  Late: "Đi muộn",
  Absent: "Vắng",
};

function SessionBadge({ status }: { status?: string }) {
  if (!status || status === "None") return <span>--</span>;
  return (
    <Badge appearance="tint" color={sessionStatusColors[status] ?? "subtle"} shape="rounded">
      {sessionStatusLabels[status] ?? status}
    </Badge>
  );
}

// Một buổi + biểu tượng thông tin (kèm nội dung ghi chú) khi buổi đó do HR ghi chú hoặc xác nhận đi làm lại.
function SessionCell({ status, source, note }: { status?: string; source?: string; note?: string }) {
  const sourceLabel = source ? sourceLabels[source] : undefined;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <SessionBadge status={status} />
      {sourceLabel ? (
        <Tooltip content={note ? `${sourceLabel}: ${note}` : sourceLabel} relationship="description">
          <InfoRegular aria-label={sourceLabel} />
        </Tooltip>
      ) : null}
    </span>
  );
}

function monthStartIso() {
  return isoDate(startOfMonth(new Date()));
}

function employeeLabel(e: EmployeeDto) {
  return `${e.fullName} (${e.employeeCode})`;
}

// ---------------------------------------------------------------------------
// 1. Chấm công toàn công ty
// ---------------------------------------------------------------------------

export function HrAttendancePage() {
  const notify = useNotify();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [records, setRecords] = useState<AttendanceRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ startDate: monthStartIso(), endDate: isoDate() });
  const [departmentCode, setDepartmentCode] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    departmentApi
      .getAll()
      .then(setDepartments)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!range.startDate || !range.endDate) return;
    if (range.startDate > range.endDate) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    attendanceViewApi
      .getAll(range.startDate, range.endDate, departmentCode || undefined)
      .then(setRecords)
      .catch((err) => {
        setRecords([]);
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoading(false));
  }, [range.startDate, range.endDate, departmentCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải lại im lặng bảng công (không Spinner).
  useAutoRefresh(
    () =>
      range.startDate && range.endDate && range.startDate <= range.endDate
        ? attendanceViewApi
            .getAll(range.startDate, range.endDate, departmentCode || undefined)
            .then(setRecords)
            .catch(() => undefined)
        : undefined,
    { types: ["AdjustmentManagerApproved", "ReturnApproved", "ReturnSubmitted", "AdjustmentApplied", "AdjustmentRejected", "AttendanceNoteCreated"] },
  );

  const keyword = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      keyword
        ? records.filter(
            (r) => r.employeeName.toLowerCase().includes(keyword) || r.employeeCode.toLowerCase().includes(keyword),
          )
        : records,
    [records, keyword],
  );
  const invalidRange = range.startDate > range.endDate;
  const departmentName = departments.find((d) => d.departmentCode === departmentCode)?.departmentName ?? "Tất cả phòng ban";

  return (
    <div className="page-stack">
      <PageHeader
        title="Chấm công toàn công ty"
        description="Xem chấm công theo buổi sáng/chiều của toàn bộ nhân viên."
      />
      <div className="filter-grid">
        <Field label="Từ ngày">
          <Input
            type="date"
            value={range.startDate}
            onChange={(_, data) => setRange((v) => ({ ...v, startDate: data.value }))}
          />
        </Field>
        <Field label="Đến ngày">
          <Input
            type="date"
            value={range.endDate}
            onChange={(_, data) => setRange((v) => ({ ...v, endDate: data.value }))}
          />
        </Field>
        <Field label="Phòng ban">
          <Dropdown
            value={departmentName}
            selectedOptions={[departmentCode]}
            onOptionSelect={(_, data) => setDepartmentCode(data.optionValue ?? "")}
          >
            <Option value="">Tất cả phòng ban</Option>
            {departments.map((d) => (
              <Option key={d.departmentCode} value={d.departmentCode}>
                {d.departmentName}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Tìm theo tên/mã">
          <Input value={search} onChange={(_, data) => setSearch(data.value)} placeholder="Tên hoặc mã nhân viên" />
        </Field>
      </div>
      {invalidRange ? <FieldError message="Từ ngày phải trước hoặc bằng đến ngày." /> : null}
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : visible.length ? (
        <div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Ngày</th>
                <th>Vào</th>
                <th>Ra</th>
                <th>Giờ làm</th>
                <th>Buổi sáng</th>
                <th>Buổi chiều</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={`${r.employeeCode}-${r.attendanceDate}`}>
                  <td>
                    <strong>{r.employeeName}</strong>
                    <br />
                    <small>{r.employeeCode}</small>
                  </td>
                  <td>{formatDate(r.attendanceDate)}</td>
                  <td>{formatTime(r.checkInTime)}</td>
                  <td>{formatTime(r.checkOutTime)}</td>
                  <td>{r.workingHours ?? "--"}</td>
                  <td>
                    <SessionCell status={r.morningStatus} source={r.morningSource} note={r.morningNote} />
                  </td>
                  <td>
                    <SessionCell status={r.afternoonStatus} source={r.afternoonSource} note={r.afternoonNote} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Không có dữ liệu" description="Chưa có bản ghi chấm công phù hợp bộ lọc." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Ghi nhận chấm công (ghi chú ngoại lệ)
// ---------------------------------------------------------------------------

export function HrAttendanceNotesPage() {
  const notify = useNotify();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [notes, setNotes] = useState<AttendanceNoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: monthStartIso(), to: isoDate() });
  const [filterEmployee, setFilterEmployee] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<AttendanceNoteDto | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [form, setForm] = useState({
    employeeCode: "",
    startDate: isoDate(),
    endDate: isoDate(),
    session: "FullDay" as "Morning" | "Afternoon" | "FullDay",
    status: "OnTime" as NoteStatus,
    note: "",
  });
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const isMultiDay = form.startDate !== form.endDate;

  useEffect(() => {
    employeeApi
      .getAll()
      .then(setEmployees)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotes = useCallback(() => {
    if (!range.from || !range.to || range.from > range.to) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    attendanceNoteApi
      .list(range.from, range.to, filterEmployee || undefined)
      .then(setNotes)
      .catch((err) => {
        setNotes([]);
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to, filterEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(loadNotes, [loadNotes]);

  useAutoRefresh(
    () =>
      range.from && range.to && range.from <= range.to
        ? attendanceNoteApi
            .list(range.from, range.to, filterEmployee || undefined)
            .then(setNotes)
            .catch(() => undefined)
        : undefined,
    { types: ["AdjustmentManagerApproved", "ReturnApproved", "ReturnSubmitted", "AdjustmentApplied", "AdjustmentRejected", "AttendanceNoteCreated"] },
  );

  const selectedEmployee = employees.find((e) => e.employeeCode === form.employeeCode);
  const keyword = employeeQuery.trim().toLowerCase();
  const employeeOptions = keyword
    ? employees.filter((e) => e.fullName.toLowerCase().includes(keyword) || e.employeeCode.toLowerCase().includes(keyword))
    : employees;
  const filterEmployeeObj = employees.find((e) => e.employeeCode === filterEmployee);

  const submit = async () => {
    // Validate phía client trước khi gửi; quy tắc nghiệp vụ còn lại do backend kiểm tra.
    if (!form.employeeCode) return setFormError("Vui lòng chọn nhân viên.");
    if (!form.startDate || !form.endDate) return setFormError("Vui lòng chọn từ ngày và đến ngày.");
    if (form.startDate > form.endDate) return setFormError("Từ ngày phải trước hoặc bằng đến ngày.");
    if (!form.note.trim()) return setFormError("Vui lòng nhập nội dung ghi chú.");
    setFormError("");
    setSending(true);
    try {
      const created = await attendanceNoteApi.create({
        employeeCode: form.employeeCode,
        startDate: form.startDate,
        endDate: form.endDate,
        session: isMultiDay ? "FullDay" : form.session,
        status: form.status,
        note: form.note.trim(),
      });
      notify({ ok: true, message: `Đã ghi nhận ${created.length} buổi.` });
      setForm((v) => ({ ...v, note: "" }));
      loadNotes();
    } catch (err) {
      // Hiển thị nguyên văn message 400 của backend.
      setFormError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await attendanceNoteApi.revoke(revokeTarget.id);
      notify({ ok: true, message: "Đã thu hồi ghi chú." });
      setRevokeTarget(null);
      loadNotes();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Ghi nhận chấm công"
        description="Ghi chú ngoại lệ chấm công (đúng giờ, đi muộn, vắng) cho nhân viên theo buổi."
      />

      <SectionPanel title="Tạo ghi chú">
        <div className="form-stack">
          <Field label="Nhân viên" required>
            <Combobox
              placeholder="Chọn hoặc gõ để tìm nhân viên"
              value={employeeQuery || (selectedEmployee ? employeeLabel(selectedEmployee) : "")}
              selectedOptions={form.employeeCode ? [form.employeeCode] : []}
              onChange={(e) => setEmployeeQuery(e.target.value)}
              onOptionSelect={(_, data) => {
                setForm((v) => ({ ...v, employeeCode: data.optionValue ?? "" }));
                setEmployeeQuery("");
              }}
            >
              {employeeOptions.map((e) => (
                <Option key={e.employeeCode} value={e.employeeCode} text={employeeLabel(e)}>
                  {employeeLabel(e)}
                </Option>
              ))}
            </Combobox>
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
          <Field label="Buổi" required>
            <Dropdown
              value={isMultiDay ? leaveSessionLabels.FullDay : leaveSessionLabels[form.session]}
              selectedOptions={[isMultiDay ? "FullDay" : form.session]}
              disabled={isMultiDay}
              onOptionSelect={(_, data) =>
                setForm((v) => ({ ...v, session: (data.optionValue as typeof form.session) ?? "FullDay" }))
              }
            >
              <Option value="Morning">{leaveSessionLabels.Morning}</Option>
              <Option value="Afternoon">{leaveSessionLabels.Afternoon}</Option>
              <Option value="FullDay">{leaveSessionLabels.FullDay}</Option>
            </Dropdown>
            {isMultiDay ? <FieldError message="Ghi nhận nhiều ngày chỉ có thể chọn Cả ngày." /> : null}
          </Field>
          <Field label="Trạng thái" required>
            <Dropdown
              value={noteStatusLabels[form.status]}
              selectedOptions={[form.status]}
              onOptionSelect={(_, data) => setForm((v) => ({ ...v, status: (data.optionValue as NoteStatus) ?? "OnTime" }))}
            >
              <Option value="OnTime">{noteStatusLabels.OnTime}</Option>
              <Option value="Late">{noteStatusLabels.Late}</Option>
              <Option value="Absent">{noteStatusLabels.Absent}</Option>
            </Dropdown>
          </Field>
          <Field label="Nội dung ghi chú" required>
            <Textarea
              resize="vertical"
              value={form.note}
              onChange={(_, data) => setForm((v) => ({ ...v, note: data.value }))}
            />
          </Field>
          <FieldError message={formError} />
          <div>
            <Button appearance="primary" onClick={submit} disabled={sending}>
              {sending ? <Spinner size="tiny" /> : "Ghi nhận"}
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Ghi chú đang hiệu lực">
        <div className="filter-grid">
          <Field label="Từ ngày">
            <Input type="date" value={range.from} onChange={(_, data) => setRange((v) => ({ ...v, from: data.value }))} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" value={range.to} onChange={(_, data) => setRange((v) => ({ ...v, to: data.value }))} />
          </Field>
          <Field label="Nhân viên">
            <Dropdown
              value={filterEmployeeObj ? employeeLabel(filterEmployeeObj) : "Tất cả nhân viên"}
              selectedOptions={[filterEmployee]}
              onOptionSelect={(_, data) => setFilterEmployee(data.optionValue ?? "")}
            >
              <Option value="">Tất cả nhân viên</Option>
              {employees.map((e) => (
                <Option key={e.employeeCode} value={e.employeeCode} text={employeeLabel(e)}>
                  {employeeLabel(e)}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
        {loading ? (
          <Spinner label="Đang tải..." />
        ) : notes.length ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Ngày</th>
                  <th>Buổi</th>
                  <th>Trạng thái</th>
                  <th>Nội dung</th>
                  <th>Người ghi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.employeeName}</strong>
                      <br />
                      <small>{n.employeeCode}</small>
                    </td>
                    <td>{formatDate(n.date)}</td>
                    <td>{leaveSessionLabels[n.session]}</td>
                    <td>
                      <SessionBadge status={n.status} />
                    </td>
                    <td>{n.note}</td>
                    <td>
                      {n.createdByName}
                      <br />
                      <small>{formatDateTime(n.createdAt)}</small>
                    </td>
                    <td>
                      <Button size="small" onClick={() => setRevokeTarget(n)}>
                        Thu hồi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Chưa có ghi chú" description="Không có ghi chú nào đang hiệu lực trong khoảng đã chọn." />
        )}
      </SectionPanel>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Thu hồi ghi chú"
        description={
          revokeTarget
            ? `Thu hồi ghi chú ${leaveSessionLabels[revokeTarget.session]} ngày ${formatDate(revokeTarget.date)} của ${revokeTarget.employeeName}?`
            : ""
        }
        confirmLabel="Thu hồi"
        confirming={revoking}
        onConfirm={revoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hộp thoại nhập lý do từ chối (dùng chung cho điều chỉnh công và đi làm lại)
// ---------------------------------------------------------------------------

function HrRejectDialog({
  open,
  title,
  sending,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  sending: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // Mỗi lần mở lại thì xoá lý do cũ.
  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);

  const submit = () => {
    if (!reason.trim()) return setError("Vui lòng nhập lý do từ chối.");
    onSubmit(reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className="form-stack">
            <Field label="Lý do từ chối" required>
              <Textarea resize="vertical" value={reason} onChange={(_, data) => setReason(data.value)} />
            </Field>
            <FieldError message={error} />
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} disabled={sending}>
              Huỷ
            </Button>
            <Button appearance="primary" onClick={submit} disabled={sending}>
              {sending ? <Spinner size="tiny" /> : "Từ chối"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Xử lý điều chỉnh công
// ---------------------------------------------------------------------------

export function HrAdjustmentsPage() {
  const notify = useNotify();
  const [items, setItems] = useState<AttendanceAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyTarget, setApplyTarget] = useState<AttendanceAdjustmentDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AttendanceAdjustmentDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adjustmentProcessingApi
      .getPending()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  useAutoRefresh(() => adjustmentProcessingApi.getPending().then(setItems).catch(() => undefined), { types: ["AdjustmentManagerApproved", "ReturnApproved", "ReturnSubmitted", "AdjustmentApplied", "AdjustmentRejected", "AttendanceNoteCreated"] });

  const apply = async () => {
    if (!applyTarget) return;
    setBusy(true);
    try {
      await adjustmentProcessingApi.apply(applyTarget.id);
      notify({ ok: true, message: "Đã áp dụng điều chỉnh công." });
      setApplyTarget(null);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      await adjustmentProcessingApi.reject(rejectTarget.id, reason);
      notify({ ok: true, message: "Đã từ chối yêu cầu." });
      setRejectTarget(null);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Xử lý điều chỉnh công"
        description="Các yêu cầu điều chỉnh công đã được quản lý duyệt, chờ áp dụng."
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : items.length ? (
        <div className="review-list">
          {items.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>{item.employeeName}</strong> <span>{formatDate(item.attendanceDate)}</span>
                <p>{item.reason}</p>
                <small>
                  Giờ vào: {formatTime(item.oldCheckInTime)} → {formatTime(item.newCheckInTime)} · Giờ ra:{" "}
                  {formatTime(item.oldCheckOutTime)} → {formatTime(item.newCheckOutTime)}
                </small>
                <br />
                <small>
                  quản lý duyệt: {item.approverName ?? "--"}
                  {item.approvedAt ? ` (${formatDateTime(item.approvedAt)})` : ""}
                </small>
              </div>
              <div className="table-actions">
                <Button appearance="primary" onClick={() => setApplyTarget(item)}>
                  Áp dụng
                </Button>
                <Button onClick={() => setRejectTarget(item)}>Từ chối</Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Không có yêu cầu" description="Hiện không có yêu cầu điều chỉnh công nào chờ xử lý." />
      )}

      <ConfirmDialog
        open={!!applyTarget}
        title="Áp dụng điều chỉnh công"
        description={
          applyTarget
            ? `Áp dụng đúng giờ đề xuất (vào ${formatTime(applyTarget.newCheckInTime)}, ra ${formatTime(applyTarget.newCheckOutTime)}) cho ${applyTarget.employeeName} ngày ${formatDate(applyTarget.attendanceDate)}?`
            : ""
        }
        confirmLabel="Áp dụng"
        confirming={busy}
        onConfirm={apply}
        onCancel={() => setApplyTarget(null)}
      />
      <HrRejectDialog
        open={!!rejectTarget}
        title="Từ chối điều chỉnh công"
        sending={busy}
        onSubmit={reject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Xử lý đi làm lại
// ---------------------------------------------------------------------------

const returnStateLabels: Record<string, string> = {
  Pending: "Chờ quản lý",
  AwaitingHr: "Chờ xác nhận",
  Active: "Đã có hiệu lực",
  Rejected: "Từ chối",
};

const sessionKey = (date: string, session: DaySession) => `${date}|${session}`;

export function HrLeaveReturnsPage() {
  const notify = useNotify();
  const [items, setItems] = useState<LeaveReturnRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<LeaveReturnRequestDto | null>(null);
  // Trạng thái chọn cho từng buổi AwaitingHr; mặc định Đúng giờ.
  const [choices, setChoices] = useState<Record<string, "OnTime" | "Late">>({});
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    leaveReturnApi
      .getAwaitingProcessing()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  useAutoRefresh(() => leaveReturnApi.getAwaitingProcessing().then(setItems).catch(() => undefined), { types: ["AdjustmentManagerApproved", "ReturnApproved", "ReturnSubmitted", "AdjustmentApplied", "AdjustmentRejected", "AttendanceNoteCreated"] });

  const openDialog = (item: LeaveReturnRequestDto) => {
    const initial: Record<string, "OnTime" | "Late"> = {};
    for (const s of item.sessions) if (s.state === "AwaitingHr") initial[sessionKey(s.date, s.session)] = "OnTime";
    setChoices(initial);
    setDialogError("");
    setTarget(item);
  };

  const closeDialog = () => {
    setTarget(null);
    setRejecting(false);
  };

  const awaiting = target?.sessions.filter((s) => s.state === "AwaitingHr") ?? [];
  const active = target?.sessions.filter((s) => s.state === "Active") ?? [];

  const confirm = async () => {
    if (!target) return;
    const body: ProcessLeaveReturnItem[] = awaiting.map((s) => ({
      date: s.date,
      session: s.session,
      status: choices[sessionKey(s.date, s.session)] ?? "OnTime",
    }));
    setBusy(true);
    setDialogError("");
    try {
      await leaveReturnApi.process(target.id, { items: body });
      notify({ ok: true, message: "Đã xác nhận nhân viên đi làm." });
      closeDialog();
      load();
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    try {
      await leaveReturnApi.rejectProcessing(target.id, reason);
      notify({ ok: true, message: "Đã từ chối yêu cầu đi làm lại." });
      closeDialog();
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Xử lý đi làm lại"
        description="Xác nhận các buổi nhân viên đã đi làm lại trong thời gian nghỉ phép."
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : items.length ? (
        <div className="review-list">
          {items.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>{item.employeeName}</strong>{" "}
                <span>
                  Từ {formatDate(item.fromDate)} · {leaveSessionLabels[item.fromSession]}
                </span>
                <p>{item.reason}</p>
                <small>
                  quản lý duyệt: {item.managerName ?? "--"}
                  {item.managerApprovedAt ? ` (${formatDateTime(item.managerApprovedAt)})` : ""}
                  {" · "}
                  {item.sessions.filter((s) => s.state === "AwaitingHr").length} buổi chờ xác nhận
                </small>
              </div>
              <div className="table-actions">
                <Button appearance="primary" onClick={() => openDialog(item)}>
                  Xử lý
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Không có yêu cầu" description="Hiện không có yêu cầu đi làm lại nào chờ xác nhận." />
      )}

      <Dialog open={!!target && !rejecting} onOpenChange={(_, data) => !data.open && closeDialog()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Xử lý đi làm lại{target ? ` - ${target.employeeName}` : ""}</DialogTitle>
            <DialogContent className="form-stack">
              {target ? <p>{target.reason}</p> : null}
              <strong>Các buổi chờ xác nhận</strong>
              {awaiting.length ? (
                awaiting.map((s) => {
                  const key = sessionKey(s.date, s.session);
                  const value = choices[key] ?? "OnTime";
                  return (
                    <Field
                      key={key}
                      label={`${formatDate(s.date)} · ${leaveSessionLabels[s.session]} · ${s.leaveTypeName}`}
                    >
                      <Dropdown
                        value={sessionStatusLabels[value]}
                        selectedOptions={[value]}
                        onOptionSelect={(_, data) =>
                          setChoices((v) => ({ ...v, [key]: (data.optionValue as "OnTime" | "Late") ?? "OnTime" }))
                        }
                      >
                        <Option value="OnTime">{sessionStatusLabels.OnTime}</Option>
                        <Option value="Late">{sessionStatusLabels.Late}</Option>
                      </Dropdown>
                    </Field>
                  );
                })
              ) : (
                <small>Không có buổi nào chờ xác nhận.</small>
              )}
              {active.length ? (
                <>
                  <strong>Đã có hiệu lực (chỉ tham khảo)</strong>
                  <ul>
                    {active.map((s) => (
                      <li key={sessionKey(s.date, s.session)}>
                        {formatDate(s.date)} · {leaveSessionLabels[s.session]} · {s.leaveTypeName} ·{" "}
                        {returnStateLabels[s.state]}
                        {s.workedStatus ? ` (${sessionStatusLabels[s.workedStatus]})` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <FieldError message={dialogError} />
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDialog} disabled={busy}>
                Đóng
              </Button>
              <Button onClick={() => setRejecting(true)} disabled={busy}>
                Từ chối
              </Button>
              <Button appearance="primary" onClick={confirm} disabled={busy || !awaiting.length}>
                {busy ? <Spinner size="tiny" /> : "Xác nhận đã đi làm"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <HrRejectDialog
        open={!!target && rejecting}
        title="Từ chối yêu cầu đi làm lại"
        sending={busy}
        onSubmit={reject}
        onCancel={() => setRejecting(false)}
      />
    </div>
  );
}

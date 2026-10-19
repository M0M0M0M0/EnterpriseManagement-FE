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
import { ArrowDownloadRegular, InfoRegular } from "@fluentui/react-icons";
import { startOfMonth } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCan } from "../hooks/useCan";
import { ConfirmDialog, EmptyState, FieldError, PageHeader, SectionPanel } from "../components/ui";
import { ReasonDialog, RetryError } from "../components/ReviewParts";
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
import { formatDate, formatDateTime, formatTime, isoDate, leaveSessionLabels, sessionNames } from "../utils/format";
import { PagedItems } from "../components/PagedItems";

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
  ReturnConfirmed: "Xác nhận rút ngắn phép",
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
      {note ? (
        <small className="hr-session-note" title={note}>
          {note}
        </small>
      ) : null}
    </span>
  );
}

// Xuất CSV bảng công toàn công ty đang lọc (có BOM cho Excel), cột khớp bản mobile.
function downloadCompanyAttendanceCsv(records: AttendanceRecordDto[], startDate: string, endDate: string) {
  const header = ["Mã NV", "Nhân viên", "Ngày", "Giờ vào", "Giờ ra", "Buổi sáng", "Buổi chiều", "Ghi chú sáng", "Ghi chú chiều"];
  const rows = records.map((r) => [
    r.employeeCode,
    r.employeeName,
    r.attendanceDate.slice(0, 10),
    r.checkInTime ? formatTime(r.checkInTime) : "",
    r.checkOutTime ? formatTime(r.checkOutTime) : "",
    sessionStatusLabels[r.morningStatus ?? "None"] ?? "--",
    sessionStatusLabels[r.afternoonStatus ?? "None"] ?? "--",
    r.morningNote ?? "",
    r.afternoonNote ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cham-cong-cong-ty_${startDate}_${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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
    setLoadError("");
    attendanceViewApi
      .getAll(range.startDate, range.endDate, departmentCode || undefined)
      .then(setRecords)
      .catch((err) => {
        setRecords([]);
        setLoadError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [range.startDate, range.endDate, departmentCode, reloadKey]);

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
          <Input value={search} onChange={(_, data) => setSearch(data.value)} placeholder="Tìm tên hoặc mã NV" />
        </Field>
        <Button
          icon={<ArrowDownloadRegular />}
          disabled={!visible.length}
          onClick={() => downloadCompanyAttendanceCsv(visible, range.startDate, range.endDate)}
        >
          Xuất CSV
        </Button>
      </div>
      {invalidRange ? <FieldError message="Từ ngày phải trước hoặc bằng đến ngày." /> : null}
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : loadError ? (
        <RetryError message={loadError} onRetry={() => setReloadKey((v) => v + 1)} />
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
                    {r.leaveTypeName ? (
                      <>
                        <br />
                        <small>Nghỉ phép: {r.leaveTypeName}</small>
                      </>
                    ) : null}
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
        <EmptyState title="Không có dữ liệu" description="Không có bản ghi chấm công trong khoảng này." />
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
  const [listError, setListError] = useState("");

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
    // Người đã nghỉ việc (Terminated) không còn để ghi nhận chấm công.
    employeeApi
      .getAll()
      .then((list) => setEmployees(list.filter((e) => e.employmentStatus.toLowerCase() !== "terminated")))
      .catch((err) => notify({ ok: false, message: errorMessage(err) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotes = useCallback(() => {
    if (!range.from || !range.to || range.from > range.to) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError("");
    attendanceNoteApi
      .list(range.from, range.to, filterEmployee || undefined)
      .then(setNotes)
      .catch((err) => {
        setNotes([]);
        setListError(errorMessage(err));
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
    if (form.endDate > isoDate()) return setFormError("Chỉ ghi nhận được đến hết ngày hôm nay.");
    if (!form.note.trim()) return setFormError("Vui lòng nhập ghi chú.");
    setFormError("");
    setSending(true);
    try {
      await attendanceNoteApi.create({
        employeeCode: form.employeeCode,
        startDate: form.startDate,
        endDate: form.endDate,
        session: isMultiDay ? "FullDay" : form.session,
        status: form.status,
        note: form.note.trim(),
      });
      notify({ ok: true, message: "Đã ghi nhận chấm công." });
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
                max={isoDate()}
                value={form.startDate}
                onChange={(_, data) => setForm((v) => ({ ...v, startDate: data.value }))}
              />
            </Field>
            <Field label="Đến ngày" required>
              <Input
                type="date"
                max={isoDate()}
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
          <Field label="Ghi chú (bắt buộc)" required>
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
        ) : listError ? (
          <RetryError message={listError} onRetry={loadNotes} />
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
                    <td>{sessionNames[n.session]}</td>
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
          <EmptyState title="Chưa có ghi chú" description="Chưa có ghi chú nào trong khoảng này." />
        )}
      </SectionPanel>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Thu hồi ghi chú"
        description={
          revokeTarget
            ? `Thu hồi ghi chú ${sessionNames[revokeTarget.session]} ngày ${formatDate(revokeTarget.date)} của ${revokeTarget.employeeName}?`
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
// 3. Xử lý điều chỉnh công
// ---------------------------------------------------------------------------

export function HrAdjustmentsPage() {
  const notify = useNotify();
  const canApply = useCan()("attendance.adjustment.apply");
  const [items, setItems] = useState<AttendanceAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [applyTarget, setApplyTarget] = useState<AttendanceAdjustmentDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AttendanceAdjustmentDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    adjustmentProcessingApi
      .getPending()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        setLoadError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useAutoRefresh(() => adjustmentProcessingApi.getPending().then(setItems).catch(() => undefined), { types: ["AdjustmentManagerApproved", "ReturnApproved", "ReturnSubmitted", "AdjustmentApplied", "AdjustmentRejected", "AttendanceNoteCreated"] });

  const apply = async () => {
    if (!applyTarget) return;
    setBusy(true);
    try {
      await adjustmentProcessingApi.apply(applyTarget.id);
      notify({ ok: true, message: "Đã áp dụng điều chỉnh." });
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
      await adjustmentProcessingApi.reject(rejectTarget.id, reason || undefined);
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
      {loading && !items.length ? (
        <Spinner label="Đang tải..." />
      ) : loadError && !items.length ? (
        <RetryError message={loadError} onRetry={load} />
      ) : items.length ? (
        <PagedItems items={items} resetKey={items.length}>
{(shown) => (
<div className="review-list">
          {shown.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>
                  {item.employeeName} ({item.employeeCode})
                </strong>{" "}
                <span>{formatDate(item.attendanceDate)}</span>
                {item.newCheckInTime ? (
                  <small>
                    Giờ vào: {formatTime(item.oldCheckInTime)} → {formatTime(item.newCheckInTime)}
                  </small>
                ) : null}
                {item.newCheckOutTime ? (
                  <small>
                    Giờ ra: {formatTime(item.oldCheckOutTime)} → {formatTime(item.newCheckOutTime)}
                  </small>
                ) : null}
                <p>Lý do: {item.reason}</p>
                {item.approverName ? (
                  <small>
                    Quản lý duyệt: {item.approverName}
                    {item.approvedAt ? ` · ${formatDateTime(item.approvedAt)}` : ""}
                  </small>
                ) : null}
              </div>
              {canApply ? (
                <div className="table-actions">
                  <Button appearance="primary" disabled={busy} onClick={() => setApplyTarget(item)}>
                    Áp dụng
                  </Button>
                  <Button disabled={busy} onClick={() => setRejectTarget(item)}>
                    Từ chối
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
)}
</PagedItems>
      ) : (
        <EmptyState title="Không có yêu cầu" description="Không có yêu cầu nào chờ xử lý." />
      )}

      <ConfirmDialog
        open={!!applyTarget}
        title="Áp dụng điều chỉnh"
        description={
          applyTarget
            ? `Áp dụng đúng giờ đề xuất cho ${applyTarget.employeeName} ngày ${formatDate(applyTarget.attendanceDate)}?`
            : ""
        }
        confirmLabel="Áp dụng"
        confirming={busy}
        onConfirm={apply}
        onCancel={() => setApplyTarget(null)}
      />
      <ReasonDialog
        open={!!rejectTarget}
        title={rejectTarget ? `Từ chối yêu cầu của ${rejectTarget.employeeName}` : "Từ chối yêu cầu"}
        label="Lý do"
        confirmLabel="Từ chối"
        busy={busy}
        onSubmit={reject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Xác nhận rút ngắn phép
// ---------------------------------------------------------------------------

const sessionKey = (date: string, session: DaySession) => `${date}|${session}`;

export function HrLeaveReturnsPage() {
  const notify = useNotify();
  const canProcess = useCan()("attendance.note.manage");
  const [items, setItems] = useState<LeaveReturnRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<LeaveReturnRequestDto | null>(null);
  // Trạng thái chọn cho từng buổi AwaitingHr; mặc định Đúng giờ.
  const [choices, setChoices] = useState<Record<string, "OnTime" | "Late">>({});
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    leaveReturnApi
      .getAwaitingProcessing()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        setLoadError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

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
    setConfirming(false);
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
      notify({ ok: true, message: "Đã xác nhận rút ngắn nghỉ phép." });
      closeDialog();
      load();
    } catch (err) {
      setDialogError(errorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    try {
      await leaveReturnApi.rejectProcessing(target.id, reason || undefined);
      notify({ ok: true, message: "Đã từ chối yêu cầu." });
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
        title="Xác nhận rút ngắn phép"
        description="Xác nhận các buổi nhân viên đã đi làm lại trong thời gian nghỉ phép."
      />
      {loading && !items.length ? (
        <Spinner label="Đang tải..." />
      ) : loadError && !items.length ? (
        <RetryError message={loadError} onRetry={load} />
      ) : items.length ? (
        <PagedItems items={items} resetKey={items.length}>
{(shown) => (
<div className="review-list">
          {shown.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>
                  {item.employeeName} ({item.employeeCode})
                </strong>{" "}
                <Badge appearance="tint" shape="rounded" color="informative">
                  Chờ xác nhận
                </Badge>
                <span>
                  Đi làm lại từ {sessionNames[item.fromSession].toLowerCase()} {formatDate(item.fromDate)}
                </span>
                <small>{item.sessions.filter((s) => s.state === "AwaitingHr").length} buổi chờ xác nhận</small>
                <p>{item.reason}</p>
              </div>
              <div className="table-actions">
                <Button appearance="primary" onClick={() => openDialog(item)}>
                  Xử lý
                </Button>
              </div>
            </article>
          ))}
        </div>
)}
</PagedItems>
      ) : (
        <EmptyState title="Không có yêu cầu" description="Không có yêu cầu rút ngắn nghỉ phép nào chờ xác nhận." />
      )}

      <Dialog open={!!target && !rejecting} onOpenChange={(_, data) => !data.open && closeDialog()}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Xác nhận rút ngắn phép{target ? ` - ${target.employeeName} (${target.employeeCode})` : ""}</DialogTitle>
            <DialogContent className="form-stack">
              {target ? (
                <>
                  <p>
                    Đi làm lại từ {sessionNames[target.fromSession].toLowerCase()} {formatDate(target.fromDate)}
                  </p>
                  <p>Lý do: {target.reason}</p>
                  {target.managerName ? (
                    <small>
                      Quản lý duyệt: {target.managerName}
                      {target.managerApprovedAt ? ` · ${formatDateTime(target.managerApprovedAt)}` : ""}
                    </small>
                  ) : null}
                </>
              ) : null}
              <strong>Các buổi chờ xác nhận</strong>
              {awaiting.length ? (
                awaiting.map((s) => {
                  const key = sessionKey(s.date, s.session);
                  const value = choices[key] ?? "OnTime";
                  return (
                    <Field
                      key={key}
                      label={`${formatDate(s.date)} · ${sessionNames[s.session]} · ${s.leaveTypeName}`}
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
                  <strong>Các buổi đã có hiệu lực</strong>
                  <ul>
                    {active.map((s) => (
                      <li key={sessionKey(s.date, s.session)}>
                        {formatDate(s.date)} · {sessionNames[s.session]} · {s.leaveTypeName}
                        {s.workedStatus ? ` · ${sessionStatusLabels[s.workedStatus]}` : ""}
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
              {canProcess ? (
                <>
                  <Button onClick={() => setRejecting(true)} disabled={busy}>
                    Từ chối
                  </Button>
                  <Button appearance="primary" onClick={() => setConfirming(true)} disabled={busy || !awaiting.length}>
                    {busy ? <Spinner size="tiny" /> : "Xác nhận đã đi làm"}
                  </Button>
                </>
              ) : null}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={!!target && confirming}
        title="Xác nhận đã đi làm"
        description={`Xác nhận ${target?.employeeName ?? ""} đã đi làm lại các buổi chờ xác nhận?`}
        confirmLabel="Xác nhận"
        confirming={busy}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
      <ReasonDialog
        open={!!target && rejecting}
        title={target ? `Từ chối yêu cầu của ${target.employeeName}` : "Từ chối yêu cầu"}
        label="Lý do"
        confirmLabel="Từ chối"
        busy={busy}
        onSubmit={reject}
        onCancel={() => setRejecting(false)}
      />
    </div>
  );
}

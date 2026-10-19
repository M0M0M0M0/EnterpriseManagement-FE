import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Spinner,
  Tab,
  TabList,
  type BadgeProps,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular, ArrowDownloadRegular, ChevronDownRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCan } from "../hooks/useCan";
import {
  AdjustmentBadge,
  AttendanceStatusCell,
  ConfirmDialog,
  EmptyState,
  FieldError,
  MetricRail,
  PageHeader,
  RequestBadge,
  SectionPanel,
} from "../components/ui";
import { FilterSelect, ReasonDialog, RetryError } from "../components/ReviewParts";
import { MyTodayStrip } from "../components/MyTodayStrip";
import { useNotify } from "../components/useNotify";
import {
  attendanceApi,
  dashboardApi,
  departmentApi,
  employeeApi,
  leaveRequestApi,
  positionApi,
} from "../services/api";
import { leaveReturnApi } from "../services/hrApi";
import { leaveCancelApi } from "../services/leaveCancelApi";
import { overtimeApi } from "../services/overtimeApi";
import { useSearchParams } from "react-router-dom";
import { LeaveCancelApprovalPanel } from "./LeaveCancelPages";
import { OvertimeApprovalPanel } from "./OvertimePages";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
import type { LeaveReturnRequestDto } from "../types/attendanceHr";
import type {
  AttendanceAdjustmentDto,
  AttendanceRecordDto,
  DepartmentDto,
  EmployeeDto,
  LeaveRequestDto,
  ManagerDashboardDto,
  OrgTreeNodeDto,
  PositionDto,
} from "../types/domain";
import {
  attendanceLabels,
  employmentStatusLabel,
  formatDate,
  formatDateTime,
  formatLeaveTime,
  formatTime,
  genderLabel,
  isoDate,
  leaveSessionLabels,
  requestLabels,
  sessionNames,
} from "../utils/format";
import { PagedItems } from "../components/PagedItems";

function useManagerCode() {
  return useAuthStore((state) => state.session?.employeeCode);
}

// Loại sự kiện làm tải lại im lặng (khớp NotificationTypes.manager của mobile).
const MANAGER_EVENTS = [
  "LeaveCancelSubmitted",
  "OvertimeSubmitted",
  "LeaveSubmitted",
  "ReturnSubmitted",
  "AdjustmentSubmitted",
  "LeaveApproved",
  "LeaveRejected",
  "AdjustmentManagerApproved",
  "AdjustmentRejected",
  "AdjustmentApplied",
  "AttendanceChanged",
];

// ---------------------------------------------------------------------------
// Tổng quan quản lý
// ---------------------------------------------------------------------------

export function ManagerDashboardPage() {
  const managerCode = useManagerCode();
  const [data, setData] = useState<ManagerDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!managerCode) return;
    setLoading(true);
    setError("");
    dashboardApi
      .manager(managerCode)
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [managerCode]);

  useEffect(load, [load]);

  useAutoRefresh(
    () => (managerCode ? dashboardApi.manager(managerCode).then(setData).catch(() => undefined) : undefined),
    { types: [...MANAGER_EVENTS, "ReturnApproved", "ReturnRejected"] },
  );

  if (loading && !data) return <Spinner label="Đang tải dashboard..." />;
  if (!data) return <RetryError message={error || "Không có dữ liệu."} onRetry={load} />;

  return (
    <div className="page-stack">
      <PageHeader title="Tổng quan phòng ban" description="Tình hình team và các đơn đang chờ duyệt. Chấm công của bạn ở mục Tổng quan của tôi." />
      {managerCode ? <MyTodayStrip employeeCode={managerCode} /> : null}
      <MetricRail
        items={[
          { label: "Quy mô team", value: data.teamSize, tone: "brand" },
          { label: "Có mặt hôm nay", value: data.teamPresentTodayCount, tone: "success" },
          {
            label: "Vắng hôm nay",
            value: data.teamAbsentTodayCount,
            tone: data.teamAbsentTodayCount > 0 ? "danger" : "success",
          },
          ...(data.teamOnLeaveTodayCount != null
            ? [{ label: "Nghỉ phép hôm nay", value: data.teamOnLeaveTodayCount, tone: "brand" as const }]
            : []),
          {
            label: "Đơn nghỉ chờ duyệt",
            value: data.pendingLeaveRequestsCount,
            tone: data.pendingLeaveRequestsCount > 0 ? "warning" : "success",
          },
          {
            label: "Chỉnh sửa công chờ duyệt",
            value: data.pendingAttendanceAdjustmentsCount,
            tone: data.pendingAttendanceAdjustmentsCount > 0 ? "warning" : "success",
          },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nhân viên của tôi
// ---------------------------------------------------------------------------

export function ManagerEmployeesPage() {
  const managerCode = useManagerCode();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<EmployeeDto | null>(null);

  const load = useCallback(() => {
    if (!managerCode) return;
    setLoading(true);
    setError("");
    employeeApi
      .getTeamRecursive(managerCode)
      .then(setEmployees)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [managerCode]);

  useEffect(load, [load]);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.departmentName))).sort((a, b) => a.localeCompare(b)),
    [employees],
  );
  const statuses = useMemo(
    () => Array.from(new Set(employees.map((e) => e.employmentStatus))).sort((a, b) => a.localeCompare(b)),
    [employees],
  );

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return employees.filter((e) => {
      if (department && e.departmentName !== department) return false;
      if (status && e.employmentStatus !== status) return false;
      if (!k) return true;
      return (
        e.fullName.toLowerCase().includes(k) ||
        e.employeeCode.toLowerCase().includes(k) ||
        (e.email ?? "").toLowerCase().includes(k) ||
        e.positionName.toLowerCase().includes(k)
      );
    });
  }, [employees, keyword, department, status]);

  const detailRows: [string, string][] = detail
    ? [
        ["Mã NV", detail.employeeCode],
        ["Chức vụ", detail.positionName],
        ["Phòng ban", detail.departmentName],
        ["Quản lý trực tiếp", detail.managerName ?? ""],
        ["Email", detail.email ?? ""],
        ["Điện thoại", detail.phone ?? ""],
        ["Địa chỉ", detail.address ?? ""],
        ["Ngày sinh", detail.dateOfBirth ? formatDate(detail.dateOfBirth) : ""],
        ["Giới tính", genderLabel(detail.gender)],
        ["Ngày vào làm", detail.hireDate ? formatDate(detail.hireDate) : ""],
        ["Trạng thái", employmentStatusLabel(detail.employmentStatus)],
      ]
    : [];

  return (
    <div className="page-stack">
      <PageHeader
        title="Nhân viên của tôi"
        description="Toàn bộ nhân viên thuộc quyền quản lý của bạn, kể cả người do nhân viên dưới bạn quản lý (chỉ xem)."
        action={
          <Button icon={<ArrowClockwiseRegular />} onClick={load} disabled={loading}>
            Tải lại
          </Button>
        }
      />
      {loading && !employees.length ? (
        <Spinner label="Đang tải..." />
      ) : error && !employees.length ? (
        <RetryError message={error} onRetry={load} />
      ) : !employees.length ? (
        <EmptyState title="Chưa có nhân viên" description="Team của bạn chưa có nhân viên nào." />
      ) : (
        <>
          <div className="filter-grid">
            <Field label="Tìm kiếm">
              <Input
                value={keyword}
                onChange={(_, data) => setKeyword(data.value)}
                placeholder="Tìm theo tên, mã NV, email, chức vụ"
              />
            </Field>
            <FilterSelect
              label="Phòng ban"
              value={department}
              options={departments.map((d) => ({ value: d, label: d }))}
              onChange={setDepartment}
            />
            <FilterSelect
              label="Trạng thái"
              value={status}
              options={statuses.map((s) => ({ value: s, label: employmentStatusLabel(s) }))}
              onChange={setStatus}
            />
          </div>
          {filtered.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã NV</th>
                    <th>Họ tên</th>
                    <th>Chức vụ</th>
                    <th>Phòng ban</th>
                    <th>Quản lý trực tiếp</th>
                    <th>Email</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.employeeCode}
                      className="mgr-clickable-row"
                      tabIndex={0}
                      onClick={() => setDetail(e)}
                      onKeyDown={(ev) => ev.key === "Enter" && setDetail(e)}
                    >
                      <td>{e.employeeCode}</td>
                      <td>{e.fullName}</td>
                      <td>{e.positionName}</td>
                      <td>{e.departmentName}</td>
                      <td>{e.managerName ?? "--"}</td>
                      <td>{e.email ?? "--"}</td>
                      <td>
                        <Badge appearance="tint" color={e.employmentStatus === "Active" ? "success" : "subtle"}>
                          {e.employmentStatus === "Active" ? "Đang làm" : employmentStatusLabel(e.employmentStatus)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Không có kết quả" description="Không có nhân viên phù hợp." />
          )}
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(_, data) => !data.open && setDetail(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{detail?.fullName}</DialogTitle>
            <DialogContent>
              <dl className="mgr-detail-list">
                {detailRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "--"}</dd>
                  </div>
                ))}
              </dl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetail(null)}>Đóng</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quản lý chấm công
// ---------------------------------------------------------------------------

// Xuất CSV thuần client-side từ bảng công đang lọc — phục vụ tính lương sau này,
// không cần thêm endpoint/thư viện Excel ở backend vì Excel mở CSV UTF-8 (có BOM) bình thường.
function downloadAttendanceCsv(records: AttendanceRecordDto[], startDate: string, endDate: string) {
  const header = ["Mã NV", "Nhân viên", "Ngày", "Giờ vào", "Giờ ra", "Giờ làm", "Trạng thái"];
  const rows = records.map((r) => [
    r.employeeCode,
    r.employeeName,
    r.attendanceDate.slice(0, 10),
    r.checkInTime ? formatDateTime(r.checkInTime) : "",
    r.checkOutTime ? formatDateTime(r.checkOutTime) : "",
    r.workingHours != null ? String(r.workingHours) : "",
    attendanceLabels[r.status] ?? r.status,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bang-cong_${startDate}_${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ManagerAttendancePage() {
  const managerCode = useManagerCode();
  const notify = useNotify();
  const can = useCan();
  const canTeam = can("attendance.view.team");
  const canPending = can("attendance.adjustment.view");
  const canApprove = can("attendance.adjustment.approve");

  const [tab, setTab] = useState(canTeam ? "team" : "requests");
  // Mặc định chỉ xem hôm nay; muốn xem khoảng khác thì đổi ngày.
  const [range, setRange] = useState({ startDate: isoDate(), endDate: isoDate() });
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [records, setRecords] = useState<AttendanceRecordDto[]>([]);
  const [members, setMembers] = useState<EmployeeDto[]>([]);
  const membersLoaded = useRef(false);
  const [pending, setPending] = useState<AttendanceAdjustmentDto[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [pendingError, setPendingError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ item: AttendanceAdjustmentDto; approve: boolean } | null>(null);

  const invalidRange = range.startDate > range.endDate;

  const fetchTeam = useCallback(async () => {
    if (!managerCode || !range.startDate || !range.endDate || range.startDate > range.endDate) return;
    // Danh sách là cấp dưới mà người này quản lý (đệ quy), không phải mọi người cùng phòng ban.
    if (!membersLoaded.current) {
      try {
        setMembers(await employeeApi.getTeamRecursive(managerCode));
        membersLoaded.current = true;
      } catch {
        // Không tải được danh sách thì ô chọn tạm dùng người có trong bảng công.
      }
    }
    setRecords(await attendanceApi.getByTeam(managerCode, range.startDate, range.endDate));
  }, [managerCode, range.startDate, range.endDate]);

  const loadTeam = useCallback(() => {
    if (invalidRange) {
      setRecords([]);
      return;
    }
    setLoadingTeam(true);
    setTeamError("");
    fetchTeam()
      .catch((err) => setTeamError(errorMessage(err)))
      .finally(() => setLoadingTeam(false));
  }, [fetchTeam, invalidRange]);

  const loadPending = useCallback(() => {
    setLoadingPending(true);
    setPendingError("");
    attendanceApi
      .getPendingAdjustments()
      .then(setPending)
      .catch((err) => setPendingError(errorMessage(err)))
      .finally(() => setLoadingPending(false));
  }, []);

  // Chỉ tải phần mà tài khoản có quyền xem.
  useEffect(() => {
    if (canTeam) loadTeam();
  }, [canTeam, loadTeam]);
  useEffect(() => {
    if (canPending) loadPending();
  }, [canPending, loadPending]);

  // Tải lại im lặng cả hai phần.
  useAutoRefresh(
    () =>
      Promise.all([
        canTeam ? fetchTeam().catch(() => undefined) : undefined,
        canPending ? attendanceApi.getPendingAdjustments().then(setPending).catch(() => undefined) : undefined,
      ]),
    { types: MANAGER_EVENTS },
  );

  // Ô chọn nhân viên: mọi cấp dưới còn làm việc, kể cả người chưa có dòng chấm công trong khoảng ngày.
  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of members) {
      if (e.employmentStatus === "Resigned" || e.employmentStatus === "Terminated") continue;
      map.set(e.employeeCode, e.fullName);
    }
    // Chỉ khi không tải được danh sách cấp dưới mới tạm lấy người có trong bảng công.
    if (!members.length) for (const r of records) if (!map.has(r.employeeCode)) map.set(r.employeeCode, r.employeeName);
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [members, records]);

  // Nhân viên đang lọc không còn trong danh sách thì bỏ lọc.
  useEffect(() => {
    if (employeeFilter && !employeeOptions.some((o) => o.value === employeeFilter)) setEmployeeFilter("");
  }, [employeeOptions, employeeFilter]);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (employeeFilter && r.employeeCode !== employeeFilter) return false;
        if (statusFilter && r.status !== statusFilter) return false;
        return true;
      }),
    [records, employeeFilter, statusFilter],
  );

  const review = async () => {
    if (!reviewTarget) return;
    const { item, approve } = reviewTarget;
    setBusyId(item.id);
    try {
      if (approve) await attendanceApi.approveAdjustment(item.id);
      else await attendanceApi.rejectAdjustment(item.id);
      notify({ ok: true, message: approve ? "Đã xác nhận, chuyển HR xử lý." : "Đã từ chối yêu cầu." });
      setReviewTarget(null);
      loadPending();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
      setReviewTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <PageHeader
      title="Quản lý chấm công"
      description="Xem chấm công của nhân viên bạn quản lý (mặc định hôm nay) và xác nhận yêu cầu chỉnh sửa. Quản lý xác nhận nhân viên có mặt, bộ phận nhân sự sẽ là người áp dụng chỉnh sửa vào dữ liệu."
      action={
        canTeam || canPending ? (
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
            {canTeam ? <Tab value="team">Chấm công team</Tab> : null}
            {canPending ? (
              <Tab value="requests">
                {pending.length > 0 ? `Yêu cầu chỉnh sửa (${pending.length})` : "Yêu cầu chỉnh sửa"}
              </Tab>
            ) : null}
          </TabList>
        ) : null
      }
    />
  );

  if (!canTeam && !canPending) {
    return (
      <div className="page-stack">
        {header}
        <EmptyState title="Không có quyền" description="Bạn không có quyền xem chấm công của team." />
      </div>
    );
  }

  const activeTab = tab === "team" && !canTeam ? "requests" : tab === "requests" && !canPending ? "team" : tab;

  return (
    <div className="page-stack">
      {header}
      {activeTab === "team" ? (
        <>
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
            <FilterSelect label="Nhân viên" value={employeeFilter} options={employeeOptions} onChange={setEmployeeFilter} />
            <FilterSelect
              label="Trạng thái"
              value={statusFilter}
              options={Object.entries(attendanceLabels).map(([value, label]) => ({ value, label }))}
              onChange={setStatusFilter}
            />
            <Button
              icon={<ArrowDownloadRegular />}
              disabled={!filtered.length}
              onClick={() => downloadAttendanceCsv(filtered, range.startDate, range.endDate)}
            >
              Xuất bảng công
            </Button>
          </div>
          {invalidRange ? <FieldError message="Từ ngày phải trước hoặc bằng đến ngày." /> : null}
          {loadingTeam && !records.length ? (
            <Spinner label="Đang tải..." />
          ) : teamError && !records.length ? (
            <RetryError message={teamError} onRetry={loadTeam} />
          ) : filtered.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Ngày</th>
                    <th>Vào</th>
                    <th>Ra</th>
                    <th>Giờ làm</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.employeeCode}-${r.attendanceDate}`}>
                      <td>{r.employeeName}</td>
                      <td>{formatDate(r.attendanceDate)}</td>
                      <td>{formatDateTime(r.checkInTime)}</td>
                      <td>{formatDateTime(r.checkOutTime)}</td>
                      <td>{r.workingHours ?? "--"}</td>
                      <td>
                        <AttendanceStatusCell record={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Không có dữ liệu" description="Chưa có bản ghi chấm công trong khoảng thời gian này." />
          )}
        </>
      ) : loadingPending && !pending.length ? (
        <Spinner label="Đang tải..." />
      ) : pendingError && !pending.length ? (
        <RetryError message={pendingError} onRetry={loadPending} />
      ) : pending.length ? (
        <PagedItems items={pending} resetKey={pending.length}>
{(shown) => (
<div className="review-list">
          {shown.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>{item.employeeName}</strong>
                <span>{formatDate(item.attendanceDate)}</span>
                <p>{item.reason}</p>
                <small>
                  Đề xuất: {formatDateTime(item.newCheckInTime)} - {formatDateTime(item.newCheckOutTime)}
                </small>
                <div>
                  <AdjustmentBadge status={item.status} />
                </div>
              </div>
              {canApprove ? (
                <div className="review-actions">
                  <Button
                    appearance="primary"
                    disabled={busyId === item.id}
                    onClick={() => setReviewTarget({ item, approve: true })}
                  >
                    Xác nhận
                  </Button>
                  <Button disabled={busyId === item.id} onClick={() => setReviewTarget({ item, approve: false })}>
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
        <EmptyState title="Không có yêu cầu chờ duyệt" description="Mọi yêu cầu chỉnh sửa chấm công đã được xử lý." />
      )}

      <ConfirmDialog
        open={!!reviewTarget}
        title={reviewTarget?.approve ? "Xác nhận yêu cầu" : "Từ chối yêu cầu"}
        description={
          reviewTarget ? (
            reviewTarget.approve ? (
              <>
                <p>
                  Xác nhận {reviewTarget.item.employeeName} có mặt ngày {formatDate(reviewTarget.item.attendanceDate)}?
                </p>
                <p>Bước này chỉ xác nhận nhân viên có mặt; HR sẽ áp dụng vào dữ liệu chấm công.</p>
              </>
            ) : (
              <p>
                Từ chối yêu cầu chỉnh sửa công ngày {formatDate(reviewTarget.item.attendanceDate)} của{" "}
                {reviewTarget.item.employeeName}?
              </p>
            )
          ) : null
        }
        confirmLabel={reviewTarget?.approve ? "Xác nhận" : "Từ chối"}
        confirming={busyId !== null}
        onConfirm={review}
        onCancel={() => setReviewTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duyệt đơn xin nghỉ
// ---------------------------------------------------------------------------

const leaveStatusFilters: { value: string; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "Pending", label: requestLabels.Pending },
  { value: "Approved", label: requestLabels.Approved },
  { value: "Rejected", label: requestLabels.Rejected },
  { value: "Cancelled", label: requestLabels.Cancelled },
];

// Nhãn trạng thái từng buổi của yêu cầu rút ngắn nghỉ phép (khớp returnSessionStateLabels của mobile).
const returnSessionLabels: Record<string, string> = {
  Pending: "Chờ quản lý duyệt",
  AwaitingHr: "Chờ xác nhận",
  Active: "Đã có hiệu lực",
  Rejected: "Từ chối",
};

const returnSessionColors: Record<string, BadgeProps["color"]> = {
  Pending: "warning",
  AwaitingHr: "informative",
  Active: "success",
  Rejected: "danger",
};

const returnRequestLabels: Record<string, string> = {
  PendingManager: "Chờ quản lý duyệt",
  PendingHr: "Chờ xác nhận",
  Completed: "Hoàn tất",
  Rejected: "Từ chối",
};

const returnRequestColors: Record<string, BadgeProps["color"]> = {
  PendingManager: "warning",
  PendingHr: "informative",
  Completed: "success",
  Rejected: "danger",
};

// Một ngày thì "dd/MM/yyyy", nhiều ngày thì "dd/MM/yyyy - dd/MM/yyyy".
function leaveDateLabel(r: LeaveRequestDto) {
  const start = formatDate(r.startDate);
  const end = formatDate(r.endDate);
  return start === end ? start : `${start} - ${end}`;
}

// Đơn chọn buổi thì hiện tên buổi, nghỉ ngắn (không có buổi) thì hiện giờ bắt đầu - kết thúc.
function leaveTimeLabel(r: LeaveRequestDto) {
  return r.session ? leaveSessionLabels[r.session] : `${formatTime(r.startDate)} - ${formatTime(r.endDate)}`;
}

export function ManagerLeavePage() {
  const notify = useNotify();
  const can = useCan();
  const canView = can("leave.request.view");
  const canApprove = can("leave.request.approve");
  const canOvertimeView = can("overtime.request.view");
  const [pending, setPending] = useState<LeaveRequestDto[]>([]);
  const [history, setHistory] = useState<LeaveRequestDto[]>([]);
  // ?tab=returns|cancels|overtime|history: thông báo mở thẳng tab có yêu cầu mới.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const wanted = searchParams.get("tab");
    return wanted && ["pending", "history", "returns", "cancels", "overtime"].includes(wanted) ? wanted : "pending";
  });
  // Đang ở trang này mà bấm thông báo khác tab thì chuyển tab theo.
  useEffect(() => {
    const wanted = searchParams.get("tab");
    if (wanted && ["pending", "history", "returns", "cancels", "overtime"].includes(wanted)) setTab(wanted);
  }, [searchParams]);
  const [cancelCount, setCancelCount] = useState(0);
  const [overtimeCount, setOvertimeCount] = useState(0);
  const [query, setQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [approveDialog, setApproveDialog] = useState<LeaveRequestDto | null>(null);
  const [rejectDialog, setRejectDialog] = useState<LeaveRequestDto | null>(null);
  const [detail, setDetail] = useState<LeaveRequestDto | null>(null);
  // Yêu cầu rút ngắn nghỉ phép của người mình quản lý
  const [returns, setReturns] = useState<LeaveReturnRequestDto[]>([]);
  const [returnsError, setReturnsError] = useState("");
  const [approveReturn, setApproveReturn] = useState<LeaveReturnRequestDto | null>(null);
  const [rejectReturn, setRejectReturn] = useState<LeaveReturnRequestDto | null>(null);

  // Id lớn hơn = đơn tạo sau, xếp đơn mới nhất lên đầu.
  const fetchAll = useCallback(
    () =>
      Promise.all([
        leaveRequestApi.getPending(),
        leaveRequestApi.getHistory(),
        leaveReturnApi.getPending().then(
          (rt) => ({ rt, err: "" }),
          (err) => ({ rt: [] as LeaveReturnRequestDto[], err: errorMessage(err) }),
        ),
        // Số yêu cầu chờ ở các tab khác: lỗi (vd thiếu quyền) thì coi như 0, không làm hỏng cả trang.
        leaveCancelApi.getPending().then((c) => c.length, () => 0),
        overtimeApi.getPending().then((o) => o.length, () => 0),
      ]).then(([p, h, r, cx, ot]) => {
        setCancelCount(cx);
        setOvertimeCount(ot);
        setPending([...p].sort((a, b) => b.id - a.id));
        setHistory([...h].sort((a, b) => b.id - a.id));
        setReturns([...r.rt].sort((a, b) => b.id - a.id));
        setReturnsError(r.err);
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

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  // Tải lại im lặng; dialog từ chối/duyệt đang mở giữ nguyên nội dung.
  useAutoRefresh(() => (canView ? fetchAll().catch(() => undefined) : undefined), {
    types: [...MANAGER_EVENTS, "ReturnApproved", "ReturnRejected", "LeaveCancelApproved", "LeaveCancelRejected", "OvertimeApproved", "OvertimeRejected"],
  });

  const approve = async () => {
    if (!approveDialog) return;
    setBusyId(approveDialog.id);
    try {
      await leaveRequestApi.approve(approveDialog.id);
      notify({ ok: true, message: "Đã duyệt đơn nghỉ phép." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
      setApproveDialog(null);
      load(); // thất bại cũng tải lại để bỏ đơn đã bị xử lý ở nơi khác
    }
  };

  const reject = async (reason: string) => {
    if (!rejectDialog) return;
    setBusyId(rejectDialog.id);
    try {
      await leaveRequestApi.reject(rejectDialog.id, reason || undefined);
      notify({ ok: true, message: "Đã từ chối đơn nghỉ phép." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
      setRejectDialog(null);
      load();
    }
  };

  const doApproveReturn = async () => {
    if (!approveReturn) return;
    setBusyId(approveReturn.id);
    try {
      await leaveReturnApi.approve(approveReturn.id);
      notify({ ok: true, message: "Đã duyệt yêu cầu rút ngắn nghỉ phép." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
      setApproveReturn(null);
      load();
    }
  };

  const doRejectReturn = async (reason: string) => {
    if (!rejectReturn) return;
    setBusyId(rejectReturn.id);
    try {
      await leaveReturnApi.reject(rejectReturn.id, reason || undefined);
      notify({ ok: true, message: "Đã từ chối yêu cầu." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
      setRejectReturn(null);
      load();
    }
  };

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const source = tab === "pending" ? pending : history;
    return source.filter((r) => {
      if (tab === "history" && historyStatus && r.status !== historyStatus) return false;
      if (!q) return true;
      return r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q);
    });
  }, [tab, pending, history, historyStatus, q]);

  // Xem danh sách đơn cần leave.request.view (backend chặn 403 nếu thiếu).
  if (!canView) {
    return (
      <div className="page-stack">
        <PageHeader title="Duyệt đơn từ" description="Xem và xử lý đơn nghỉ phép, rút ngắn phép, hủy phép và làm thêm giờ của nhân viên." />
        <EmptyState title="Không có quyền" description="Bạn không có quyền xem đơn nghỉ phép của nhân viên." />
      </div>
    );
  }

  const detailRows: [string, string | undefined][] = detail
    ? [
        ["Nhân viên", detail.employeeCode ? `${detail.employeeName} (${detail.employeeCode})` : detail.employeeName],
        ["Loại nghỉ", detail.leaveTypeName],
        ["Ngày nghỉ", leaveDateLabel(detail)],
        ["Thời gian", leaveTimeLabel(detail)],
        ["Tổng thời gian", formatLeaveTime(detail.totalTime, detail.unit)],
        ["Lý do", detail.reason],
        ["Người duyệt", detail.approverName],
        ["Xử lý lúc", detail.approvedAt ? formatDateTime(detail.approvedAt) : undefined],
        ["Lý do từ chối", detail.rejectionReason],
      ]
    : [];

  return (
    <div className="page-stack">
      <PageHeader
        title="Duyệt đơn từ"
        description="Xem và xử lý đơn nghỉ phép, rút ngắn phép, hủy phép và làm thêm giờ của nhân viên."
        action={
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
            <Tab value="pending">Chờ duyệt ({pending.length})</Tab>
            <Tab value="history">Lịch sử</Tab>
            <Tab value="returns">Yêu cầu rút ngắn nghỉ phép ({returns.length})</Tab>
            <Tab value="cancels">Hủy phép{cancelCount ? ` (${cancelCount})` : ""}</Tab>
            <Tab value="overtime">Làm thêm giờ{overtimeCount ? ` (${overtimeCount})` : ""}</Tab>
          </TabList>
        }
      />
      {tab !== "returns" && tab !== "overtime" && tab !== "cancels" ? (
        <div className="filter-grid">
          <Field label="Tìm kiếm">
            <Input
              value={query}
              onChange={(_, data) => setQuery(data.value)}
              placeholder="Tìm theo tên / mã nhân viên"
            />
          </Field>
          {tab === "history" ? (
            <FilterSelect
              label="Trạng thái"
              value={historyStatus}
              options={leaveStatusFilters.filter((o) => o.value)}
              onChange={setHistoryStatus}
            />
          ) : null}
        </div>
      ) : null}
      {tab === "cancels" ? (
        <LeaveCancelApprovalPanel />
      ) : tab === "overtime" ? (
        canOvertimeView ? (
          <OvertimeApprovalPanel />
        ) : (
          <EmptyState title="Không có quyền" description="Bạn không có quyền xem đơn làm thêm giờ của nhân viên." />
        )
      ) : loading && !pending.length && !history.length ? (
        <Spinner label="Đang tải..." />
      ) : error && !pending.length && !history.length ? (
        <RetryError message={error} onRetry={load} />
      ) : tab === "returns" ? (
        returnsError && !returns.length ? (
          <RetryError message={returnsError} onRetry={load} />
        ) : returns.length ? (
          <PagedItems items={returns} resetKey={returns.length}>
{(shown) => (
<div className="review-list">
            {shown.map((item) => (
              <article key={item.id} className="review-content">
                <div>
                  <strong>{item.employeeName}</strong>
                  <span>
                    Đi làm lại từ: {formatDate(item.fromDate)} ({sessionNames[item.fromSession]})
                  </span>
                  <p>Lý do: {item.reason}</p>
                  <div className="mgr-chips">
                    {item.sessions.map((s) => (
                      <span key={`${s.date}-${s.session}`} className="mgr-chip-line">
                        <small>
                          {formatDate(s.date)} · {sessionNames[s.session]} · đơn #{s.leaveRequestId}
                          {s.workedStatus ? ` · ${s.workedStatus === "Late" ? "đi muộn" : "đúng giờ"}` : ""}
                        </small>
                        <Badge
                          appearance="tint"
                          shape="rounded"
                          size="small"
                          color={returnSessionColors[s.state] ?? "subtle"}
                        >
                          {returnSessionLabels[s.state] ?? s.state}
                        </Badge>
                      </span>
                    ))}
                  </div>
                  {item.status === "Rejected" && item.rejectionReason ? (
                    <small>Lý do từ chối: {item.rejectionReason}</small>
                  ) : null}
                  {item.managerName ? <small>Quản lý: {item.managerName}</small> : null}
                  {item.processedByName ? <small>Người xác nhận: {item.processedByName}</small> : null}
                  <div>
                    <Badge
                      appearance="tint"
                      shape="rounded"
                      color={returnRequestColors[item.status] ?? "subtle"}
                    >
                      {returnRequestLabels[item.status] ?? item.status}
                    </Badge>
                  </div>
                </div>
                {canApprove ? (
                  <div className="review-actions">
                    <Button appearance="primary" disabled={busyId === item.id} onClick={() => setApproveReturn(item)}>
                      Duyệt
                    </Button>
                    <Button disabled={busyId === item.id} onClick={() => setRejectReturn(item)}>
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
          <EmptyState title="Không có yêu cầu rút ngắn nghỉ phép" description="Không có yêu cầu rút ngắn nghỉ phép chờ duyệt." />
        )
      ) : list.length ? (
        <PagedItems items={list} resetKey={list.length}>
{(shown) => (
<div className="review-list">
          {shown.map((item) => (
            <article
              key={item.id}
              className="review-content mgr-clickable"
              tabIndex={0}
              onClick={() => setDetail(item)}
              onKeyDown={(ev) => ev.key === "Enter" && setDetail(item)}
            >
              <div>
                <strong>{item.employeeName}</strong>
                <span>Loại nghỉ: {item.leaveTypeName}</span>
                <span>Ngày nghỉ: {leaveDateLabel(item)}</span>
                <span>
                  Thời gian: {leaveTimeLabel(item)} · {formatLeaveTime(item.totalTime, item.unit)}
                </span>
                <p>Lý do: {item.reason ?? ""}</p>
                {item.status === "Rejected" && item.rejectionReason ? (
                  <small>Lý do từ chối: {item.rejectionReason}</small>
                ) : null}
                <div>
                  <RequestBadge status={item.status} />
                </div>
              </div>
              {tab === "pending" && canApprove ? (
                // Duyệt/Từ chối cần leave.request.approve (cả 2 endpoint dùng cùng mã).
                <div className="review-actions" onClick={(ev) => ev.stopPropagation()}>
                  <Button appearance="primary" disabled={busyId === item.id} onClick={() => setApproveDialog(item)}>
                    Duyệt
                  </Button>
                  <Button disabled={busyId === item.id} onClick={() => setRejectDialog(item)}>
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
        <EmptyState
          title={tab === "pending" ? "Không có đơn chờ duyệt" : "Chưa có lịch sử"}
          description={
            (tab === "pending" ? pending : history).length
              ? "Không có đơn phù hợp bộ lọc."
              : "Danh sách sẽ cập nhật khi có đơn mới."
          }
        />
      )}

      <ConfirmDialog
        open={!!approveDialog}
        title="Duyệt đơn nghỉ phép"
        description={
          approveDialog ? (
            <p>
              Duyệt đơn nghỉ của {approveDialog.employeeName} ({leaveDateLabel(approveDialog)})?
            </p>
          ) : null
        }
        confirmLabel="Duyệt"
        confirming={busyId === approveDialog?.id}
        onConfirm={approve}
        onCancel={() => setApproveDialog(null)}
      />

      <ConfirmDialog
        open={!!approveReturn}
        title="Duyệt yêu cầu rút ngắn nghỉ phép"
        description={
          <>
            <p>Duyệt yêu cầu của {approveReturn?.employeeName}?</p>
            <p>
              Buổi chưa tới giờ bắt đầu sẽ có hiệu lực ngay (phần ngày phép được hoàn lại). Buổi đã bắt đầu sẽ chuyển
              sang HR xác nhận.
            </p>
          </>
        }
        confirmLabel="Duyệt"
        confirming={busyId === approveReturn?.id}
        onConfirm={doApproveReturn}
        onCancel={() => setApproveReturn(null)}
      />

      <ReasonDialog
        open={!!rejectReturn}
        title="Từ chối yêu cầu rút ngắn nghỉ phép"
        subtitle={rejectReturn ? `Yêu cầu của ${rejectReturn.employeeName}` : undefined}
        busy={busyId === rejectReturn?.id}
        onSubmit={doRejectReturn}
        onCancel={() => setRejectReturn(null)}
      />

      <ReasonDialog
        open={!!rejectDialog}
        title="Từ chối đơn nghỉ phép"
        subtitle={rejectDialog ? `Đơn của ${rejectDialog.employeeName}` : undefined}
        label="Lý do từ chối (không bắt buộc)"
        busy={busyId === rejectDialog?.id}
        onSubmit={reject}
        onCancel={() => setRejectDialog(null)}
      />

      <Dialog open={!!detail} onOpenChange={(_, data) => !data.open && setDetail(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Chi tiết đơn nghỉ</DialogTitle>
            <DialogContent>
              {detail ? (
                <div style={{ marginBottom: 8 }}>
                  <RequestBadge status={detail.status} />
                </div>
              ) : null}
              <dl className="mgr-detail-list">
                {detailRows
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetail(null)}>Đóng</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phòng ban & chức vụ
// ---------------------------------------------------------------------------

export function ManagerOrganizationPage() {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([departmentApi.getAll(), positionApi.getAll()])
      .then(([d, p]) => {
        setDepartments(d);
        setPositions(p);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <Spinner label="Đang tải..." />;
  if (error && !departments.length && !positions.length) return <RetryError message={error} onRetry={load} />;

  return (
    <div className="page-stack">
      <PageHeader
        title="Phòng ban & chức vụ"
        description="Xem cơ cấu tổ chức hiện tại (chỉ xem)."
        action={
          <Button icon={<ArrowClockwiseRegular />} onClick={load}>
            Tải lại
          </Button>
        }
      />
      <div className="two-column-grid">
        <SectionPanel title={`Phòng ban (${departments.length})`}>
          <div className="compact-list">
            {departments.length ? (
              departments.map((d) => (
                <div className="compact-row" key={d.departmentCode}>
                  <div>
                    <strong>{d.departmentName}</strong>
                    <span>{d.managerName ?? "Chưa có quản lý"}</span>
                  </div>
                  <Badge appearance="tint" color={d.isActive ? "success" : "subtle"}>
                    {d.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState title="Chưa có dữ liệu" description="Chưa có phòng ban nào." />
            )}
          </div>
        </SectionPanel>
        <SectionPanel title={`Chức vụ (${positions.length})`}>
          <div className="compact-list">
            {positions.length ? (
              positions.map((p) => (
                <div className="compact-row" key={p.positionCode}>
                  <div>
                    <strong>{p.positionName}</strong>
                    <span>{p.description ?? "--"}</span>
                  </div>
                  <Badge appearance="tint" color={p.isActive ? "success" : "subtle"}>
                    {p.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState title="Chưa có dữ liệu" description="Chưa có chức vụ nào." />
            )}
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cây tổ chức
// ---------------------------------------------------------------------------

function OrgTreeNodeRow({ node, depth }: { node: OrgTreeNodeDto; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.subordinates.length > 0;
  const toggle = () => hasChildren && setExpanded((v) => !v);

  return (
    <div className="org-tree-branch">
      {/* Bấm cả dòng để thu/mở khi có cấp dưới (giống mobile). */}
      <div
        className={`compact-row org-tree-row${hasChildren ? " mgr-clickable" : ""}`}
        style={{ paddingLeft: depth * 24 }}
        onClick={toggle}
      >
        <div className="org-tree-row-main">
          {hasChildren ? (
            <Button
              appearance="subtle"
              size="small"
              icon={expanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
              onClick={(ev) => {
                ev.stopPropagation();
                toggle();
              }}
              aria-label={expanded ? "Thu gọn" : "Mở rộng"}
            />
          ) : (
            <span className="org-tree-leaf-spacer" />
          )}
          <div>
            <strong>{node.fullName}</strong>
            <span>
              {node.positionName} · {node.departmentName}
              {hasChildren ? ` · Quản lý ${node.subordinateCount} người` : ""}
            </span>
          </div>
        </div>
        <div className="org-tree-row-meta">
          <Badge appearance="tint" color={attendanceBadgeColor(node.todayAttendanceStatus)}>
            {attendanceLabels[node.todayAttendanceStatus] ?? "Chưa chấm công"}
          </Badge>
        </div>
      </div>
      {hasChildren && expanded ? (
        <div>
          {node.subordinates.map((child) => (
            <OrgTreeNodeRow key={child.employeeCode} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function attendanceBadgeColor(status: string): "success" | "warning" | "danger" | "informative" | "subtle" {
  switch (status) {
    case "Present":
      return "success";
    case "Late":
    case "HalfDay":
      return "warning";
    case "Absent":
    case "HalfDayAbsent":
      return "danger";
    case "OnLeave":
      return "informative";
    default:
      return "subtle";
  }
}

export function ManagerOrgTreePage() {
  const [tree, setTree] = useState<OrgTreeNodeDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    employeeApi
      .getOrgTree()
      .then(setTree)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <Spinner label="Đang tải cây tổ chức..." />;
  if (error && !tree) return <RetryError message={error} onRetry={load} />;

  return (
    <div className="page-stack">
      <PageHeader
        title="Cây tổ chức"
        description="Xem các team bên dưới bạn, ai quản lý từng team, thành viên và chấm công hôm nay."
        action={
          <Button icon={<ArrowClockwiseRegular />} onClick={load}>
            Tải lại
          </Button>
        }
      />
      <SectionPanel>
        {!tree || tree.length === 0 ? (
          <EmptyState title="Chưa có ai bên dưới bạn" description="Bạn hiện chưa quản lý trực tiếp nhân viên nào." />
        ) : (
          <div className="compact-list org-tree">
            {tree.map((node) => (
              <OrgTreeNodeRow key={node.employeeCode} node={node} depth={0} />
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

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
  Textarea,
} from "@fluentui/react-components";
import { ArrowDownloadRegular, ChevronDownRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import {
  EmptyState,
  MetricRail,
  PageHeader,
  RequestBadge,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import {
  attendanceApi,
  dashboardApi,
  departmentApi,
  employeeApi,
  leaveRequestApi,
  positionApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
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
  formatDate,
  formatDateTime,
  formatLeaveTime,
  formatTime,
  isoDate,
  leaveSessionLabels,
} from "../utils/format";

function useManagerCode() {
  return useAuthStore((state) => state.session?.employeeCode);
}

export function ManagerDashboardPage() {
  const managerCode = useManagerCode();
  const notify = useNotify();
  const [data, setData] = useState<ManagerDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!managerCode) return;
    setLoading(true);
    dashboardApi
      .manager(managerCode)
      .then(setData)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, [managerCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) return <Spinner label="Đang tải dashboard..." />;

  return (
    <div className="page-stack">
      <PageHeader title="Tổng quan quản lý" description="Tình hình team và các đơn đang chờ duyệt." />
      <MetricRail
        items={[
          { label: "Quy mô team", value: data.teamSize, tone: "brand" },
          {
            label: "Đơn nghỉ chờ duyệt",
            value: data.pendingLeaveRequestsCount,
            tone: data.pendingLeaveRequestsCount ? "warning" : "success",
          },
          {
            label: "Chỉnh sửa chấm công chờ duyệt",
            value: data.pendingAttendanceAdjustmentsCount,
            tone: data.pendingAttendanceAdjustmentsCount ? "warning" : "success",
          },
          { label: "Có mặt hôm nay", value: data.teamPresentTodayCount, tone: "success" },
          {
            label: "Vắng hôm nay",
            value: data.teamAbsentTodayCount,
            tone: data.teamAbsentTodayCount ? "danger" : "success",
          },
        ]}
      />
    </div>
  );
}

export function ManagerEmployeesPage() {
  const managerCode = useManagerCode();
  const notify = useNotify();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!managerCode) return;
    setLoading(true);
    employeeApi
      .getTeamRecursive(managerCode)
      .then(setEmployees)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, [managerCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-stack">
      <PageHeader
        title="Nhân viên của tôi"
        description="Toàn bộ nhân viên thuộc quyền quản lý của bạn, kể cả người do nhân viên dưới bạn quản lý (chỉ xem)."
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : employees.length ? (
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
              {employees.map((e) => (
                <tr key={e.employeeCode}>
                  <td>{e.employeeCode}</td>
                  <td>{e.fullName}</td>
                  <td>{e.positionName}</td>
                  <td>{e.departmentName}</td>
                  <td>{e.managerName ?? "--"}</td>
                  <td>{e.email ?? "--"}</td>
                  <td>
                    <Badge appearance="tint" color={e.employmentStatus === "Active" ? "success" : "subtle"}>
                      {e.employmentStatus}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có nhân viên" description="Team của bạn chưa có nhân viên nào." />
      )}
    </div>
  );
}

// Xuất CSV thuần client-side từ dữ liệu chấm công team đã tải sẵn — phục vụ tính lương sau này,
// không cần thêm endpoint/thư viện Excel ở backend vì Excel mở CSV UTF-8 (có BOM) bình thường.
function downloadAttendanceCsv(records: AttendanceRecordDto[], startDate: string, endDate: string) {
  const header = ["Mã NV", "Nhân viên", "Ngày", "Giờ vào", "Giờ ra", "Giờ làm", "Trạng thái"];
  const rows = records.map((r) => [
    r.employeeCode,
    r.employeeName,
    r.attendanceDate,
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
  const [tab, setTab] = useState("team");
  const [department, setDepartment] = useState("");
  const [range, setRange] = useState({
    startDate: isoDate(new Date(new Date().setDate(1))),
    endDate: isoDate(),
  });
  const [records, setRecords] = useState<AttendanceRecordDto[]>([]);
  const [pending, setPending] = useState<AttendanceAdjustmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!managerCode) return;
    employeeApi.getByCode(managerCode).then((e) => setDepartment(e.departmentCode)).catch(() => undefined);
  }, [managerCode]);

  const loadTeam = () => {
    if (!department) return;
    setLoading(true);
    attendanceApi
      .getByDepartment(department, range.startDate, range.endDate)
      .then(setRecords)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  const loadPending = () => {
    setLoading(true);
    attendanceApi
      .getPendingAdjustments()
      .then(setPending)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === "team") loadTeam();
    else loadPending();
  }, [tab, department, range.startDate, range.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      if (action === "approve") await attendanceApi.approveAdjustment(id);
      else await attendanceApi.rejectAdjustment(id);
      notify({ ok: true, message: action === "approve" ? "Đã duyệt yêu cầu." : "Đã từ chối yêu cầu." });
      loadPending();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý chấm công"
        description="Xem chấm công theo phòng ban và duyệt yêu cầu chỉnh sửa."
        action={
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
            <Tab value="team">Chấm công team</Tab>
            <Tab value="requests">Yêu cầu chỉnh sửa</Tab>
          </TabList>
        }
      />
      {tab === "team" ? (
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
            <Button
              icon={<ArrowDownloadRegular />}
              disabled={!records.length}
              onClick={() => downloadAttendanceCsv(records, range.startDate, range.endDate)}
            >
              Xuất bảng công
            </Button>
          </div>
          {loading ? (
            <Spinner label="Đang tải..." />
          ) : records.length ? (
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
                  {records.map((r) => (
                    <tr key={`${r.employeeCode}-${r.attendanceDate}`}>
                      <td>{r.employeeName}</td>
                      <td>{formatDate(r.attendanceDate)}</td>
                      <td>{formatDateTime(r.checkInTime)}</td>
                      <td>{formatDateTime(r.checkOutTime)}</td>
                      <td>{r.workingHours ?? "--"}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Không có dữ liệu" description="Chưa có bản ghi chấm công trong khoảng thời gian này." />
          )}
        </>
      ) : loading ? (
        <Spinner label="Đang tải..." />
      ) : pending.length ? (
        <div className="review-list">
          {pending.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>{item.employeeName}</strong>
                <span>{formatDate(item.attendanceDate)}</span>
                <p>{item.reason}</p>
                <small>
                  Đề xuất: {formatDateTime(item.newCheckInTime) } - {formatDateTime(item.newCheckOutTime)}
                </small>
              </div>
              <div className="review-actions">
                <Button
                  appearance="primary"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, "approve")}
                >
                  Duyệt
                </Button>
                <Button disabled={busyId === item.id} onClick={() => review(item.id, "reject")}>
                  Từ chối
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Không có yêu cầu chờ duyệt" description="Mọi yêu cầu chỉnh sửa chấm công đã được xử lý." />
      )}
    </div>
  );
}

export function ManagerLeavePage() {
  const notify = useNotify();
  const [pending, setPending] = useState<LeaveRequestDto[]>([]);
  const [history, setHistory] = useState<LeaveRequestDto[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<LeaveRequestDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([leaveRequestApi.getPending(), leaveRequestApi.getHistory()])
      .then(([p, h]) => {
        setPending(p);
        setHistory(h);
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (id: number) => {
    setBusyId(id);
    try {
      await leaveRequestApi.approve(id);
      notify({ ok: true, message: "Đã duyệt đơn nghỉ phép." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectDialog) return;
    setBusyId(rejectDialog.id);
    try {
      await leaveRequestApi.reject(rejectDialog.id, rejectReason);
      notify({ ok: true, message: "Đã từ chối đơn nghỉ phép." });
      setRejectDialog(null);
      setRejectReason("");
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === "pending" ? pending : history;

  return (
    <div className="page-stack">
      <PageHeader
        title="Duyệt đơn xin nghỉ"
        description="Xem và xử lý đơn nghỉ phép của nhân viên."
        action={
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
            <Tab value="pending">Chờ duyệt ({pending.length})</Tab>
            <Tab value="history">Lịch sử</Tab>
          </TabList>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : list.length ? (
        <div className="review-list">
          {list.map((item) => (
            <article key={item.id} className="review-content">
              <div>
                <strong>{item.employeeName}</strong>
                <span>
                  {item.leaveTypeName} ·{" "}
                  {item.unit === "Hours"
                    ? `${formatDate(item.startDate)}, ${formatTime(item.startDate)} - ${formatTime(item.endDate)}`
                    : `${formatDate(item.startDate)} - ${formatDate(item.endDate)}${item.session ? ` · ${leaveSessionLabels[item.session]}` : ""}`}
                  {" · "}
                  {formatLeaveTime(item.totalTime, item.unit)}
                </span>
                <p>{item.reason}</p>
              </div>
              {tab === "pending" ? (
                <div className="review-actions">
                  <Button appearance="primary" disabled={busyId === item.id} onClick={() => approve(item.id)}>
                    Duyệt
                  </Button>
                  <Button disabled={busyId === item.id} onClick={() => setRejectDialog(item)}>
                    Từ chối
                  </Button>
                </div>
              ) : (
                <RequestBadge status={item.status} />
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={tab === "pending" ? "Không có đơn chờ duyệt" : "Chưa có lịch sử"}
          description="Danh sách sẽ cập nhật khi có đơn mới."
        />
      )}

      <Dialog open={!!rejectDialog} onOpenChange={(_, data) => !data.open && setRejectDialog(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Từ chối đơn nghỉ phép</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Lý do từ chối">
                <Textarea resize="vertical" value={rejectReason} onChange={(_, data) => setRejectReason(data.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRejectDialog(null)}>Hủy</Button>
              <Button appearance="primary" onClick={reject}>
                Xác nhận từ chối
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}


export function ManagerOrganizationPage() {
  const notify = useNotify();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([departmentApi.getAll(), positionApi.getAll()])
      .then(([d, p]) => {
        setDepartments(d);
        setPositions(p);
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner label="Đang tải..." />;

  return (
    <div className="page-stack">
      <PageHeader title="Phòng ban & chức vụ" description="Xem cơ cấu tổ chức hiện tại (chỉ xem)." />
      <div className="two-column-grid">
        <SectionPanel title="Phòng ban">
          <div className="compact-list">
            {departments.map((d) => (
              <div className="compact-row" key={d.departmentCode}>
                <div>
                  <strong>{d.departmentName}</strong>
                  <span>{d.managerName ?? "Chưa có quản lý"}</span>
                </div>
                <Badge appearance="tint" color={d.isActive ? "success" : "subtle"}>
                  {d.isActive ? "Hoạt động" : "Ngừng"}
                </Badge>
              </div>
            ))}
          </div>
        </SectionPanel>
        <SectionPanel title="Chức vụ">
          <div className="compact-list">
            {positions.map((p) => (
              <div className="compact-row" key={p.positionCode}>
                <div>
                  <strong>{p.positionName}</strong>
                  <span>{p.description ?? "--"}</span>
                </div>
                <Badge appearance="tint" color={p.isActive ? "success" : "subtle"}>
                  {p.isActive ? "Hoạt động" : "Ngừng"}
                </Badge>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

function OrgTreeNodeRow({ node, depth }: { node: OrgTreeNodeDto; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.subordinates.length > 0;

  return (
    <div className="org-tree-branch">
      <div className="compact-row org-tree-row" style={{ paddingLeft: depth * 24 }}>
        <div className="org-tree-row-main">
          {hasChildren ? (
            <Button
              appearance="subtle"
              size="small"
              icon={expanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
              onClick={() => setExpanded((v) => !v)}
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
  const notify = useNotify();
  const [tree, setTree] = useState<OrgTreeNodeDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    employeeApi
      .getOrgTree()
      .then(setTree)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner label="Đang tải cây tổ chức..." />;

  return (
    <div className="page-stack">
      <PageHeader
        title="Cây tổ chức"
        description="Xem các team bên dưới bạn, ai quản lý từng team, thành viên, doanh số tháng này và chấm công hôm nay."
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

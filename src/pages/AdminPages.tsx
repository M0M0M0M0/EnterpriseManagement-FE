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
  Switch,
  Textarea,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowClockwiseRegular,
  CopyRegular,
  EyeOffRegular,
  EyeRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { ConfirmDialog, EmptyState, FieldError, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useCan } from "../hooks/useCan";
import {
  departmentApi,
  employeeApi,
  leaveTypeApi,
  positionApi,
  roleApi,
  userApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import type {
  DepartmentDto,
  EmployeeDto,
  LeaveAccrualPeriod,
  LeaveTypeDto,
  LeaveUnit,
  PositionDto,
  RoleDto,
} from "../types/domain";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";

// Nút tải lại danh sách (tương đương kéo-để-tải bên mobile).
function ReloadButton({ onClick }: { onClick: () => void }) {
  return (
    <Button icon={<ArrowClockwiseRegular />} onClick={onClick}>
      Tải lại
    </Button>
  );
}

const NO_MANAGER = "__none__";
const DEFAULT_ROLE = "__default__";
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  Active: "Đang làm việc",
  Probation: "Thử việc",
  OnLeave: "Đang nghỉ phép",
  Resigned: "Đã nghỉ việc",
  Terminated: "Đã nghỉ việc",
  Inactive: "Đã nghỉ việc",
};

// Người còn làm việc (kể cả thử việc, đang nghỉ phép); chỉ Resigned/Terminated/Inactive mới là đã nghỉ.
const isWorking = (status: string) => !["Resigned", "Terminated", "Inactive"].includes(status);

const GENDER_LABEL: Record<string, string> = { Male: "Nam", Female: "Nữ", Other: "Khác" };

type Credential = { username: string; password: string; isReset: boolean };
type PendingAction =
  | { kind: "resign"; employee: EmployeeDto }
  | { kind: "lock"; employee: EmployeeDto }
  | { kind: "reset"; employee: EmployeeDto };

export function AdminEmployeesPage() {
  const notify = useNotify();
  const can = useCan();
  const canManage = can("employee.manage");
  const canAccount = can("user.manage");
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDto | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [managerQuery, setManagerQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<EmployeeDto | null>(null);
  // Đã tự chọn vai trò thì không đổi theo chức vụ nữa (khi tạo mới).
  const [roleTouched, setRoleTouched] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    roleCode: DEFAULT_ROLE,
    roleCodes: [] as string[],
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "Male",
    departmentCode: "",
    positionCode: "",
    managerCode: "",
    hireDate: formatDate(new Date().toISOString(), "yyyy-MM-dd"),
  });

  const activeRoles = roles.filter((r) => r.isActive);
  const roleName = (code: string) => roles.find((r) => r.roleCode === code)?.roleName ?? code;

  const load = () => {
    setLoading(true);
    // Không có quyền xem vai trò thì danh sách rỗng, vai trò khi tạo mới do backend gán theo chức vụ.
    Promise.all([
      employeeApi.getAll(),
      departmentApi.getAll(),
      positionApi.getAll(),
      roleApi.getAll().catch(() => [] as RoleDto[]),
    ])
      .then(([e, d, p, r]) => {
        setEmployees(e);
        setDepartments(d);
        setPositions(p);
        setRoles(r);
        setForm((v) => ({
          ...v,
          departmentCode: v.departmentCode || d[0]?.departmentCode || "",
          positionCode: v.positionCode || p[0]?.positionCode || "",
        }));
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const managerLabel = (e: EmployeeDto) => `${e.fullName} (${e.employeeCode})`;

  // Vai trò mặc định theo chức vụ nếu backend cho biết; không thì để backend tự chọn.
  const defaultRoleFor = (positionCode: string) => {
    const code = positions.find((p) => p.positionCode === positionCode)?.roleCode;
    return code && activeRoles.some((r) => r.roleCode === code) ? code : DEFAULT_ROLE;
  };

  const openCreate = () => {
    setEditing(null);
    setManagerQuery("");
    setFormError("");
    setRoleTouched(false);
    setForm((v) => ({
      ...v,
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      roleCode: defaultRoleFor(v.positionCode),
      roleCodes: [],
      phone: "",
      address: "",
      dateOfBirth: "",
      gender: "Male",
      managerCode: "",
      hireDate: formatDate(new Date().toISOString(), "yyyy-MM-dd"),
    }));
    setOpen(true);
  };

  const openEdit = (employee: EmployeeDto) => {
    setEditing(employee);
    setFormError("");
    const currentManager = employees.find((e) => e.employeeCode === employee.managerCode);
    setManagerQuery(currentManager ? managerLabel(currentManager) : "");
    setForm((v) => ({
      ...v,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email ?? "",
      roleCodes: employee.roleCodes ?? [],
      phone: employee.phone ?? "",
      address: employee.address ?? "",
      departmentCode: employee.departmentCode,
      positionCode: employee.positionCode,
      managerCode: employee.managerCode ?? "",
    }));
    setOpen(true);
  };

  const selectDepartment = (departmentCode: string) => {
    setForm((v) => {
      const managerStillValid = employees.some(
        (e) => e.employeeCode === v.managerCode && e.departmentCode === departmentCode,
      );
      if (managerStillValid) return { ...v, departmentCode };
      setManagerQuery("");
      return { ...v, departmentCode, managerCode: "" };
    });
  };

  const selectPosition = (positionCode: string) => {
    setForm((v) => ({
      ...v,
      positionCode,
      roleCode: editing || roleTouched ? v.roleCode : defaultRoleFor(positionCode),
    }));
  };

  const handleManagerSelect = (optionValue: string | undefined) => {
    if (!optionValue || optionValue === NO_MANAGER) {
      setForm((v) => ({ ...v, managerCode: "" }));
      setManagerQuery("");
      return;
    }
    const emp = employees.find((e) => e.employeeCode === optionValue);
    setForm((v) => ({ ...v, managerCode: optionValue }));
    setManagerQuery(emp ? managerLabel(emp) : "");
  };

  const showCredential = (username: string, password: string, isReset: boolean) => {
    setShowPassword(false);
    setCredential({ username, password, isReset });
  };

  const validate = (): string => {
    if (!form.departmentCode || !form.positionCode) return "Vui lòng chọn phòng ban và chức vụ.";
    if (!form.firstName.trim() || !form.lastName.trim()) return "Vui lòng nhập đủ họ tên.";
    if (!editing) {
      const username = form.username.trim();
      if (!username) return "Vui lòng nhập tên đăng nhập.";
      if (!USERNAME_PATTERN.test(username)) {
        return "Tên đăng nhập gồm 3-50 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.";
      }
    }
    const email = form.email.trim();
    if (!email) return "Vui lòng nhập email.";
    if (!EMAIL_PATTERN.test(email)) return "Email không đúng định dạng.";
    if (editing && !form.roleCodes.length) return "Vui lòng chọn ít nhất một vai trò.";
    return "";
  };

  const submit = async () => {
    const invalid = validate();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    const email = form.email.trim();
    const username = form.username.trim();
    setFormError("");
    setSending(true);
    try {
      if (editing) {
        await employeeApi.update(editing.employeeCode, {
          firstName: form.firstName,
          lastName: form.lastName,
          email,
          roleCodes: form.roleCodes,
          phone: form.phone || undefined,
          address: form.address || undefined,
          departmentCode: form.departmentCode,
          positionCode: form.positionCode,
          managerCode: form.managerCode || undefined,
        });
        notify({ ok: true, message: "Đã cập nhật hồ sơ nhân viên." });
        setOpen(false);
      } else {
        const result = await employeeApi.create({
          firstName: form.firstName,
          lastName: form.lastName,
          username,
          email,
          roleCode: form.roleCode === DEFAULT_ROLE ? undefined : form.roleCode,
          phone: form.phone || undefined,
          address: form.address || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender,
          departmentCode: form.departmentCode,
          positionCode: form.positionCode,
          managerCode: form.managerCode || undefined,
          hireDate: form.hireDate,
        });
        notify({ ok: true, message: "Đã thêm nhân viên mới." });
        setOpen(false);
        showCredential(result.employee.username || username, result.generatedPassword, false);
      }
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const copyCredential = async () => {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(`Tên đăng nhập: ${credential.username}\nMật khẩu: ${credential.password}`);
      notify({ ok: true, message: "Đã sao chép thông tin đăng nhập." });
    } catch {
      notify({ ok: false, message: "Không thể sao chép tự động, vui lòng copy thủ công." });
    }
  };

  const runPending = async () => {
    if (!pending) return;
    const { kind, employee } = pending;
    setConfirming(true);
    try {
      if (kind === "reset") {
        const result = await userApi.resetPassword(employee.username);
        showCredential(result.username, result.generatedPassword, true);
        notify({ ok: true, message: "Đã đặt lại mật khẩu." });
      } else if (kind === "lock") {
        await userApi.setActive(employee.username, !employee.isAccountActive);
        notify({ ok: true, message: employee.isAccountActive ? "Đã khoá tài khoản." : "Đã mở tài khoản." });
      } else {
        const resigning = isWorking(employee.employmentStatus);
        await employeeApi.setActive(employee.employeeCode, !resigning);
        notify({
          ok: true,
          message: resigning
            ? "Đã cho nghỉ việc và khoá tài khoản."
            : "Đã phục hồi nhân viên và mở tài khoản.",
        });
      }
      setPending(null);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
      setPending(null);
    } finally {
      setConfirming(false);
    }
  };

  // Mở khoá tài khoản không rủi ro nên chạy luôn; khoá/nghỉ việc/đặt lại mật khẩu cần xác nhận.
  const toggleAccount = async (employee: EmployeeDto) => {
    if (employee.isAccountActive) {
      setPending({ kind: "lock", employee });
      return;
    }
    try {
      await userApi.setActive(employee.username, true);
      notify({ ok: true, message: "Đã mở tài khoản." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const pendingText = (() => {
    if (!pending) return { title: "", description: "", label: "" };
    const { kind, employee } = pending;
    if (kind === "reset") {
      return {
        title: "Đặt lại mật khẩu?",
        description: `Tạo mật khẩu tạm mới cho "${employee.username}". Mật khẩu cũ sẽ không dùng được nữa.`,
        label: "Đặt lại",
      };
    }
    if (kind === "lock") {
      return {
        title: "Khoá tài khoản?",
        description: `Tài khoản "${employee.username}" sẽ không thể đăng nhập cho đến khi được mở lại. Trạng thái làm việc không đổi.`,
        label: "Khoá tài khoản",
      };
    }
    return isWorking(employee.employmentStatus)
      ? {
          title: "Cho nhân viên nghỉ việc?",
          description: `Nhân viên "${employee.fullName}" sẽ chuyển sang trạng thái Đã nghỉ việc và tài khoản đăng nhập "${employee.username}" sẽ bị khoá.`,
          label: "Cho nghỉ việc",
        }
      : {
          title: "Phục hồi nhân viên?",
          description: `Nhân viên "${employee.fullName}" sẽ trở lại trạng thái Đang làm việc và tài khoản đăng nhập "${employee.username}" sẽ được mở lại.`,
          label: "Phục hồi",
        };
  })();

  // Ứng viên quản lý: cùng phòng ban đã chọn, còn làm việc, không phải chính mình.
  const departmentManagerCandidates = employees.filter(
    (e) =>
      e.departmentCode === form.departmentCode &&
      isWorking(e.employmentStatus) &&
      e.employeeCode !== editing?.employeeCode,
  );

  // Vẫn giữ quản lý hiện tại của hồ sơ (nếu có) trong danh sách hiển thị, dù người đó
  // khác phòng ban, để mở form Sửa không làm mất lựa chọn đang có sẵn.
  const currentManager = editing?.managerCode
    ? employees.find((e) => e.employeeCode === editing.managerCode)
    : undefined;
  const managerSearch = managerQuery.trim().toLowerCase();
  const visibleCandidates = departmentManagerCandidates;
  const managerCandidates =
    currentManager && !visibleCandidates.some((e) => e.employeeCode === currentManager.employeeCode)
      ? [currentManager, ...visibleCandidates]
      : visibleCandidates;
  const filteredManagerCandidates = managerSearch
    ? managerCandidates.filter(
        (e) => e.fullName.toLowerCase().includes(managerSearch) || e.employeeCode.toLowerCase().includes(managerSearch),
      )
    : managerCandidates;

  // Vai trò đang gán nhưng đã bị khoá vẫn hiện trong ô chọn để không mất khi lưu.
  // Vai trò hiện có của nhân viên nhưng không nằm trong danh sách (thiếu quyền xem) cũng hiện để giữ.
  const editableRoles: RoleDto[] = [
    ...activeRoles,
    ...roles.filter((r) => !r.isActive && form.roleCodes.includes(r.roleCode)),
    ...(editing?.roleCodes ?? [])
      .map((code, i) => ({ code, name: editing?.roleNames?.[i] ?? code }))
      .filter((r) => !roles.some((x) => x.roleCode === r.code))
      .map((r) => ({ roleCode: r.code, roleName: r.name, permissions: [] as string[], isActive: true })),
  ];

  const managerName = (e: EmployeeDto) => {
    if (!e.managerCode) return "";
    return employees.find((m) => m.employeeCode === e.managerCode)?.fullName ?? e.managerName ?? e.managerCode;
  };

  // Trạng thái làm việc đang có trong dữ liệu, dùng cho ô lọc.
  const statuses = Array.from(new Set(employees.map((e) => e.employmentStatus))).sort();
  const keyword = search.trim().toLowerCase();
  const visibleEmployees = employees.filter((e) => {
    if (departmentFilter && e.departmentCode !== departmentFilter) return false;
    if (statusFilter && e.employmentStatus !== statusFilter) return false;
    if (!keyword) return true;
    return (
      e.fullName.toLowerCase().includes(keyword) ||
      e.employeeCode.toLowerCase().includes(keyword) ||
      (e.email ?? "").toLowerCase().includes(keyword) ||
      e.username.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý nhân viên"
        description="Hồ sơ và tài khoản đăng nhập của nhân viên: tạo mới, sửa, đặt lại mật khẩu, khoá/mở tài khoản, cho nghỉ việc."
        action={
          <div className="row-actions">
            <ReloadButton onClick={load} />
            {canManage ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={openCreate}>
                Thêm nhân viên
              </Button>
            ) : null}
          </div>
        }
      />
      <SectionPanel>
        <div className="filter-grid">
          <Field label="Tìm kiếm">
            <Input
              contentBefore={<SearchRegular />}
              placeholder="Tìm theo tên, mã, email, tên đăng nhập"
              value={search}
              onChange={(_, data) => setSearch(data.value)}
            />
          </Field>
          <Field label="Phòng ban">
            <Dropdown
              value={departments.find((d) => d.departmentCode === departmentFilter)?.departmentName ?? "Tất cả"}
              selectedOptions={[departmentFilter]}
              onOptionSelect={(_, data) => setDepartmentFilter(data.optionValue ?? "")}
            >
              <Option value="" text="Tất cả">
                Tất cả
              </Option>
              {departments.map((d) => (
                <Option key={d.departmentCode} value={d.departmentCode} text={d.departmentName}>
                  {d.departmentName}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Trạng thái">
            <Dropdown
              value={statusFilter ? (EMPLOYMENT_STATUS_LABEL[statusFilter] ?? statusFilter) : "Tất cả"}
              selectedOptions={[statusFilter]}
              onOptionSelect={(_, data) => setStatusFilter(data.optionValue ?? "")}
            >
              <Option value="" text="Tất cả">
                Tất cả
              </Option>
              {statuses.map((st) => (
                <Option key={st} value={st} text={EMPLOYMENT_STATUS_LABEL[st] ?? st}>
                  {EMPLOYMENT_STATUS_LABEL[st] ?? st}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
      </SectionPanel>
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : visibleEmployees.length ? (
        <div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ tên</th>
                <th>Tên đăng nhập</th>
                <th>Vai trò</th>
                <th>Phòng ban</th>
                <th>Chức vụ</th>
                <th>Quản lý</th>
                <th>Trạng thái làm việc</th>
                <th>Tài khoản</th>
                <th>Đăng nhập cuối</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map((e) => (
                <tr key={e.employeeCode}>
                  <td>{e.employeeCode}</td>
                  <td>
                    <Button appearance="transparent" size="small" onClick={() => setDetail(e)}>
                      {e.fullName}
                    </Button>
                  </td>
                  <td>{e.username}</td>
                  <td>{e.roleNames?.join(", ") || "--"}</td>
                  <td>{e.departmentName}</td>
                  <td>{e.positionName}</td>
                  <td>{managerName(e) || "--"}</td>
                  <td>
                    <Badge appearance="tint" color={isWorking(e.employmentStatus) ? "success" : "subtle"}>
                      {EMPLOYMENT_STATUS_LABEL[e.employmentStatus] ?? e.employmentStatus}
                    </Badge>
                  </td>
                  <td>
                    <Badge appearance="tint" color={e.isAccountActive ? "success" : "danger"}>
                      {e.isAccountActive ? "Hoạt động" : "Đã khoá"}
                    </Badge>
                  </td>
                  <td>{e.lastLoginAt ? formatDateTime(e.lastLoginAt) : "--"}</td>
                  <td>
                    <div className="row-actions">
                      {canManage ? (
                        <Button size="small" onClick={() => openEdit(e)}>
                          Sửa
                        </Button>
                      ) : null}
                      {canAccount ? (
                        <Button size="small" onClick={() => setPending({ kind: "reset", employee: e })}>
                          Đặt lại mật khẩu
                        </Button>
                      ) : null}
                      {canAccount ? (
                        <Button size="small" onClick={() => toggleAccount(e)}>
                          {e.isAccountActive ? "Khoá tài khoản" : "Mở tài khoản"}
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button size="small" onClick={() => setPending({ kind: "resign", employee: e })}>
                          {isWorking(e.employmentStatus) ? "Cho nghỉ việc" : "Phục hồi"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={employees.length ? "Không có nhân viên phù hợp." : "Chưa có nhân viên"}
          description={employees.length ? "Thử đổi từ khoá hoặc bộ lọc." : "Thêm nhân viên đầu tiên cho hệ thống."}
        />
      )}

      <Dialog open={detail !== null} onOpenChange={(_, data) => !data.open && setDetail(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{detail?.fullName}</DialogTitle>
            <DialogContent>
              {detail ? (
                <dl className="detail-list">
                  {(
                    [
                      ["Mã NV", detail.employeeCode],
                      ["Tên đăng nhập", detail.username],
                      ["Vai trò", detail.roleNames?.length ? detail.roleNames.join(", ") : (detail.roleCodes ?? []).join(", ")],
                      ["Tài khoản", detail.isAccountActive ? "Hoạt động" : "Đã khoá"],
                      ["Đăng nhập cuối", detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : ""],
                      ["Email", detail.email],
                      ["Điện thoại", detail.phone ?? ""],
                      ["Địa chỉ", detail.address ?? ""],
                      ["Ngày sinh", detail.dateOfBirth ? formatDate(detail.dateOfBirth) : ""],
                      ["Giới tính", GENDER_LABEL[detail.gender ?? ""] ?? ""],
                      ["Phòng ban", detail.departmentName],
                      ["Chức vụ", detail.positionName],
                      ["Quản lý", managerName(detail)],
                      ["Ngày vào làm", detail.hireDate ? formatDate(detail.hireDate) : ""],
                      ["Trạng thái", EMPLOYMENT_STATUS_LABEL[detail.employmentStatus] ?? detail.employmentStatus],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "--"}</dd>
                    </div>
                  ))}
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

      <Dialog open={credential !== null} onOpenChange={(_, data) => !data.open && setCredential(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{credential?.isReset ? "Đã đặt lại mật khẩu" : "Thông tin đăng nhập vừa tạo"}</DialogTitle>
            <DialogContent className="form-stack">
              <p>
                Gửi thông tin dưới đây cho nhân viên. Mật khẩu chỉ hiển thị một lần.
              </p>
              {credential ? (
                <dl className="detail-list">
                  <div>
                    <dt>Tên đăng nhập</dt>
                    <dd>{credential.username}</dd>
                  </div>
                  <div>
                    <dt>Mật khẩu tạm</dt>
                    <dd className="credential-password-row">
                      <strong className="credential-password">
                        {showPassword ? credential.password : "•".repeat(credential.password.length)}
                      </strong>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={showPassword ? <EyeOffRegular /> : <EyeRegular />}
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        onClick={() => setShowPassword((v) => !v)}
                      />
                    </dd>
                  </div>
                </dl>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button icon={<CopyRegular />} onClick={copyCredential}>
                Sao chép
              </Button>
              <Button appearance="primary" onClick={() => setCredential(null)}>
                Đóng
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editing ? `Sửa hồ sơ: ${editing.fullName}` : "Thêm nhân viên mới"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Họ" required>
                  <Input value={form.lastName} onChange={(_, data) => setForm((v) => ({ ...v, lastName: data.value }))} />
                </Field>
                <Field label="Tên" required>
                  <Input value={form.firstName} onChange={(_, data) => setForm((v) => ({ ...v, firstName: data.value }))} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Điện thoại">
                  <Input value={form.phone} onChange={(_, data) => setForm((v) => ({ ...v, phone: data.value }))} />
                </Field>
                <Field label="Địa chỉ">
                  <Input value={form.address} onChange={(_, data) => setForm((v) => ({ ...v, address: data.value }))} />
                </Field>
              </div>
              {!editing ? (
                <div className="form-grid">
                  <Field label="Ngày sinh">
                    <Input type="date" max={formatDate(new Date().toISOString(), "yyyy-MM-dd")} value={form.dateOfBirth} onChange={(_, data) => setForm((v) => ({ ...v, dateOfBirth: data.value }))} />
                  </Field>
                  <Field label="Giới tính">
                    <Dropdown
                      value={{ Male: "Nam", Female: "Nữ", Other: "Khác" }[form.gender] ?? form.gender}
                      selectedOptions={[form.gender]}
                      onOptionSelect={(_, data) => setForm((v) => ({ ...v, gender: data.optionValue ?? "Male" }))}
                    >
                      <Option value="Male">Nam</Option>
                      <Option value="Female">Nữ</Option>
                      <Option value="Other">Khác</Option>
                    </Dropdown>
                  </Field>
                </div>
              ) : null}
              <div className="form-grid">
                <Field label="Phòng ban" required>
                  <Dropdown
                    value={departments.find((d) => d.departmentCode === form.departmentCode)?.departmentName ?? ""}
                    selectedOptions={[form.departmentCode]}
                    onOptionSelect={(_, data) => selectDepartment(data.optionValue ?? "")}
                  >
                    {departments.map((d) => (
                      <Option key={d.departmentCode} value={d.departmentCode}>
                        {d.departmentName}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Chức vụ" required>
                  <Dropdown
                    value={positions.find((p) => p.positionCode === form.positionCode)?.positionName ?? ""}
                    selectedOptions={[form.positionCode]}
                    onOptionSelect={(_, data) => selectPosition(data.optionValue ?? "")}
                  >
                    {positions.map((p) => (
                      <Option key={p.positionCode} value={p.positionCode}>
                        {p.positionName}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Quản lý trực tiếp">
                  <Combobox
                    freeform
                    value={managerQuery}
                    selectedOptions={[form.managerCode || NO_MANAGER]}
                    placeholder={form.departmentCode ? "Gõ tên hoặc mã nhân viên để tìm..." : "Chọn phòng ban trước"}
                    disabled={!form.departmentCode}
                    onChange={(event) => setManagerQuery(event.target.value)}
                    onOptionSelect={(_, data) => handleManagerSelect(data.optionValue)}
                  >
                    <Option value={NO_MANAGER} text="Không có">
                      Không có
                    </Option>
                    {filteredManagerCandidates.map((m) => (
                      <Option key={m.employeeCode} value={m.employeeCode} text={managerLabel(m)}>
                        {managerLabel(m)}
                      </Option>
                    ))}
                  </Combobox>
                  {form.departmentCode && departmentManagerCandidates.length === 0 ? (
                    <FieldError message="Phòng ban này chưa có nhân viên nào khác để chọn làm quản lý." />
                  ) : null}
                </Field>
                {!editing ? (
                  <Field label="Ngày vào làm" required>
                    <Input type="date" value={form.hireDate} onChange={(_, data) => setForm((v) => ({ ...v, hireDate: data.value }))} />
                  </Field>
                ) : null}
              </div>

              <h4 className="form-section-title">Tài khoản</h4>
              <div className="form-grid">
                <Field
                  label="Tên đăng nhập"
                  required={!editing}
                  hint={editing ? undefined : "3-50 ký tự: chữ không dấu, số, ., _, -"}
                >
                  <Input
                    value={editing ? editing.username : form.username}
                    disabled={Boolean(editing)}
                    onChange={(_, data) => setForm((v) => ({ ...v, username: data.value }))}
                  />
                </Field>
                <Field label="Email" required>
                  <Input value={form.email} onChange={(_, data) => setForm((v) => ({ ...v, email: data.value }))} />
                </Field>
              </div>
              {editing ? (
                <Field label="Vai trò" required hint="Chọn một hoặc nhiều vai trò.">
                  <Dropdown
                    multiselect
                    value={form.roleCodes.map(roleName).join(", ")}
                    selectedOptions={form.roleCodes}
                    onOptionSelect={(_, data) => setForm((v) => ({ ...v, roleCodes: data.selectedOptions }))}
                  >
                    {editableRoles.map((r) => (
                      <Option key={r.roleCode} value={r.roleCode} text={r.roleName}>
                        {r.roleName}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              ) : (
                !activeRoles.length ? (
                  <p>Vai trò sẽ được gán theo chức vụ đã chọn.</p>
                ) : (
                <Field label="Vai trò" hint="Mặc định theo chức vụ, có thể đổi.">
                  <Dropdown
                    value={form.roleCode === DEFAULT_ROLE ? "Mặc định theo chức vụ" : roleName(form.roleCode)}
                    selectedOptions={[form.roleCode]}
                    onOptionSelect={(_, data) => {
                      setRoleTouched(true);
                      setForm((v) => ({ ...v, roleCode: data.optionValue ?? DEFAULT_ROLE }));
                    }}
                  >
                    <Option value={DEFAULT_ROLE} text="Mặc định theo chức vụ">
                      Mặc định theo chức vụ
                    </Option>
                    {activeRoles.map((r) => (
                      <Option key={r.roleCode} value={r.roleCode} text={`${r.roleName} (${r.roleCode})`}>
                        {`${r.roleName} (${r.roleCode})`}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                )
              )}
              {formError ? <FieldError message={formError} /> : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : editing ? "Lưu thay đổi" : "Thêm nhân viên"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        title={pendingText.title}
        description={pendingText.description}
        confirmLabel={pendingText.label}
        confirming={confirming}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

export function AdminDepartmentsPage() {
  const notify = useNotify();
  const canManage = useCan()("department.manage");
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ departmentCode: "", departmentName: "", description: "" });
  const [lockDeptTarget, setLockDeptTarget] = useState<DepartmentDto | null>(null);
  const [lockingDept, setLockingDept] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [editDept, setEditDept] = useState<DepartmentDto | null>(null);
  const [editForm, setEditForm] = useState({ departmentCode: "", departmentName: "", managerCode: "", description: "" });
  const [managerQuery, setManagerQuery] = useState("");
  const [confirmRename, setConfirmRename] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => {
    setLoading(true);
    departmentApi
      .getAll()
      .then(setDepartments)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createDepartment = async () => {
    if (!deptForm.departmentCode.trim() || !deptForm.departmentName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã và tên phòng ban." });
      return;
    }
    try {
      await departmentApi.create(deptForm);
      notify({ ok: true, message: "Đã thêm phòng ban." });
      setDeptOpen(false);
      setDeptForm({ departmentCode: "", departmentName: "", description: "" });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const managerLabel = (e: EmployeeDto) => `${e.fullName} (${e.employeeCode})`;

  const openEditDept = (d: DepartmentDto) => {
    setEditDept(d);
    setEditForm({
      departmentCode: d.departmentCode,
      departmentName: d.departmentName,
      managerCode: d.managerCode ?? "",
      description: d.description ?? "",
    });
    setConfirmRename(false);
    setManagerQuery("");
    // Tải danh sách nhân viên để chọn trưởng phòng
    employeeApi
      .getAll()
      .then((list) => {
        setEmployees(list);
        const current = list.find((e) => e.employeeCode === d.managerCode);
        setManagerQuery(current ? managerLabel(current) : "");
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }));
  };

  const handleManagerSelect = (optionValue: string | undefined) => {
    if (!optionValue || optionValue === NO_MANAGER) {
      setEditForm((v) => ({ ...v, managerCode: "" }));
      setManagerQuery("");
      return;
    }
    const emp = employees.find((e) => e.employeeCode === optionValue);
    setEditForm((v) => ({ ...v, managerCode: optionValue }));
    setManagerQuery(emp ? managerLabel(emp) : "");
  };

  const managerSearch = managerQuery.trim().toLowerCase();
  const managerCandidates = employees.filter(
    (e) => e.employmentStatus !== "Terminated" || e.employeeCode === editForm.managerCode,
  );
  const filteredManagers = managerSearch
    ? managerCandidates.filter(
        (e) => e.fullName.toLowerCase().includes(managerSearch) || e.employeeCode.toLowerCase().includes(managerSearch),
      )
    : managerCandidates;

  const submitEdit = () => {
    if (!editDept) return;
    const newCode = editForm.departmentCode.trim();
    if (!editForm.departmentName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập tên phòng ban." });
      return;
    }
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(newCode)) {
      notify({ ok: false, message: "Mã phòng ban gồm 2-20 ký tự: chữ không dấu, số, _ hoặc -." });
      return;
    }
    if (newCode !== editDept.departmentCode) {
      setConfirmRename(true);
      return;
    }
    void saveEdit();
  };

  const saveEdit = async () => {
    if (!editDept) return;
    const newCode = editForm.departmentCode.trim();
    setSavingEdit(true);
    try {
      await departmentApi.update(editDept.departmentCode, {
        departmentCode: newCode !== editDept.departmentCode ? newCode : undefined,
        departmentName: editForm.departmentName.trim(),
        // Luôn gửi mã hiện tại (rỗng = bỏ trưởng phòng) để không bị xoá nhầm
        managerCode: editForm.managerCode,
        description: editForm.description.trim(),
      });
      notify({ ok: true, message: "Đã cập nhật phòng ban." });
      setConfirmRename(false);
      setEditDept(null);
      load();
    } catch (err) {
      setConfirmRename(false);
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleDepartment = async (d: DepartmentDto) => {
    try {
      await departmentApi.setActive(d.departmentCode, !d.isActive);
      notify({ ok: true, message: "Đã cập nhật trạng thái phòng ban." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const confirmLockDepartment = async () => {
    if (!lockDeptTarget) return;
    setLockingDept(true);
    try {
      await toggleDepartment(lockDeptTarget);
      setLockDeptTarget(null);
    } finally {
      setLockingDept(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Phòng ban"
        description="Toàn quyền tạo, sửa, khóa/mở phòng ban."
        action={
          <div className="row-actions">
            <ReloadButton onClick={load} />
            {canManage ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={() => setDeptOpen(true)}>
                Thêm phòng ban
              </Button>
            ) : null}
          </div>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <SectionPanel title="Danh sách phòng ban">
          {departments.length === 0 ? <EmptyState title="Chưa có phòng ban." description="Bấm Thêm phòng ban để tạo mới." /> : null}
          <div className="compact-list">
            {departments.map((d) => (
              <div className="compact-row" key={d.departmentCode}>
                <div>
                  <strong>{d.departmentName}</strong>
                  <span>
                    Mã: {d.departmentCode} · Trưởng phòng: {d.managerName ?? "Chưa có quản lý"}
                    {d.description ? ` · Mô tả: ${d.description}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={d.isActive ? "success" : "subtle"}>
                    {d.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                  {canManage ? (
                    <Button size="small" onClick={() => openEditDept(d)}>
                      Sửa
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      size="small"
                      onClick={() => (d.isActive ? setLockDeptTarget(d) : toggleDepartment(d))}
                    >
                      {d.isActive ? "Khóa" : "Mở khóa"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      )}

      <Dialog open={deptOpen} onOpenChange={(_, data) => setDeptOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Thêm phòng ban</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Mã phòng ban" required>
                <Input value={deptForm.departmentCode} onChange={(_, data) => setDeptForm((v) => ({ ...v, departmentCode: data.value }))} />
              </Field>
              <Field label="Tên phòng ban" required>
                <Input value={deptForm.departmentName} onChange={(_, data) => setDeptForm((v) => ({ ...v, departmentName: data.value }))} />
              </Field>
              <Field label="Mô tả">
                <Textarea resize="vertical" value={deptForm.description} onChange={(_, data) => setDeptForm((v) => ({ ...v, description: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeptOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={createDepartment}>
                Thêm mới
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={editDept !== null}
        onOpenChange={(_, data) => {
          if (!data.open) setEditDept(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Sửa phòng ban</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Mã phòng ban" required>
                <Input
                  value={editForm.departmentCode}
                  onChange={(_, data) => setEditForm((v) => ({ ...v, departmentCode: data.value }))}
                />
              </Field>
              <Field label="Tên phòng ban" required>
                <Input
                  value={editForm.departmentName}
                  onChange={(_, data) => setEditForm((v) => ({ ...v, departmentName: data.value }))}
                />
              </Field>
              <Field label="Trưởng phòng">
                <Combobox
                  freeform
                  value={managerQuery}
                  selectedOptions={[editForm.managerCode || NO_MANAGER]}
                  placeholder="Gõ tên hoặc mã nhân viên để tìm..."
                  onChange={(event) => setManagerQuery(event.target.value)}
                  onOptionSelect={(_, data) => handleManagerSelect(data.optionValue)}
                >
                  <Option value={NO_MANAGER} text="Không có">
                    Không có
                  </Option>
                  {filteredManagers.map((m) => (
                    <Option key={m.employeeCode} value={m.employeeCode} text={managerLabel(m)}>
                      {managerLabel(m)}
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <Field label="Mô tả">
                <Textarea
                  resize="vertical"
                  value={editForm.description}
                  onChange={(_, data) => setEditForm((v) => ({ ...v, description: data.value }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDept(null)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitEdit} disabled={savingEdit}>
                {savingEdit ? <Spinner size="tiny" /> : "Lưu thay đổi"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={confirmRename}
        title="Đổi mã phòng ban?"
        description="Đổi mã phòng ban có thể ảnh hưởng đến báo cáo hoặc tích hợp đang dùng mã cũ. Bạn có chắc không?"
        confirmLabel="Vẫn đổi mã"
        confirming={savingEdit}
        onConfirm={saveEdit}
        onCancel={() => setConfirmRename(false)}
      />

      <ConfirmDialog
        open={lockDeptTarget !== null}
        title="Đóng phòng ban?"
        description={`Phòng ban "${lockDeptTarget?.departmentName}" sẽ chuyển sang Ngừng hoạt động cho đến khi được mở lại.`}
        confirmLabel="Đóng phòng ban"
        confirming={lockingDept}
        onConfirm={confirmLockDepartment}
        onCancel={() => setLockDeptTarget(null)}
      />
    </div>
  );
}

export function AdminPositionsPage() {
  const notify = useNotify();
  const canManage = useCan()("position.manage");
  const [salaryTarget, setSalaryTarget] = useState<PositionDto | null>(null);
  const [salaryText, setSalaryText] = useState("");
  const [salaryError, setSalaryError] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [posOpen, setPosOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionDto | null>(null);
  const [posForm, setPosForm] = useState({
    positionCode: "",
    positionName: "",
    description: "",
  });
  const [lockPosTarget, setLockPosTarget] = useState<PositionDto | null>(null);
  const [lockingPos, setLockingPos] = useState(false);

  const load = () => {
    setLoading(true);
    positionApi
      .getAll()
      .then(setPositions)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyPosForm = {
    positionCode: "",
    positionName: "",
    description: "",
  };

  const openCreatePosition = () => {
    setEditingPosition(null);
    setPosForm(emptyPosForm);
    setPosOpen(true);
  };

  const openEditPosition = (p: PositionDto) => {
    setEditingPosition(p);
    setPosForm({
      positionCode: p.positionCode,
      positionName: p.positionName,
      description: p.description ?? "",
    });
    setPosOpen(true);
  };

  const submitPosition = async () => {
    if (!posForm.positionCode.trim() || !posForm.positionName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã và tên chức vụ." });
      return;
    }
    try {
      if (editingPosition) {
        await positionApi.update(editingPosition.positionCode, {
          positionName: posForm.positionName,
          description: posForm.description,
        });
        notify({ ok: true, message: "Đã cập nhật chức vụ." });
      } else {
        await positionApi.create(posForm);
        notify({ ok: true, message: "Đã thêm chức vụ." });
      }
      setPosOpen(false);
      setEditingPosition(null);
      setPosForm(emptyPosForm);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const openSalary = (p: PositionDto) => {
    setSalaryTarget(p);
    setSalaryText(p.standardSalary == null ? "" : String(Math.round(p.standardSalary)));
    setSalaryError("");
  };

  const submitSalary = async () => {
    if (!salaryTarget) return;
    const value = Number(salaryText.trim().replace(/[.,\s]/g, ""));
    if (!salaryText.trim() || !Number.isFinite(value) || value < 0) {
      setSalaryError("Lương chuẩn không hợp lệ.");
      return;
    }
    setSavingSalary(true);
    try {
      await positionApi.setStandardSalary(salaryTarget.positionCode, value);
      notify({ ok: true, message: "Đã cập nhật lương chuẩn." });
      setSalaryTarget(null);
      load();
    } catch (err) {
      setSalaryError(errorMessage(err));
    } finally {
      setSavingSalary(false);
    }
  };

  const togglePosition = async (p: PositionDto) => {
    try {
      await positionApi.setActive(p.positionCode, !p.isActive);
      notify({ ok: true, message: "Đã cập nhật trạng thái chức vụ." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const confirmLockPosition = async () => {
    if (!lockPosTarget) return;
    setLockingPos(true);
    try {
      await togglePosition(lockPosTarget);
      setLockPosTarget(null);
    } finally {
      setLockingPos(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Chức vụ"
        description="Toàn quyền tạo, sửa, khóa/mở chức vụ — chỉ là chức danh hiển thị, không gắn với vai trò. Vai trò được chọn riêng khi tạo tài khoản."
        action={
          <div className="row-actions">
            <ReloadButton onClick={load} />
            {canManage ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={openCreatePosition}>
                Thêm chức vụ
              </Button>
            ) : null}
          </div>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <SectionPanel title="Danh sách chức vụ">
          {positions.length === 0 ? <EmptyState title="Chưa có chức vụ." description="Bấm Thêm chức vụ để tạo mới." /> : null}
          <div className="compact-list">
            {positions.map((p) => (
              <div className="compact-row" key={p.positionCode}>
                <div>
                  <strong>{p.positionName}</strong>
                  <span>
                    Mã: {p.positionCode} · Lương chuẩn:{" "}
                    {p.standardSalary ? formatCurrency(p.standardSalary) : "Chưa có lương chuẩn"}
                    {p.description ? ` · Mô tả: ${p.description}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={p.isActive ? "success" : "subtle"}>
                    {p.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                  {canManage ? (
                    <>
                      <Button size="small" onClick={() => openEditPosition(p)}>
                        Sửa
                      </Button>
                      <Button size="small" onClick={() => openSalary(p)}>
                        Lương chuẩn
                      </Button>
                      <Button
                        size="small"
                        onClick={() => (p.isActive ? setLockPosTarget(p) : togglePosition(p))}
                      >
                        {p.isActive ? "Khóa" : "Mở khóa"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      )}

      <Dialog
        open={posOpen}
        onOpenChange={(_, data) => {
          setPosOpen(data.open);
          if (!data.open) setEditingPosition(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingPosition ? "Sửa chức vụ" : "Thêm chức vụ"}</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Mã chức vụ" required>
                <Input
                  value={posForm.positionCode}
                  disabled={!!editingPosition}
                  onChange={(_, data) => setPosForm((v) => ({ ...v, positionCode: data.value }))}
                />
              </Field>
              <Field label="Tên chức vụ" required>
                <Input value={posForm.positionName} onChange={(_, data) => setPosForm((v) => ({ ...v, positionName: data.value }))} />
              </Field>
              <Field label="Mô tả">
                <Textarea resize="vertical" value={posForm.description} onChange={(_, data) => setPosForm((v) => ({ ...v, description: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPosOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitPosition}>
                {editingPosition ? "Lưu thay đổi" : "Thêm mới"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={salaryTarget !== null} onOpenChange={(_, data) => !data.open && setSalaryTarget(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Lương chuẩn: {salaryTarget?.positionName}</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Lương chuẩn (đ)" required>
                <Input
                  inputMode="numeric"
                  value={salaryText}
                  onChange={(_, data) => setSalaryText(data.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitSalary();
                  }}
                />
              </Field>
              {salaryError ? <FieldError message={salaryError} /> : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSalaryTarget(null)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitSalary} disabled={savingSalary}>
                {savingSalary ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={lockPosTarget !== null}
        title="Đóng chức vụ?"
        description={`Chức vụ "${lockPosTarget?.positionName}" sẽ chuyển sang Ngừng hoạt động cho đến khi được mở lại.`}
        confirmLabel="Đóng chức vụ"
        confirming={lockingPos}
        onConfirm={confirmLockPosition}
        onCancel={() => setLockPosTarget(null)}
      />
    </div>
  );
}

const UNIT_LABEL: Record<LeaveUnit, string> = { Days: "Ngày", Hours: "Giờ" };
const PERIOD_LABEL: Record<LeaveAccrualPeriod, string> = {
  ProratedYearly: "Cộng dồn theo tháng",
  MonthlyReset: "Cấp mỗi tháng, hết tháng đặt lại",
  FlatYearly: "Cấp một lần mỗi năm",
};
// Diễn giải quy tắc cấp, khớp LeaveBalanceService.CalculateDefaultAllocation
const PERIOD_HINT: Record<LeaveAccrualPeriod, string> = {
  ProratedYearly:
    "Số lượng là mức cấp mỗi THÁNG, cộng dồn cho các tháng còn lại trong năm (nhân viên vào giữa năm chỉ được tính từ tháng vào làm). Ví dụ 1 ngày: cả năm 12 ngày.",
  MonthlyReset: "Mỗi tháng được cấp đúng số lượng này, hết tháng thì số dư đặt lại, không cộng dồn sang tháng sau.",
  FlatYearly: "Mỗi năm được cấp một lần đúng số lượng này, không chia theo tháng vào làm.",
};

function describeAccrual(t: LeaveTypeDto) {
  const unit = t.accrualUnit === "Days" ? "ngày" : "giờ";
  if (t.accrualPeriod === "MonthlyReset") return `Cấp ${t.accrualAmount} ${unit} mỗi tháng, hết tháng đặt lại`;
  if (t.accrualPeriod === "FlatYearly") return `Cấp ${t.accrualAmount} ${unit} một lần mỗi năm`;
  return `Cấp ${t.accrualAmount} ${unit} mỗi tháng, cộng dồn trong năm`;
}

const emptyLeaveTypeForm = {
  leaveTypeCode: "",
  leaveTypeName: "",
  accrualAmount: "1",
  accrualUnit: "Days" as LeaveUnit,
  accrualPeriod: "ProratedYearly" as LeaveAccrualPeriod,
  isPaid: true,
  description: "",
};

export function AdminLeaveTypesPage() {
  const notify = useNotify();
  const canManage = useCan()("leavetype.manage");
  const [formError, setFormError] = useState("");
  const [items, setItems] = useState<LeaveTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeDto | null>(null);
  const [form, setForm] = useState(emptyLeaveTypeForm);
  const [saving, setSaving] = useState(false);
  const [lockTarget, setLockTarget] = useState<LeaveTypeDto | null>(null);
  const [locking, setLocking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeaveTypeDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = () => {
    setLoading(true);
    leaveTypeApi
      .getAll()
      .then(setItems)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setForm(emptyLeaveTypeForm);
    setOpen(true);
  };

  const openEdit = (t: LeaveTypeDto) => {
    setEditing(t);
    setFormError("");
    setForm({
      leaveTypeCode: t.leaveTypeCode,
      leaveTypeName: t.leaveTypeName,
      accrualAmount: String(t.accrualAmount),
      accrualUnit: t.accrualUnit,
      accrualPeriod: t.accrualPeriod,
      isPaid: t.isPaid,
      description: t.description ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    const amount = Number(form.accrualAmount.trim().replace(",", "."));
    if (!editing) {
      const code = form.leaveTypeCode.trim();
      if (!code) return setFormError("Vui lòng nhập mã loại nghỉ.");
      if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
        return setFormError("Mã chỉ gồm chữ HOA, số, gạch dưới và bắt đầu bằng chữ cái.");
      }
    }
    if (!form.leaveTypeName.trim()) return setFormError("Vui lòng nhập tên loại nghỉ.");
    if (!form.accrualAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      return setFormError("Số lượng cấp phải là số lớn hơn 0.");
    }
    setFormError("");
    const body = {
      leaveTypeName: form.leaveTypeName.trim(),
      accrualAmount: amount,
      accrualUnit: form.accrualUnit,
      accrualPeriod: form.accrualPeriod,
      isPaid: form.isPaid,
      description: form.description.trim(),
    };
    setSaving(true);
    try {
      if (editing) {
        await leaveTypeApi.update(editing.leaveTypeCode, body);
        notify({ ok: true, message: "Đã cập nhật loại nghỉ." });
      } else {
        await leaveTypeApi.create({ ...body, leaveTypeCode: form.leaveTypeCode.trim().toUpperCase() });
        notify({ ok: true, message: "Đã tạo loại nghỉ." });
      }
      setOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      // Giữ form mở và hiện nguyên văn lỗi backend (vd đổi đơn vị khi đã có số dư).
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (t: LeaveTypeDto) => {
    try {
      await leaveTypeApi.setActive(t.leaveTypeCode, !t.isActive);
      notify({ ok: true, message: t.isActive ? "Đã tắt loại nghỉ." : "Đã bật loại nghỉ." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const confirmLock = async () => {
    if (!lockTarget) return;
    setLocking(true);
    try {
      await toggle(lockTarget);
      setLockTarget(null);
    } finally {
      setLocking(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await leaveTypeApi.remove(deleteTarget.leaveTypeCode);
      notify({ ok: true, message: "Đã xoá loại nghỉ." });
      setDeleteTarget(null);
      load();
    } catch (err) {
      // Giữ dialog mở và hiện nguyên văn message backend kèm gợi ý tắt thay vì xoá
      setDeleteError(`${errorMessage(err)} Bạn có thể tắt loại nghỉ thay vì xoá.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Loại nghỉ phép"
        description="Tạo, sửa, bật/tắt, xoá loại nghỉ và quy tắc cấp số dư."
        action={
          <div className="row-actions">
            <ReloadButton onClick={load} />
            {canManage ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={openCreate}>
                Thêm loại nghỉ
              </Button>
            ) : null}
          </div>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <SectionPanel title="Danh sách loại nghỉ phép">
          {items.length === 0 ? <EmptyState title="Chưa có loại nghỉ phép." description="Bấm Thêm loại nghỉ để tạo mới." /> : null}
          <div className="compact-list">
            {items.map((t) => (
              <div className="compact-row" key={t.leaveTypeCode}>
                <div>
                  <strong>{t.leaveTypeName}</strong>
                  <span>
                    Mã: {t.leaveTypeCode} · {describeAccrual(t)} · Đơn vị: {UNIT_LABEL[t.accrualUnit]} ·{" "}
                    {t.isPaid ? "Có lương" : "Không lương"}
                    {t.description ? ` · ${t.description}` : ""}
                  </span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={t.isActive ? "success" : "danger"}>
                    {t.isActive ? "Đang dùng" : "Đã tắt"}
                  </Badge>
                  {canManage ? (
                    <>
                      <Switch
                        checked={t.isActive}
                        label={t.isActive ? "Bật" : "Tắt"}
                        onChange={() => (t.isActive ? setLockTarget(t) : toggle(t))}
                      />
                      <Button size="small" onClick={() => openEdit(t)}>
                        Sửa
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(t);
                        }}
                      >
                        Xoá
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      )}

      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          setOpen(data.open);
          if (!data.open) setEditing(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editing ? "Sửa loại nghỉ" : "Thêm loại nghỉ"}</DialogTitle>
            <DialogContent className="form-stack">
              <Field
                label="Mã loại nghỉ"
                required
                hint={editing ? "Mã không đổi được sau khi tạo." : "VD: SICK_LEAVE"}
              >
                <Input
                  value={form.leaveTypeCode}
                  disabled={!!editing}
                  onChange={(_, data) =>
                    setForm((v) => ({ ...v, leaveTypeCode: data.value.replace(/[^A-Za-z0-9_]/g, "").toUpperCase() }))
                  }
                />
              </Field>
              <Field label="Tên loại nghỉ" required>
                <Input value={form.leaveTypeName} onChange={(_, data) => setForm((v) => ({ ...v, leaveTypeName: data.value }))} />
              </Field>
              <Field label="Số lượng cấp" required>
                <Input
                  inputMode="decimal"
                  value={form.accrualAmount}
                  onChange={(_, data) => setForm((v) => ({ ...v, accrualAmount: data.value }))}
                />
              </Field>
              <Field label="Đơn vị">
                <Dropdown
                  value={UNIT_LABEL[form.accrualUnit]}
                  selectedOptions={[form.accrualUnit]}
                  onOptionSelect={(_, data) => setForm((v) => ({ ...v, accrualUnit: data.optionValue as LeaveUnit }))}
                >
                  <Option value="Days">Ngày</Option>
                  <Option value="Hours">Giờ</Option>
                </Dropdown>
              </Field>
              <Field label="Chu kỳ cấp" hint={PERIOD_HINT[form.accrualPeriod]}>
                <Dropdown
                  value={PERIOD_LABEL[form.accrualPeriod]}
                  selectedOptions={[form.accrualPeriod]}
                  onOptionSelect={(_, data) =>
                    setForm((v) => ({ ...v, accrualPeriod: data.optionValue as LeaveAccrualPeriod }))
                  }
                >
                  {(Object.keys(PERIOD_LABEL) as LeaveAccrualPeriod[]).map((p) => (
                    <Option key={p} value={p}>
                      {PERIOD_LABEL[p]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Switch
                checked={form.isPaid}
                label="Nghỉ có lương"
                onChange={(_, data) => setForm((v) => ({ ...v, isPaid: data.checked }))}
              />
              <Field label="Mô tả">
                <Textarea resize="vertical" value={form.description} onChange={(_, data) => setForm((v) => ({ ...v, description: data.value }))} />
              </Field>
              {editing ? (
                <p>
                  Lưu ý: sửa quy tắc cấp chỉ áp dụng cho số dư tạo MỚI, không thay đổi số dư đã cấp cho nhân viên. Chỉ
                  đổi được đơn vị khi loại nghỉ chưa có đơn hoặc số dư.
                </p>
              ) : null}
              {formError ? <FieldError message={formError} /> : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Huỷ</Button>
              <Button appearance="primary" disabled={saving} onClick={submit}>
                {saving ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={lockTarget !== null}
        title="Tắt loại nghỉ"
        description={`Tắt "${lockTarget?.leaveTypeName}"? Nhân viên sẽ không chọn được loại nghỉ này khi xin nghỉ.`}
        confirmLabel="Tắt"
        confirming={locking}
        onConfirm={confirmLock}
        onCancel={() => setLockTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xoá loại nghỉ"
        description={
          <>
            <div>{`Xoá "${deleteTarget?.leaveTypeName}" (${deleteTarget?.leaveTypeCode})? Thao tác này không hoàn tác được.`}</div>
            {deleteError ? <FieldError message={deleteError} /> : null}
          </>
        }
        confirmLabel="Xoá"
        confirming={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

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
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import {
  AddRegular,
  ArrowClockwiseRegular,
  CopyRegular,
  EyeOffRegular,
  EyeRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { PermissionGroupEditor } from "../components/PermissionGroupEditor";
import { ConfirmDialog, EmptyState, FieldError, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { auditApi, employeeApi, menuApi, permissionApi, roleApi, userApi } from "../services/api";
import { ApiError, errorMessage } from "../services/http";
import type { AuditLogDto, AuditLogFilterOptionsDto, EmployeeDto, MenuDto, PermissionDto, RoleDto, UserDto } from "../types/domain";

function useAllRoles() {
  const notify = useNotify();
  const [roles, setRoles] = useState<RoleDto[]>([]);

  useEffect(() => {
    roleApi.getAll().then(setRoles).catch((err) => notify({ ok: false, message: errorMessage(err) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return roles;
}
import { formatDateTime } from "../utils/format";

type AdminSystemTab = "menus" | "roles" | "permissions";

function isBackendUnavailable(error: unknown) {
  return error instanceof ApiError && [404, 501].includes(error.status);
}

function splitCodes(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCodes(value?: string[]) {
  return value?.join(", ") ?? "";
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_EMPLOYEE = "__none__";

// Ô chọn nhân viên liên kết có tìm kiếm theo mã/tên; mã đang gán mà không có trong danh sách vẫn được giữ lại.
function EmployeePicker({
  employees,
  value,
  onChange,
}: {
  employees: EmployeeDto[];
  value: string;
  onChange: (code: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const known = employees.find((e) => e.employeeCode === value);
  const label = value ? (known ? `${known.employeeCode} - ${known.fullName}` : value) : "";
  const options = employees.map((e) => ({ code: e.employeeCode, text: `${e.employeeCode} - ${e.fullName}` }));
  if (value && !known) options.unshift({ code: value, text: value });
  const keyword = (query ?? "").trim().toLowerCase();
  const visible = keyword ? options.filter((o) => o.text.toLowerCase().includes(keyword)) : options;

  return (
    <Combobox
      placeholder="Không liên kết nhân viên"
      value={query ?? label}
      selectedOptions={[value || NO_EMPLOYEE]}
      onChange={(event) => setQuery(event.target.value)}
      onOptionSelect={(_, data) => {
        onChange(data.optionValue === NO_EMPLOYEE ? "" : (data.optionValue ?? ""));
        setQuery(null);
      }}
      onOpenChange={(_, data) => {
        if (!data.open) setQuery(null);
      }}
    >
      <Option value={NO_EMPLOYEE} text="">
        Không liên kết nhân viên
      </Option>
      {visible.map((o) => (
        <Option key={o.code} value={o.code} text={o.text}>
          {o.text}
        </Option>
      ))}
    </Combobox>
  );
}

function UnavailableState({ description }: { description: string }) {
  return <EmptyState title="Chưa khả dụng" description={description} />;
}

export function AdminUsersApiPage() {
  const notify = useNotify();
  const roles = useAllRoles();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [credential, setCredential] = useState<{ username: string; password: string; isReset: boolean } | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [resettingUsername, setResettingUsername] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<UserDto | null>(null);
  const [locking, setLocking] = useState(false);
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    roleCode: "",
    roleCodes: [] as string[],
    employeeCode: "",
  });
  const [filters, setFilters] = useState({ employeeCode: "", employeeName: "" });
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const activeRoles = roles.filter((r) => r.isActive);

  useEffect(() => {
    employeeApi.getAll().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  const loadUsers = () => {
    setLoadingUsers(true);
    userApi
      .getAll()
      .then(setUsers)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoadingUsers(false));
  };

  useEffect(loadUsers, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters = Boolean(filters.employeeCode || filters.employeeName);
  const filteredUsers = users.filter((user) => {
    if (filters.employeeCode && !(user.employeeCode ?? "").toLowerCase().includes(filters.employeeCode.toLowerCase())) {
      return false;
    }
    if (filters.employeeName && !(user.employeeName ?? "").toLowerCase().includes(filters.employeeName.toLowerCase())) {
      return false;
    }
    return true;
  });

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      username: "",
      email: "",
      roleCode: activeRoles.find((r) => r.roleCode === "EMPLOYEE")?.roleCode ?? activeRoles[0]?.roleCode ?? "",
      roleCodes: [],
      employeeCode: "",
    });
    setUserOpen(true);
  };

  const openEditUser = (user: UserDto) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      roleCode: "",
      roleCodes: user.roles,
      employeeCode: user.employeeCode ?? "",
    });
    setUserOpen(true);
  };

  const submitUser = async () => {
    if (!userForm.username.trim() || !userForm.email.trim()) {
      notify({ ok: false, message: "Vui lòng nhập đủ tên đăng nhập và email." });
      return;
    }
    if (!editingUser && !USERNAME_PATTERN.test(userForm.username.trim())) {
      notify({
        ok: false,
        message: "Tên đăng nhập dài 3-50 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang.",
      });
      return;
    }
    if (!EMAIL_PATTERN.test(userForm.email.trim())) {
      notify({ ok: false, message: "Email không đúng định dạng." });
      return;
    }
    if (!editingUser && !userForm.roleCode) {
      notify({ ok: false, message: "Vui lòng chọn vai trò cho tài khoản này." });
      return;
    }
    if (editingUser && !userForm.roleCodes.length) {
      notify({ ok: false, message: "Tài khoản phải có ít nhất một vai trò." });
      return;
    }
    setSending(true);
    try {
      if (editingUser) {
        await userApi.update(editingUser.username, {
          email: userForm.email.trim(),
          employeeCode: userForm.employeeCode || undefined,
          roleCodes: userForm.roleCodes,
        });
        notify({ ok: true, message: "Đã cập nhật tài khoản." });
      } else {
        const result = await userApi.create({
          username: userForm.username.trim(),
          email: userForm.email.trim(),
          roleCode: userForm.roleCode,
          employeeCode: userForm.employeeCode || undefined,
        });
        setShowPassword(false);
        setCredential({ username: result.user.username, password: result.generatedPassword, isReset: false });
        notify({ ok: true, message: "Đã tạo tài khoản." });
      }
      setUserOpen(false);
      loadUsers();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ thao tác tài khoản này." : errorMessage(err),
      });
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

  const resetPassword = async (user: UserDto) => {
    setResettingUsername(user.username);
    try {
      const result = await userApi.resetPassword(user.username);
      setShowPassword(false);
      setCredential({ username: result.user.username, password: result.generatedPassword, isReset: true });
      notify({ ok: true, message: "Đã đặt lại mật khẩu." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setResettingUsername(null);
    }
  };

  const toggleUserActive = async (user: UserDto) => {
    try {
      await userApi.setActive(user.username, !user.isActive);
      notify({ ok: true, message: user.isActive ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản." });
      loadUsers();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  // Khóa tài khoản chặn đăng nhập ngay lập tức nên cần xác nhận trước khi bấm nhầm — mở
  // khóa không có rủi ro tương đương nên bấm là chạy luôn (xem toggleUserActive/onClick bên
  // dưới, chỉ đi qua dialog này khi user.isActive === true).
  const confirmLockUser = async () => {
    if (!lockTarget) return;
    setLocking(true);
    try {
      await toggleUserActive(lockTarget);
      setLockTarget(null);
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý tài khoản"
        description="Quản trị tài khoản đăng nhập và vai trò gán cho nhân viên."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={openCreateUser}>
            Tạo tài khoản
          </Button>
        }
      />

      <SectionPanel
        title="Bộ lọc"
        action={
          hasActiveFilters ? (
            <Button size="small" onClick={() => setFilters({ employeeCode: "", employeeName: "" })}>
              Xoá bộ lọc
            </Button>
          ) : undefined
        }
      >
        <div className="form-grid">
          <Field label="Mã nhân viên">
            <Input
              value={filters.employeeCode}
              onChange={(_, data) => setFilters((value) => ({ ...value, employeeCode: data.value }))}
            />
          </Field>
          <Field label="Tên nhân viên">
            <Input
              value={filters.employeeName}
              onChange={(_, data) => setFilters((value) => ({ ...value, employeeName: data.value }))}
            />
          </Field>
        </div>
      </SectionPanel>

      {loadingUsers ? (
          <Spinner label="Đang tải..." />
        ) : filteredUsers.length ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Email</th>
                  <th>Mã NV</th>
                  <th>Tên nhân viên</th>
                  <th>Vai trò</th>
                  <th>Đăng nhập gần nhất</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.username}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.employeeCode ?? "--"}</td>
                    <td>{user.employeeName ?? "--"}</td>
                    <td>{user.roles.join(", ")}</td>
                    <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "--"}</td>
                    <td>
                      <Badge appearance="tint" color={user.isActive ? "success" : "danger"}>
                        {user.isActive ? "Đang hoạt động" : "Đã khóa"}
                      </Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Button size="small" onClick={() => openEditUser(user)}>
                          Sửa
                        </Button>
                        <Button
                          size="small"
                          onClick={() => (user.isActive ? setLockTarget(user) : toggleUserActive(user))}
                        >
                          {user.isActive ? "Khóa" : "Mở khóa"}
                        </Button>
                        <Button
                          size="small"
                          icon={<ArrowClockwiseRegular />}
                          disabled={resettingUsername === user.username}
                          onClick={() => resetPassword(user)}
                        >
                          {resettingUsername === user.username ? <Spinner size="tiny" /> : "Đặt lại mật khẩu"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasActiveFilters ? (
          <EmptyState title="Không có tài khoản phù hợp" description="Thử điều chỉnh lại bộ lọc." />
        ) : (
          <EmptyState title="Chưa có tài khoản" description="Tạo tài khoản đầu tiên cho hệ thống." />
        )}

      {credential ? (
        <SectionPanel
          title={credential.isReset ? "Đã đặt lại mật khẩu" : "Thông tin đăng nhập vừa tạo"}
          action={
            <Button icon={<CopyRegular />} onClick={copyCredential}>
              Sao chép
            </Button>
          }
        >
          <p>Gửi thông tin đăng nhập dưới đây cho nhân viên. Mật khẩu chỉ hiển thị một lần.</p>
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
        </SectionPanel>
      ) : null}

      <Dialog open={userOpen} onOpenChange={(_, data) => setUserOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingUser ? "Sửa tài khoản" : "Tạo tài khoản mới"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Tên đăng nhập" required hint={editingUser ? undefined : "3-50 ký tự: chữ không dấu, số, ., _, -"}>
                  <Input
                    value={userForm.username}
                    disabled={Boolean(editingUser)}
                    onChange={(_, data) => setUserForm((value) => ({ ...value, username: data.value }))}
                  />
                </Field>
                <Field label="Email" required>
                  <Input value={userForm.email} onChange={(_, data) => setUserForm((value) => ({ ...value, email: data.value }))} />
                </Field>
              </div>
              {editingUser ? (
                <div className="form-grid">
                  <Field label="Vai trò" required hint="Chọn ít nhất một vai trò.">
                    <Dropdown
                      multiselect
                      value={userForm.roleCodes.map((c) => roles.find((r) => r.roleCode === c)?.roleName ?? c).join(", ")}
                      selectedOptions={userForm.roleCodes}
                      onOptionSelect={(_, data) => setUserForm((value) => ({ ...value, roleCodes: data.selectedOptions }))}
                    >
                      {[
                        ...activeRoles,
                        // Vai trò đang gán nhưng đã bị khoá vẫn hiển thị để không mất dữ liệu khi lưu.
                        ...roles.filter((r) => !r.isActive && userForm.roleCodes.includes(r.roleCode)),
                      ].map((r) => (
                        <Option key={r.roleCode} value={r.roleCode} text={r.roleName}>
                          {r.roleName}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Mã nhân viên liên kết">
                    <EmployeePicker
                      employees={employees}
                      value={userForm.employeeCode}
                      onChange={(code) => setUserForm((value) => ({ ...value, employeeCode: code }))}
                    />
                  </Field>
                </div>
              ) : (
                <div className="form-grid">
                  <Field label="Vai trò" required>
                    <Dropdown
                      value={roles.find((r) => r.roleCode === userForm.roleCode)?.roleName ?? ""}
                      selectedOptions={[userForm.roleCode]}
                      onOptionSelect={(_, data) => setUserForm((value) => ({ ...value, roleCode: data.optionValue ?? "" }))}
                    >
                      {activeRoles.map((r) => (
                        <Option key={r.roleCode} value={r.roleCode} text={r.roleName}>
                          {r.roleName}
                        </Option>
                      ))}
                    </Dropdown>
                    {!activeRoles.length ? <FieldError message="Chưa có role nào được cấu hình." /> : null}
                  </Field>
                  <Field label="Mã nhân viên liên kết" hint="Bỏ trống nếu tạo tài khoản không gắn nhân viên (vd tài khoản hệ thống).">
                    <EmployeePicker
                      employees={employees}
                      value={userForm.employeeCode}
                      onChange={(code) => setUserForm((value) => ({ ...value, employeeCode: code }))}
                    />
                  </Field>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setUserOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitUser} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : editingUser ? "Lưu" : "Tạo tài khoản"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={lockTarget !== null}
        title="Khóa tài khoản?"
        description={`Tài khoản "${lockTarget?.username}" sẽ không thể đăng nhập cho đến khi được mở khóa lại.`}
        confirmLabel="Khóa tài khoản"
        confirming={locking}
        onConfirm={confirmLockUser}
        onCancel={() => setLockTarget(null)}
      />
    </div>
  );
}

export function AdminAuditLogApiPage() {
  const notify = useNotify();
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const emptyFilters = { username: "", module: "", action: "", date: "" };
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptionsDto | null>(null);

  useEffect(() => {
    // Lỗi tải danh sách lọc thì ẩn ô chọn tương ứng, không ảnh hưởng phần còn lại của trang.
    auditApi.getFilterOptions().then(setFilterOptions).catch(() => setFilterOptions(null));
  }, []);

  const load = (current = filters) => {
    setLoading(true);
    setUnavailable(false);
    auditApi
      .getAll({
        username: current.username || undefined,
        module: current.module || undefined,
        action: current.action || undefined,
        date: current.date || undefined,
      })
      .then(setLogs)
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setLogs([]);
          setUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = Object.values(filters).some(Boolean);
  const clearFilters = () => {
    setFilters(emptyFilters);
    load(emptyFilters);
  };

  const filterSelect = (key: "module" | "action", items: string[]) => (
    <Dropdown
      value={filters[key] || "Tất cả"}
      selectedOptions={[filters[key]]}
      onOptionSelect={(_, data) => setFilters((value) => ({ ...value, [key]: data.optionValue ?? "" }))}
    >
      <Option value="" text="Tất cả">
        Tất cả
      </Option>
      {items.map((item) => (
        <Option key={item} value={item} text={item}>
          {item}
        </Option>
      ))}
    </Dropdown>
  );

  return (
    <div className="page-stack">
      <PageHeader title="Nhật ký hệ thống" description="Xem lịch sử thao tác toàn hệ thống, chỉ đọc." />
      <SectionPanel>
        <div className="filter-grid">
          <Field label="Người dùng">
            <Input value={filters.username} onChange={(_, data) => setFilters((value) => ({ ...value, username: data.value }))} />
          </Field>
          {filterOptions?.modules.length ? <Field label="Phân hệ">{filterSelect("module", filterOptions.modules)}</Field> : null}
          {filterOptions?.actions.length ? <Field label="Hành động">{filterSelect("action", filterOptions.actions)}</Field> : null}
          <Field label="Ngày">
            <Input type="date" value={filters.date} onChange={(_, data) => setFilters((value) => ({ ...value, date: data.value }))} />
          </Field>
          <Button appearance="primary" onClick={() => load()}>
            Lọc
          </Button>
          {hasFilters ? <Button onClick={clearFilters}>Xoá lọc</Button> : null}
        </div>
      </SectionPanel>
      <SectionPanel>
        {loading ? (
          <Spinner label="Đang tải audit log..." />
        ) : unavailable ? (
          <UnavailableState description="Backend chưa cung cấp API audit log. Trang sẽ hiển thị dữ liệu khi endpoint sẵn sàng." />
        ) : logs.length ? (
          <div className="enterprise-table-wrap">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người dùng</th>
                  <th>Phân hệ</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.username ?? "--"}</td>
                    <td>{log.module}</td>
                    <td>{log.action}</td>
                    <td>{log.target ?? "--"}</td>
                    <td>{log.ipAddress ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Chưa có audit log" description="Không có thao tác nào khớp với bộ lọc hiện tại." />
        )}
      </SectionPanel>
    </div>
  );
}

export function AdminSystemApiPage() {
  const notify = useNotify();
  const [tab, setTab] = useState<AdminSystemTab>("menus");

  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [menusUnavailable, setMenusUnavailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuDto | null>(null);
  const [menuForm, setMenuForm] = useState({
    menuCode: "",
    menuName: "",
    icon: "",
    route: "",
    displayOrder: 1,
    permissions: "",
  });

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [rolesUnavailable, setRolesUnavailable] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [roleForm, setRoleForm] = useState({
    roleCode: "",
    roleName: "",
    description: "",
    permissions: [] as string[],
  });

  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [permissionsUnavailable, setPermissionsUnavailable] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionDto | null>(null);
  const [permissionForm, setPermissionForm] = useState({
    permissionCode: "",
    permissionName: "",
    module: "",
    description: "",
  });

  const [sending, setSending] = useState(false);

  // Danh sách phân hệ duy nhất từ các quyền hiện có, kèm giá trị đang sửa để không mất dữ liệu.
  const moduleOptions = Array.from(
    new Set([...permissions.map((p) => p.module), permissionForm.module].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const loadMenus = () => {
    setLoadingMenus(true);
    setMenusUnavailable(false);
    menuApi
      .getAll()
      .then((items) => setMenus(items.filter((item) => item.route !== "/internal/admin-login")))
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setMenus([]);
          setMenusUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingMenus(false));
  };

  const loadRoles = () => {
    setLoadingRoles(true);
    setRolesUnavailable(false);
    roleApi
      .getAll()
      .then(setRoles)
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setRoles([]);
          setRolesUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingRoles(false));
  };

  const loadPermissions = () => {
    setLoadingPermissions(true);
    setPermissionsUnavailable(false);
    permissionApi
      .getAll()
      .then(setPermissions)
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setPermissions([]);
          setPermissionsUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingPermissions(false));
  };

  useEffect(() => {
    loadMenus();
    loadRoles();
    loadPermissions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateMenu = () => {
    setEditingMenu(null);
    setMenuForm({ menuCode: "", menuName: "", icon: "", route: "", displayOrder: 1, permissions: "" });
    setMenuOpen(true);
  };

  const openEditMenu = (menu: MenuDto) => {
    setEditingMenu(menu);
    setMenuForm({
      menuCode: menu.menuCode,
      menuName: menu.menuName,
      icon: menu.icon ?? "",
      route: menu.route,
      displayOrder: menu.displayOrder,
      permissions: joinCodes(menu.permissions),
    });
    setMenuOpen(true);
  };

  const submitMenu = async () => {
    if (!menuForm.menuCode.trim() || !menuForm.menuName.trim() || !menuForm.route.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã menu, tên menu và route." });
      return;
    }
    if (menuForm.route === "/internal/admin-login") {
      notify({ ok: false, message: "Không cấu hình URL đăng nhập admin ẩn trong menu." });
      return;
    }
    setSending(true);
    try {
      if (editingMenu) {
        await menuApi.update(editingMenu.menuCode, {
          menuName: menuForm.menuName,
          icon: menuForm.icon || undefined,
          route: menuForm.route,
          displayOrder: menuForm.displayOrder,
          permissions: splitCodes(menuForm.permissions),
        });
        notify({ ok: true, message: "Đã cập nhật menu." });
      } else {
        await menuApi.create({
          menuCode: menuForm.menuCode,
          menuName: menuForm.menuName,
          icon: menuForm.icon || undefined,
          route: menuForm.route,
          displayOrder: menuForm.displayOrder,
          permissions: splitCodes(menuForm.permissions),
        });
        notify({ ok: true, message: "Đã tạo menu." });
      }
      setMenuOpen(false);
      loadMenus();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ cấu hình menu." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const toggleMenuVisible = async (menu: MenuDto) => {
    try {
      await menuApi.setVisible(menu.menuCode, !menu.isVisible);
      loadMenus();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const toggleMenuActive = async (menu: MenuDto) => {
    try {
      await menuApi.setActive(menu.menuCode, !menu.isActive);
      loadMenus();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ roleCode: "", roleName: "", description: "", permissions: [] });
    setRoleOpen(true);
  };

  const openEditRole = (role: RoleDto) => {
    setEditingRole(role);
    setRoleForm({
      roleCode: role.roleCode,
      roleName: role.roleName,
      description: role.description ?? "",
      permissions: role.permissions,
    });
    setRoleOpen(true);
  };

  const submitRole = async () => {
    if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã role và tên role." });
      return;
    }
    setSending(true);
    try {
      if (editingRole) {
        await roleApi.update(editingRole.roleCode, {
          roleName: roleForm.roleName,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        });
        notify({ ok: true, message: "Đã cập nhật role." });
      } else {
        await roleApi.create({
          roleCode: roleForm.roleCode,
          roleName: roleForm.roleName,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        });
        notify({ ok: true, message: "Đã tạo role." });
      }
      setRoleOpen(false);
      loadRoles();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ quản trị role." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const toggleRoleActive = async (role: RoleDto) => {
    try {
      await roleApi.setActive(role.roleCode, !role.isActive);
      notify({ ok: true, message: role.isActive ? "Đã khóa role." : "Đã mở role." });
      loadRoles();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const openCreatePermission = () => {
    setEditingPermission(null);
    setPermissionForm({ permissionCode: "", permissionName: "", module: "", description: "" });
    setPermissionOpen(true);
  };

  const openEditPermission = (permission: PermissionDto) => {
    setEditingPermission(permission);
    setPermissionForm({
      permissionCode: permission.permissionCode,
      permissionName: permission.permissionName,
      module: permission.module,
      description: permission.description ?? "",
    });
    setPermissionOpen(true);
  };

  const submitPermission = async () => {
    if (!permissionForm.permissionCode.match(/^[a-z]+(\.[a-z]+)+$/i)) {
      notify({ ok: false, message: "Mã quyền cần có dạng module.action." });
      return;
    }
    setSending(true);
    try {
      if (editingPermission) {
        await permissionApi.update(editingPermission.permissionCode, {
          permissionName: permissionForm.permissionName,
          module: permissionForm.module,
          description: permissionForm.description || undefined,
        });
        notify({ ok: true, message: "Đã cập nhật permission." });
      } else {
        await permissionApi.create({
          permissionCode: permissionForm.permissionCode,
          permissionName: permissionForm.permissionName,
          module: permissionForm.module,
          description: permissionForm.description || undefined,
        });
        notify({ ok: true, message: "Đã tạo permission." });
      }
      setPermissionOpen(false);
      loadPermissions();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ quản trị permission." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const togglePermissionActive = async (permission: PermissionDto) => {
    try {
      await permissionApi.setActive(permission.permissionCode, !permission.isActive);
      notify({ ok: true, message: permission.isActive ? "Đã khóa permission." : "Đã mở permission." });
      loadPermissions();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản trị hệ thống"
        description="Quản lý menu, vai trò và quyền tập trung tại một nơi."
        action={
          tab === "menus" && !menusUnavailable ? (
            <Button appearance="primary" icon={<AddRegular />} onClick={openCreateMenu}>
              Tạo menu
            </Button>
          ) : tab === "roles" && !rolesUnavailable ? (
            <Button appearance="primary" icon={<AddRegular />} onClick={openCreateRole}>
              Tạo role
            </Button>
          ) : tab === "permissions" && !permissionsUnavailable ? (
            <Button appearance="primary" icon={<AddRegular />} onClick={openCreatePermission}>
              Tạo permission
            </Button>
          ) : null
        }
      />

      <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as AdminSystemTab)}>
        <Tab value="menus">Menu</Tab>
        <Tab value="roles">Vai trò</Tab>
        <Tab value="permissions">Quyền</Tab>
      </TabList>

      {tab === "menus" ? (
        <SectionPanel title="Cấu hình menu">
          {loadingMenus ? (
            <Spinner label="Đang tải menu..." />
          ) : menusUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API menu. Trang này chỉ dành cho cấu hình menu và phân quyền." />
          ) : menus.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã menu</th>
                    <th>Tên menu</th>
                    <th>Đường dẫn</th>
                    <th>Quyền</th>
                    <th>Thứ tự</th>
                    <th>Hiển thị</th>
                    <th>Kích hoạt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {menus.map((menu) => (
                    <tr key={menu.menuCode}>
                      <td>{menu.menuCode}</td>
                      <td>{menu.menuName}</td>
                      <td>{menu.route}</td>
                      <td>{joinCodes(menu.permissions) || "--"}</td>
                      <td>{menu.displayOrder}</td>
                      <td>
                        <Switch checked={menu.isVisible} aria-label={`Hiển thị ${menu.menuName}`} onChange={() => toggleMenuVisible(menu)} />
                      </td>
                      <td>
                        <Switch checked={menu.isActive} aria-label={`Kích hoạt ${menu.menuName}`} onChange={() => toggleMenuActive(menu)} />
                      </td>
                      <td>
                        <Button size="small" onClick={() => openEditMenu(menu)}>
                          Sửa
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có menu" description="Tạo menu để backend điều khiển navigation theo quyền." />
          )}
        </SectionPanel>
      ) : null}

      {tab === "roles" ? (
        <SectionPanel title="Cấu hình vai trò">
          {loadingRoles ? (
            <Spinner label="Đang tải roles..." />
          ) : rolesUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API role. UI đã sẵn sàng và sẽ bật thao tác khi endpoint khả dụng." />
          ) : roles.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã role</th>
                    <th>Tên role</th>
                    <th>Quyền</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.roleCode}>
                      <td>{role.roleCode}</td>
                      <td>{role.roleName}</td>
                      <td>{role.permissions.length} quyền</td>
                      <td>
                        <Badge appearance="tint" color={role.isActive ? "success" : "danger"}>
                          {role.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button size="small" onClick={() => openEditRole(role)}>
                            Sửa
                          </Button>
                          <Button size="small" onClick={() => toggleRoleActive(role)}>
                            {role.isActive ? "Khóa" : "Mở"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có role" description="Tạo role để gán permission cho tài khoản." />
          )}
        </SectionPanel>
      ) : null}

      {tab === "permissions" ? (
        <SectionPanel title="Danh mục quyền">
          {loadingPermissions ? (
            <Spinner label="Đang tải permissions..." />
          ) : permissionsUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API permission. UI đã sẵn sàng và sẽ bật thao tác khi endpoint khả dụng." />
          ) : permissions.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã permission</th>
                    <th>Tên</th>
                    <th>Phân hệ</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission) => (
                    <tr key={permission.permissionCode}>
                      <td>{permission.permissionCode}</td>
                      <td>{permission.permissionName}</td>
                      <td>{permission.module}</td>
                      <td>
                        <Badge appearance="tint" color={permission.isActive ? "success" : "danger"}>
                          {permission.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button size="small" onClick={() => openEditPermission(permission)}>
                            Sửa
                          </Button>
                          <Button size="small" onClick={() => togglePermissionActive(permission)}>
                            {permission.isActive ? "Khóa" : "Mở"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có permission" description="Tạo permission theo dạng module.action." />
          )}
        </SectionPanel>
      ) : null}

      <Dialog open={menuOpen} onOpenChange={(_, data) => setMenuOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingMenu ? "Sửa menu" : "Tạo menu"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã menu" required>
                  <Input
                    value={menuForm.menuCode}
                    disabled={Boolean(editingMenu)}
                    onChange={(_, data) => setMenuForm((value) => ({ ...value, menuCode: data.value }))}
                  />
                </Field>
                <Field label="Tên menu" required>
                  <Input value={menuForm.menuName} onChange={(_, data) => setMenuForm((value) => ({ ...value, menuName: data.value }))} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Biểu tượng">
                  <Input value={menuForm.icon} onChange={(_, data) => setMenuForm((value) => ({ ...value, icon: data.value }))} />
                </Field>
                <Field label="Đường dẫn" required>
                  <Input value={menuForm.route} onChange={(_, data) => setMenuForm((value) => ({ ...value, route: data.value }))} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Thứ tự">
                  <Input
                    type="number"
                    value={String(menuForm.displayOrder)}
                    onChange={(_, data) => setMenuForm((value) => ({ ...value, displayOrder: Number(data.value) }))}
                  />
                </Field>
                <Field label="Mã quyền" hint="Quyền quyết định ai thấy menu này, phân tách bằng dấu phẩy.">
                  <Input value={menuForm.permissions} onChange={(_, data) => setMenuForm((value) => ({ ...value, permissions: data.value }))} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setMenuOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitMenu} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={(_, data) => setRoleOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingRole ? "Sửa role" : "Tạo role"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã role" required>
                  <Input
                    value={roleForm.roleCode}
                    disabled={Boolean(editingRole)}
                    onChange={(_, data) => setRoleForm((value) => ({ ...value, roleCode: data.value }))}
                  />
                </Field>
                <Field label="Tên role" required>
                  <Input value={roleForm.roleName} onChange={(_, data) => setRoleForm((value) => ({ ...value, roleName: data.value }))} />
                </Field>
              </div>
              <Field label="Mô tả">
                <Textarea value={roleForm.description} onChange={(_, data) => setRoleForm((value) => ({ ...value, description: data.value }))} />
              </Field>
              <Field label="Menu và quyền">
                <PermissionGroupEditor
                  permissions={permissions}
                  selected={roleForm.permissions}
                  onChange={(codes) => setRoleForm((value) => ({ ...value, permissions: codes }))}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRoleOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitRole} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={permissionOpen} onOpenChange={(_, data) => setPermissionOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingPermission ? "Sửa permission" : "Tạo permission"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã quyền" required>
                  <Input
                    value={permissionForm.permissionCode}
                    disabled={Boolean(editingPermission)}
                    onChange={(_, data) => setPermissionForm((value) => ({ ...value, permissionCode: data.value }))}
                  />
                </Field>
                <Field label="Tên permission" required>
                  <Input
                    value={permissionForm.permissionName}
                    onChange={(_, data) => setPermissionForm((value) => ({ ...value, permissionName: data.value }))}
                  />
                </Field>
              </div>
              <Field label="Phân hệ" required>
                {moduleOptions.length ? (
                  <Dropdown
                    value={permissionForm.module}
                    selectedOptions={[permissionForm.module]}
                    onOptionSelect={(_, data) => setPermissionForm((value) => ({ ...value, module: data.optionValue ?? "" }))}
                  >
                    {moduleOptions.map((item) => (
                      <Option key={item} value={item} text={item}>
                        {item}
                      </Option>
                    ))}
                  </Dropdown>
                ) : (
                  <Input value={permissionForm.module} onChange={(_, data) => setPermissionForm((value) => ({ ...value, module: data.value }))} />
                )}
              </Field>
              <Field label="Mô tả">
                <Textarea value={permissionForm.description} onChange={(_, data) => setPermissionForm((value) => ({ ...value, description: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPermissionOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitPermission} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

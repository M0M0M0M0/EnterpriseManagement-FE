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
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import { AddRegular, ArrowClockwiseRegular, CopyRegular, EyeOffRegular, EyeRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import {
  customerApi,
  departmentApi,
  employeeApi,
  payrollApi,
  positionApi,
  userApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import type {
  CustomerDto,
  DepartmentDto,
  EmployeeDto,
  PositionDto,
  SalaryCalculationResult,
  UserDto,
} from "../types/domain";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";

export function AdminUsersPage() {
  const notify = useNotify();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    roleCode: "EMPLOYEE",
    employeeCode: "",
  });
  const [credential, setCredential] = useState<{ username: string; password: string; isReset: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const load = () => {
    setLoading(true);
    userApi
      .getAll()
      .then(setUsers)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!form.username.trim() || !form.email.trim()) {
      notify({ ok: false, message: "Vui lòng nhập đủ tên đăng nhập và email." });
      return;
    }
    setSending(true);
    try {
      const result = await userApi.create({ ...form, employeeCode: form.employeeCode || undefined });
      setOpen(false);
      setForm({ username: "", email: "", roleCode: "EMPLOYEE", employeeCode: "" });
      setShowPassword(false);
      setCredential({ username: result.user.username, password: result.generatedPassword, isReset: false });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const copyCredential = async () => {
    if (!credential) return;
    const text = `Tên đăng nhập: ${credential.username}\nMật khẩu: ${credential.password}`;
    try {
      await navigator.clipboard.writeText(text);
      notify({ ok: true, message: "Đã sao chép thông tin đăng nhập." });
    } catch {
      notify({ ok: false, message: "Không thể sao chép tự động, vui lòng copy thủ công." });
    }
  };

  const toggleActive = async (user: UserDto) => {
    try {
      await userApi.setActive(user.username, !user.isActive);
      notify({ ok: true, message: user.isActive ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const [resettingUsername, setResettingUsername] = useState<string | null>(null);

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

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý User / Role / Permission"
        description="Tạo tài khoản và gán vai trò (ADMIN / MANAGER / EMPLOYEE)."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
            Tạo tài khoản
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : users.length ? (
        <div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Email</th>
                <th>Mã NV</th>
                <th>Vai trò</th>
                <th>Đăng nhập gần nhất</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.employeeCode ?? "--"}</td>
                  <td>{u.roles.join(", ")}</td>
                  <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "--"}</td>
                  <td>
                    <Badge appearance="tint" color={u.isActive ? "success" : "danger"}>
                      {u.isActive ? "Đang hoạt động" : "Đã khóa"}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button size="small" onClick={() => toggleActive(u)}>
                        {u.isActive ? "Khóa" : "Mở khóa"}
                      </Button>
                      <Button
                        size="small"
                        icon={<ArrowClockwiseRegular />}
                        disabled={resettingUsername === u.username}
                        onClick={() => resetPassword(u)}
                      >
                        {resettingUsername === u.username ? <Spinner size="tiny" /> : "Đặt lại mật khẩu"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có tài khoản" description="Tạo tài khoản đầu tiên cho hệ thống." />
      )}

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tạo tài khoản mới</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Tên đăng nhập" required>
                  <Input value={form.username} onChange={(_, data) => setForm((v) => ({ ...v, username: data.value }))} />
                </Field>
                <Field label="Email" required>
                  <Input value={form.email} onChange={(_, data) => setForm((v) => ({ ...v, email: data.value }))} />
                </Field>
              </div>
              <div className="info-banner">
                <Badge appearance="tint" color="informative">
                  Tự động
                </Badge>
                <div>
                  <strong>Mật khẩu sẽ được hệ thống tạo tự động</strong>
                  <p>Sau khi tạo tài khoản, bạn sẽ nhận được mật khẩu để gửi cho nhân viên đăng nhập lần đầu.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Vai trò" required>
                  <Dropdown
                    value={form.roleCode}
                    selectedOptions={[form.roleCode]}
                    onOptionSelect={(_, data) => setForm((v) => ({ ...v, roleCode: data.optionValue ?? "EMPLOYEE" }))}
                  >
                    <Option value="ADMIN">ADMIN</Option>
                    <Option value="MANAGER">MANAGER</Option>
                    <Option value="EMPLOYEE">EMPLOYEE</Option>
                  </Dropdown>
                </Field>
                <Field label="Mã nhân viên liên kết (nếu có)">
                  <Input value={form.employeeCode} onChange={(_, data) => setForm((v) => ({ ...v, employeeCode: data.value }))} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Tạo tài khoản"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={!!credential} onOpenChange={(_, data) => !data.open && setCredential(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{credential?.isReset ? "Đã đặt lại mật khẩu" : "Đã tạo tài khoản"}</DialogTitle>
            <DialogContent className="form-stack">
              <p>Gửi thông tin đăng nhập dưới đây cho nhân viên. Mật khẩu chỉ hiển thị một lần.</p>
              <dl className="detail-list">
                <div>
                  <dt>Tên đăng nhập</dt>
                  <dd>
                    <strong>{credential?.username}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Mật khẩu</dt>
                  <dd className="credential-password-row">
                    <strong className="credential-password">
                      {showPassword ? credential?.password : "•".repeat(credential?.password.length ?? 10)}
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
            </DialogContent>
            <DialogActions>
              <Button icon={<CopyRegular />} onClick={copyCredential}>
                Sao chép
              </Button>
              <Button appearance="primary" onClick={() => setCredential(null)}>
                Đã gửi cho nhân viên
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function AdminEmployeesPage() {
  const notify = useNotify();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "Male",
    departmentCode: "",
    positionCode: "",
    managerCode: "",
    hireDate: formatDate(new Date().toISOString(), "yyyy-MM-dd"),
  });

  const load = () => {
    setLoading(true);
    Promise.all([employeeApi.getAll(), departmentApi.getAll(), positionApi.getAll()])
      .then(([e, d, p]) => {
        setEmployees(e);
        setDepartments(d);
        setPositions(p);
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

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.departmentCode || !form.positionCode) {
      notify({ ok: false, message: "Vui lòng nhập đủ họ tên, phòng ban, chức vụ." });
      return;
    }
    setSending(true);
    try {
      await employeeApi.create({
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        managerCode: form.managerCode || undefined,
      });
      notify({ ok: true, message: "Đã thêm nhân viên mới." });
      setOpen(false);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const toggleActive = async (employee: EmployeeDto) => {
    try {
      await employeeApi.setActive(employee.employeeCode, employee.employmentStatus !== "Active");
      notify({ ok: true, message: "Đã cập nhật trạng thái nhân viên." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý nhân viên"
        description="Tạo nhân viên mới, khóa/mở tài khoản làm việc."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setOpen(true)}>
            Thêm nhân viên
          </Button>
        }
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
                <th>Phòng ban</th>
                <th>Chức vụ</th>
                <th>Quản lý</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.employeeCode}>
                  <td>{e.employeeCode}</td>
                  <td>{e.fullName}</td>
                  <td>{e.departmentName}</td>
                  <td>{e.positionName}</td>
                  <td>{e.managerCode ?? "--"}</td>
                  <td>
                    <Badge appearance="tint" color={e.employmentStatus === "Active" ? "success" : "subtle"}>
                      {e.employmentStatus}
                    </Badge>
                  </td>
                  <td>
                    <Button size="small" onClick={() => toggleActive(e)}>
                      {e.employmentStatus === "Active" ? "Khóa" : "Mở khóa"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có nhân viên" description="Thêm nhân viên đầu tiên cho hệ thống." />
      )}

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Thêm nhân viên mới</DialogTitle>
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
                <Field label="Email">
                  <Input value={form.email} onChange={(_, data) => setForm((v) => ({ ...v, email: data.value }))} />
                </Field>
                <Field label="Điện thoại">
                  <Input value={form.phone} onChange={(_, data) => setForm((v) => ({ ...v, phone: data.value }))} />
                </Field>
              </div>
              <Field label="Địa chỉ">
                <Input value={form.address} onChange={(_, data) => setForm((v) => ({ ...v, address: data.value }))} />
              </Field>
              <div className="form-grid">
                <Field label="Ngày sinh">
                  <Input type="date" value={form.dateOfBirth} onChange={(_, data) => setForm((v) => ({ ...v, dateOfBirth: data.value }))} />
                </Field>
                <Field label="Giới tính">
                  <Dropdown
                    value={form.gender}
                    selectedOptions={[form.gender]}
                    onOptionSelect={(_, data) => setForm((v) => ({ ...v, gender: data.optionValue ?? "Male" }))}
                  >
                    <Option value="Male">Nam</Option>
                    <Option value="Female">Nữ</Option>
                    <Option value="Other">Khác</Option>
                  </Dropdown>
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Phòng ban" required>
                  <Dropdown
                    value={departments.find((d) => d.departmentCode === form.departmentCode)?.departmentName ?? ""}
                    selectedOptions={[form.departmentCode]}
                    onOptionSelect={(_, data) => setForm((v) => ({ ...v, departmentCode: data.optionValue ?? "" }))}
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
                    onOptionSelect={(_, data) => setForm((v) => ({ ...v, positionCode: data.optionValue ?? "" }))}
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
                <Field label="Mã quản lý trực tiếp (nếu có)">
                  <Input value={form.managerCode} onChange={(_, data) => setForm((v) => ({ ...v, managerCode: data.value }))} />
                </Field>
                <Field label="Ngày vào làm" required>
                  <Input type="date" value={form.hireDate} onChange={(_, data) => setForm((v) => ({ ...v, hireDate: data.value }))} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Thêm nhân viên"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function AdminOrganizationPage() {
  const notify = useNotify();
  const [tab, setTab] = useState("departments");
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptOpen, setDeptOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ departmentCode: "", departmentName: "", description: "" });
  const [posForm, setPosForm] = useState({ positionCode: "", positionName: "", description: "" });

  const load = () => {
    setLoading(true);
    Promise.all([departmentApi.getAll(), positionApi.getAll()])
      .then(([d, p]) => {
        setDepartments(d);
        setPositions(p);
      })
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

  const toggleDepartment = async (d: DepartmentDto) => {
    try {
      await departmentApi.setActive(d.departmentCode, !d.isActive);
      notify({ ok: true, message: "Đã cập nhật trạng thái phòng ban." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const createPosition = async () => {
    if (!posForm.positionCode.trim() || !posForm.positionName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã và tên chức vụ." });
      return;
    }
    try {
      await positionApi.create(posForm);
      notify({ ok: true, message: "Đã thêm chức vụ." });
      setPosOpen(false);
      setPosForm({ positionCode: "", positionName: "", description: "" });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
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

  return (
    <div className="page-stack">
      <PageHeader
        title="Phòng ban & chức vụ"
        description="Toàn quyền tạo, sửa, khóa/mở phòng ban và chức vụ."
        action={
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
            <Tab value="departments">Phòng ban</Tab>
            <Tab value="positions">Chức vụ</Tab>
          </TabList>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : tab === "departments" ? (
        <SectionPanel
          title="Danh sách phòng ban"
          action={
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setDeptOpen(true)}>
              Thêm phòng ban
            </Button>
          }
        >
          <div className="compact-list">
            {departments.map((d) => (
              <div className="compact-row" key={d.departmentCode}>
                <div>
                  <strong>{d.departmentName}</strong>
                  <span>{d.departmentCode} · {d.managerName ?? "Chưa có quản lý"}</span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={d.isActive ? "success" : "subtle"}>
                    {d.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                  <Button size="small" onClick={() => toggleDepartment(d)}>
                    {d.isActive ? "Khóa" : "Mở khóa"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      ) : (
        <SectionPanel
          title="Danh sách chức vụ"
          action={
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setPosOpen(true)}>
              Thêm chức vụ
            </Button>
          }
        >
          <div className="compact-list">
            {positions.map((p) => (
              <div className="compact-row" key={p.positionCode}>
                <div>
                  <strong>{p.positionName}</strong>
                  <span>{p.positionCode} · {p.standardSalary ? formatCurrency(p.standardSalary) : "Chưa có lương chuẩn"}</span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={p.isActive ? "success" : "subtle"}>
                    {p.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                  <Button size="small" onClick={() => togglePosition(p)}>
                    {p.isActive ? "Khóa" : "Mở khóa"}
                  </Button>
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
              <Button onClick={() => setDeptOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={createDepartment}>
                Thêm mới
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={posOpen} onOpenChange={(_, data) => setPosOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Thêm chức vụ</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Mã chức vụ" required>
                <Input value={posForm.positionCode} onChange={(_, data) => setPosForm((v) => ({ ...v, positionCode: data.value }))} />
              </Field>
              <Field label="Tên chức vụ" required>
                <Input value={posForm.positionName} onChange={(_, data) => setPosForm((v) => ({ ...v, positionName: data.value }))} />
              </Field>
              <Field label="Mô tả">
                <Textarea resize="vertical" value={posForm.description} onChange={(_, data) => setPosForm((v) => ({ ...v, description: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPosOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={createPosition}>
                Thêm mới
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function AdminCustomersPage() {
  const notify = useNotify();
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    customerApi
      .getAll()
      .then(setCustomers)
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-stack">
      <PageHeader title="Quản lý khách hàng" description="Xem toàn bộ khách hàng trong hệ thống." />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : customers.length ? (
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
              {customers.map((c) => (
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
        <EmptyState title="Chưa có khách hàng" description="Danh sách sẽ cập nhật khi có khách hàng mới." />
      )}
      <SectionPanel title="Gộp khách hàng trùng lặp">
        <div className="info-banner">
          <Badge appearance="tint" color="informative">
            Chưa khả dụng
          </Badge>
          <div>
            <strong>Backend chưa có API merge khách hàng</strong>
            <p>Chức năng gộp khách hàng trùng lặp sẽ được bật khi backend bổ sung API tương ứng.</p>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}

export function AdminAuditLogPage() {
  return (
    <div className="page-stack">
      <PageHeader title="Audit Log" description="Lịch sử thao tác toàn hệ thống (chỉ xem)." />
      <SectionPanel>
        <EmptyState
          title="Chưa khả dụng"
          description="Backend hiện chưa cung cấp API audit log. Trang này sẽ hiển thị dữ liệu khi API sẵn sàng."
        />
      </SectionPanel>
    </div>
  );
}

export function AdminSystemPage() {
  return (
    <div className="page-stack">
      <PageHeader title="System Administration" description="Cấu hình menu, permission mapping." />
      <SectionPanel>
        <EmptyState
          title="Chưa khả dụng"
          description="Backend hiện chưa cung cấp API cấu hình menu/permission. Trang này sẽ hiển thị khi API sẵn sàng."
        />
      </SectionPanel>
    </div>
  );
}

export function AdminPayrollPage() {
  const notify = useNotify();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const now = new Date();
  const [form, setForm] = useState({
    employeeCode: "",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [result, setResult] = useState<SalaryCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    employeeApi.getAll().then((list) => {
      setEmployees(list);
      setForm((v) => ({ ...v, employeeCode: v.employeeCode || list[0]?.employeeCode || "" }));
    }).catch(() => undefined);
  }, []);

  const calculate = async () => {
    if (!form.employeeCode) {
      notify({ ok: false, message: "Vui lòng chọn nhân viên." });
      return;
    }
    setLoading(true);
    try {
      const data = await payrollApi.calculate(form.employeeCode, form.year, form.month);
      setResult(data);
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader title="Bảng lương" description="Tính lương theo nhân viên và kỳ lương." />
      <SectionPanel>
        <div className="filter-grid">
          <Field label="Nhân viên">
            <Dropdown
              value={employees.find((e) => e.employeeCode === form.employeeCode)?.fullName ?? ""}
              selectedOptions={[form.employeeCode]}
              onOptionSelect={(_, data) => setForm((v) => ({ ...v, employeeCode: data.optionValue ?? "" }))}
            >
              {employees.map((e) => (
                <Option key={e.employeeCode} value={e.employeeCode}>
                  {e.fullName}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Năm">
            <Input
              type="number"
              value={String(form.year)}
              onChange={(_, data) => setForm((v) => ({ ...v, year: Number(data.value) }))}
            />
          </Field>
          <Field label="Tháng">
            <Input
              type="number"
              min={1}
              max={12}
              value={String(form.month)}
              onChange={(_, data) => setForm((v) => ({ ...v, month: Number(data.value) }))}
            />
          </Field>
          <Button appearance="primary" onClick={calculate} disabled={loading}>
            {loading ? <Spinner size="tiny" /> : "Tính lương"}
          </Button>
        </div>
      </SectionPanel>
      {result ? (
        <SectionPanel title={`Kết quả kỳ ${result.month}/${result.year}`}>
          <dl className="detail-list">
            <div>
              <dt>Lương cơ bản</dt>
              <dd>{formatCurrency(result.baseSalary)}</dd>
            </div>
            <div>
              <dt>Ngày công chuẩn</dt>
              <dd>{result.standardWorkingDays} ngày</dd>
            </div>
            <div>
              <dt>Ngày bị trừ</dt>
              <dd>{result.deductedDays} ngày</dd>
            </div>
            <div>
              <dt>Đơn giá ngày công</dt>
              <dd>{formatCurrency(result.dailyRate)}</dd>
            </div>
            <div>
              <dt>Số tiền bị trừ</dt>
              <dd>{formatCurrency(result.deductionAmount)}</dd>
            </div>
            <div>
              <dt>Lương thực nhận</dt>
              <dd>
                <strong>{formatCurrency(result.netSalary)}</strong>
              </dd>
            </div>
          </dl>
        </SectionPanel>
      ) : null}
    </div>
  );
}

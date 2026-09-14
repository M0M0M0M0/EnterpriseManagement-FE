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
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import { AddRegular, CopyRegular, EyeOffRegular, EyeRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { ConfirmDialog, EmptyState, FieldError, MetricRail, PageHeader, RequestBadge, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import {
  customerApi,
  departmentApi,
  employeeApi,
  positionApi,
  saleApi,
  userApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import type {
  CustomerDto,
  DepartmentDto,
  EmployeeDto,
  PositionDto,
  SaleDto,
  UserDto,
} from "../types/domain";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";

const NO_MANAGER = "__none__";

export function AdminEmployeesPage() {
  const notify = useNotify();
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDto | null>(null);
  const [sending, setSending] = useState(false);
  const [managerQuery, setManagerQuery] = useState("");

  // Tài khoản đăng nhập gắn theo mã nhân viên — chỉ để biết hồ sơ nào đã có tài khoản,
  // quyết định hiện nút "Tạo tài khoản" hay "Quản lý tài khoản". Muốn tạo thêm tài khoản
  // thứ 2 cho cùng 1 nhân viên thì phải vào thẳng trang Users tạo thủ công, trang này chỉ
  // hỗ trợ tạo nhanh khi nhân viên chưa có tài khoản nào.
  const [usersByEmployee, setUsersByEmployee] = useState<Record<string, UserDto[]>>({});
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountEmployee, setAccountEmployee] = useState<EmployeeDto | null>(null);
  const [accountForm, setAccountForm] = useState({ username: "", email: "" });
  const [accountSending, setAccountSending] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageEmployee, setManageEmployee] = useState<EmployeeDto | null>(null);
  const [togglingUsername, setTogglingUsername] = useState<string | null>(null);
  const [resettingUsername, setResettingUsername] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [lockEmployeeTarget, setLockEmployeeTarget] = useState<EmployeeDto | null>(null);
  const [lockingEmployee, setLockingEmployee] = useState(false);
  const [lockAccountTarget, setLockAccountTarget] = useState<UserDto | null>(null);
  const [lockingAccount, setLockingAccount] = useState(false);

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

  const loadUsers = () => {
    userApi
      .getAll()
      .then((list) => {
        const map: Record<string, UserDto[]> = {};
        for (const user of list) {
          if (!user.employeeCode) continue;
          (map[user.employeeCode] ??= []).push(user);
        }
        setUsersByEmployee(map);
      })
      .catch(() => setUsersByEmployee({}));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadUsers, []); // eslint-disable-line react-hooks/exhaustive-deps

  const managerLabel = (e: EmployeeDto) => `${e.fullName} (${e.employeeCode})`;

  const openCreate = () => {
    setEditing(null);
    setManagerQuery("");
    setForm((v) => ({
      ...v,
      firstName: "",
      lastName: "",
      email: "",
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
    const currentManager = employees.find((e) => e.employeeCode === employee.managerCode);
    setManagerQuery(currentManager ? managerLabel(currentManager) : "");
    setForm((v) => ({
      ...v,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? "",
      address: employee.address ?? "",
      departmentCode: employee.departmentCode,
      positionCode: employee.positionCode,
      managerCode: employee.managerCode ?? "",
    }));
    setOpen(true);
  };

  const positionByCode = new Map(positions.map((p) => [p.positionCode, p]));

  // Gợi ý quản lý trực tiếp mặc định: tìm bậc liền trên (rankLevel nhỏ hơn, gần nhất)
  // trong cùng phòng ban. Chỉ tự điền khi bậc đó có đúng 1 người, để tránh chọn nhầm.
  // Trưởng phòng (bậc cao nhất, không có bậc nào nhỏ hơn) thì không gợi ý gì.
  const suggestManagerFor = (departmentCode: string, positionCode: string) => {
    const rank = positionByCode.get(positionCode)?.rankLevel;
    if (rank === undefined) return undefined;
    const isTop = !positions.some((p) => p.rankLevel < rank);
    if (isTop) return undefined;
    const higherRanks = positions.map((p) => p.rankLevel).filter((r) => r < rank);
    if (!higherRanks.length) return undefined;
    const nextRank = Math.max(...higherRanks);
    const candidates = employees.filter(
      (e) =>
        e.departmentCode === departmentCode &&
        e.employmentStatus !== "Terminated" &&
        positionByCode.get(e.positionCode)?.rankLevel === nextRank,
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const selectDepartment = (departmentCode: string) => {
    setForm((v) => {
      const managerStillValid = employees.some(
        (e) => e.employeeCode === v.managerCode && e.departmentCode === departmentCode,
      );
      if (managerStillValid) return { ...v, departmentCode };
      const suggestion = suggestManagerFor(departmentCode, v.positionCode);
      setManagerQuery(suggestion ? managerLabel(suggestion) : "");
      return { ...v, departmentCode, managerCode: suggestion?.employeeCode ?? "" };
    });
  };

  const selectPosition = (positionCode: string) => {
    setForm((v) => {
      if (v.managerCode) return { ...v, positionCode };
      const suggestion = suggestManagerFor(v.departmentCode, positionCode);
      if (!suggestion) return { ...v, positionCode };
      setManagerQuery(managerLabel(suggestion));
      return { ...v, positionCode, managerCode: suggestion.employeeCode };
    });
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

  const submit = async () => {
    if (!form.departmentCode || !form.positionCode) {
      notify({ ok: false, message: "Vui lòng chọn phòng ban và chức vụ." });
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập đủ họ tên." });
      return;
    }
    setSending(true);
    try {
      if (editing) {
        await employeeApi.update(editing.employeeCode, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          address: form.address || undefined,
          departmentCode: form.departmentCode,
          positionCode: form.positionCode,
          managerCode: form.managerCode || undefined,
        });
        notify({ ok: true, message: "Đã cập nhật hồ sơ nhân viên." });
      } else {
        await employeeApi.create({
          ...form,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          managerCode: form.managerCode || undefined,
        });
        notify({ ok: true, message: "Đã thêm nhân viên mới." });
      }
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

  // Cho nghỉ việc là hành động có rủi ro (khóa truy cập, ảnh hưởng chấm công/nghỉ phép của
  // nhân viên) nên cần xác nhận trước — phục hồi lại thì bấm là chạy luôn.
  const confirmLockEmployee = async () => {
    if (!lockEmployeeTarget) return;
    setLockingEmployee(true);
    try {
      await toggleActive(lockEmployeeTarget);
      setLockEmployeeTarget(null);
    } finally {
      setLockingEmployee(false);
    }
  };

  const openCreateAccount = (employee: EmployeeDto) => {
    setAccountEmployee(employee);
    setAccountForm({ username: employee.employeeCode.toLowerCase(), email: employee.email ?? "" });
    setShowPassword(false);
    setAccountOpen(true);
  };

  const submitAccount = async () => {
    if (!accountEmployee) return;
    if (!accountForm.username.trim() || !accountForm.email.trim()) {
      notify({ ok: false, message: "Vui lòng nhập đủ tên đăng nhập và email." });
      return;
    }
    setAccountSending(true);
    try {
      const result = await userApi.create({
        username: accountForm.username.trim(),
        email: accountForm.email.trim(),
        employeeCode: accountEmployee.employeeCode,
      });
      setShowPassword(false);
      setCredential({ username: result.user.username, password: result.generatedPassword });
      notify({ ok: true, message: "Đã tạo tài khoản." });
      setAccountOpen(false);
      loadUsers();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setAccountSending(false);
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

  const openManageAccounts = (employee: EmployeeDto) => {
    setManageEmployee(employee);
    setManageOpen(true);
  };

  const toggleAccountActive = async (user: UserDto) => {
    setTogglingUsername(user.username);
    try {
      await userApi.setActive(user.username, !user.isActive);
      notify({ ok: true, message: user.isActive ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản." });
      loadUsers();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setTogglingUsername(null);
    }
  };

  const confirmLockAccount = async () => {
    if (!lockAccountTarget) return;
    setLockingAccount(true);
    try {
      await toggleAccountActive(lockAccountTarget);
      setLockAccountTarget(null);
    } finally {
      setLockingAccount(false);
    }
  };

  const resetAccountPassword = async (user: UserDto) => {
    setResettingUsername(user.username);
    try {
      const result = await userApi.resetPassword(user.username);
      setShowPassword(false);
      setCredential({ username: result.user.username, password: result.generatedPassword });
      notify({ ok: true, message: "Đã đặt lại mật khẩu." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setResettingUsername(null);
    }
  };

  // Ứng viên quản lý: cùng phòng ban đã chọn, chưa nghỉ việc, không phải chính mình.
  const departmentManagerCandidates = employees.filter(
    (e) =>
      e.departmentCode === form.departmentCode &&
      e.employmentStatus !== "Terminated" &&
      e.employeeCode !== editing?.employeeCode,
  );
  // Khi chưa gõ tìm kiếm, chỉ gợi ý người ở bậc liền trên (vd Nhân viên -> chỉ thấy Quản lý,
  // không thấy Trưởng/Phó phòng). Trưởng phòng (bậc cao nhất) thì không gợi ý ai.
  // Gõ tìm kiếm sẽ mở rộng ra xem được tất cả các bậc trong phòng ban.
  // Chỉ áp dụng logic này khi các chức vụ đã thực sự được set Cấp bậc khác nhau — nếu tất
  // cả chức vụ đang cùng 1 mức (vd chưa ai chỉnh, mặc định 0 hết) thì không đủ dữ liệu để
  // so sánh cao/thấp, cứ hiện toàn bộ người cùng phòng ban cho đơn giản.
  const ranksConfigured = new Set(positions.map((p) => p.rankLevel)).size > 1;
  const selectedRank = positionByCode.get(form.positionCode)?.rankLevel;
  const isTopRank = ranksConfigured && selectedRank !== undefined && !positions.some((p) => p.rankLevel < selectedRank);
  const higherRanks = ranksConfigured && selectedRank !== undefined ? positions.map((p) => p.rankLevel).filter((r) => r < selectedRank) : [];
  const nextHigherRank = higherRanks.length ? Math.max(...higherRanks) : undefined;
  const tierCandidates =
    nextHigherRank !== undefined
      ? departmentManagerCandidates.filter((e) => positionByCode.get(e.positionCode)?.rankLevel === nextHigherRank)
      : [];
  const defaultManagerCandidates = !ranksConfigured
    ? departmentManagerCandidates
    : isTopRank
      ? []
      : tierCandidates.length
        ? tierCandidates
        : departmentManagerCandidates;

  // Vẫn giữ quản lý hiện tại của hồ sơ (nếu có) trong danh sách hiển thị, dù người đó
  // khác bậc hoặc khác phòng ban, để mở form Sửa không làm mất lựa chọn đang có sẵn.
  const currentManager = editing?.managerCode
    ? employees.find((e) => e.employeeCode === editing.managerCode)
    : undefined;
  const managerSearch = managerQuery.trim().toLowerCase();
  const visibleCandidates = managerSearch ? departmentManagerCandidates : defaultManagerCandidates;
  const managerCandidates =
    currentManager && !visibleCandidates.some((e) => e.employeeCode === currentManager.employeeCode)
      ? [currentManager, ...visibleCandidates]
      : visibleCandidates;
  const filteredManagerCandidates = managerSearch
    ? managerCandidates.filter(
        (e) => e.fullName.toLowerCase().includes(managerSearch) || e.employeeCode.toLowerCase().includes(managerSearch),
      )
    : managerCandidates;

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý nhân viên"
        description="Tạo nhân viên mới, sửa phòng ban/chức vụ/quản lý, khóa/mở tài khoản làm việc."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={openCreate}>
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
                  <td>{employees.find((m) => m.employeeCode === e.managerCode)?.fullName ?? e.managerCode ?? "--"}</td>
                  <td>
                    <Badge appearance="tint" color={e.employmentStatus === "Active" ? "success" : "subtle"}>
                      {e.employmentStatus}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button size="small" onClick={() => openEdit(e)}>
                        Sửa
                      </Button>
                      <Button
                        size="small"
                        onClick={() =>
                          e.employmentStatus === "Active" ? setLockEmployeeTarget(e) : toggleActive(e)
                        }
                      >
                        {e.employmentStatus === "Active" ? "Khóa" : "Mở khóa"}
                      </Button>
                      {usersByEmployee[e.employeeCode]?.length ? (
                        <Button size="small" onClick={() => openManageAccounts(e)}>
                          Quản lý tài khoản
                        </Button>
                      ) : (
                        <Button size="small" onClick={() => openCreateAccount(e)}>
                          Tạo tài khoản
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có nhân viên" description="Thêm nhân viên đầu tiên cho hệ thống." />
      )}

      {credential ? (
        <SectionPanel
          title="Thông tin đăng nhập"
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
              {!editing ? (
                <Field label="Email">
                  <Input value={form.email} onChange={(_, data) => setForm((v) => ({ ...v, email: data.value }))} />
                </Field>
              ) : null}
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
                <Field
                  label="Quản lý trực tiếp"
                  hint={
                    ranksConfigured && form.departmentCode && departmentManagerCandidates.length > 0 && !managerSearch && !isTopRank && !tierCandidates.length
                      ? "Chưa có ai ở bậc liền trên trong phòng ban này, gõ để tìm người khác."
                      : undefined
                  }
                >
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
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submit} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : editing ? "Lưu thay đổi" : "Thêm nhân viên"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={(_, data) => setAccountOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tạo tài khoản cho {accountEmployee?.fullName}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Tên đăng nhập" required>
                  <Input
                    value={accountForm.username}
                    onChange={(_, data) => setAccountForm((v) => ({ ...v, username: data.value }))}
                  />
                </Field>
                <Field label="Email" required>
                  <Input
                    value={accountForm.email}
                    onChange={(_, data) => setAccountForm((v) => ({ ...v, email: data.value }))}
                  />
                </Field>
              </div>
              <p className="field-hint">
                Vai trò được tự lấy theo chức vụ hiện tại của nhân viên (
                {accountEmployee?.positionName}). Đổi vai trò mặc định ở màn hình Chức vụ nếu cần.
              </p>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAccountOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submitAccount} disabled={accountSending}>
                {accountSending ? <Spinner size="tiny" /> : "Tạo tài khoản"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={(_, data) => setManageOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tài khoản của {manageEmployee?.fullName}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="enterprise-table-wrap">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Tên đăng nhập</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Đăng nhập gần nhất</th>
                      <th>Trạng thái</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(manageEmployee ? usersByEmployee[manageEmployee.employeeCode] ?? [] : []).map((user) => (
                      <tr key={user.username}>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>{user.roles.join(", ")}</td>
                        <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "--"}</td>
                        <td>
                          <Badge appearance="tint" color={user.isActive ? "success" : "danger"}>
                            {user.isActive ? "Đang hoạt động" : "Đã khóa"}
                          </Badge>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Button
                              size="small"
                              disabled={togglingUsername === user.username}
                              onClick={() =>
                                user.isActive ? setLockAccountTarget(user) : toggleAccountActive(user)
                              }
                            >
                              {togglingUsername === user.username ? (
                                <Spinner size="tiny" />
                              ) : user.isActive ? (
                                "Khóa"
                              ) : (
                                "Mở khóa"
                              )}
                            </Button>
                            <Button
                              size="small"
                              disabled={resettingUsername === user.username}
                              onClick={() => resetAccountPassword(user)}
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
              <p className="field-hint">
                Muốn tạo thêm tài khoản thứ 2 cho nhân viên này? Vào trang Users để tạo thủ công.
              </p>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setManageOpen(false)}>Đóng</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={lockEmployeeTarget !== null}
        title="Cho nhân viên nghỉ việc?"
        description={`Nhân viên "${lockEmployeeTarget?.fullName}" sẽ chuyển sang trạng thái Ngừng, không thể chấm công/xin nghỉ nữa cho đến khi được phục hồi lại.`}
        confirmLabel="Cho nghỉ việc"
        confirming={lockingEmployee}
        onConfirm={confirmLockEmployee}
        onCancel={() => setLockEmployeeTarget(null)}
      />

      <ConfirmDialog
        open={lockAccountTarget !== null}
        title="Khóa tài khoản?"
        description={`Tài khoản "${lockAccountTarget?.username}" sẽ không thể đăng nhập cho đến khi được mở khóa lại.`}
        confirmLabel="Khóa tài khoản"
        confirming={lockingAccount}
        onConfirm={confirmLockAccount}
        onCancel={() => setLockAccountTarget(null)}
      />
    </div>
  );
}

export function AdminDepartmentsPage() {
  const notify = useNotify();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ departmentCode: "", departmentName: "", description: "" });
  const [lockDeptTarget, setLockDeptTarget] = useState<DepartmentDto | null>(null);
  const [lockingDept, setLockingDept] = useState(false);

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
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setDeptOpen(true)}>
            Thêm phòng ban
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <SectionPanel title="Danh sách phòng ban">
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
                  <Button
                    size="small"
                    onClick={() => (d.isActive ? setLockDeptTarget(d) : toggleDepartment(d))}
                  >
                    {d.isActive ? "Khóa" : "Mở khóa"}
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
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [posOpen, setPosOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionDto | null>(null);
  const [posForm, setPosForm] = useState({
    positionCode: "",
    positionName: "",
    description: "",
    rankLevel: "50",
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
    rankLevel: "50",
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
      rankLevel: String(p.rankLevel),
    });
    setPosOpen(true);
  };

  const submitPosition = async () => {
    if (!posForm.positionCode.trim() || !posForm.positionName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã và tên chức vụ." });
      return;
    }
    const rankLevel = Number(posForm.rankLevel);
    if (!Number.isFinite(rankLevel)) {
      notify({ ok: false, message: "Cấp bậc phải là một số." });
      return;
    }
    try {
      if (editingPosition) {
        await positionApi.update(editingPosition.positionCode, {
          positionName: posForm.positionName,
          description: posForm.description,
          rankLevel,
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
        description="Toàn quyền tạo, sửa, khóa/mở chức vụ — chỉ là chức danh hiển thị, không gắn với role. Role được chọn riêng khi tạo tài khoản."
        action={
          <Button appearance="primary" icon={<AddRegular />} onClick={openCreatePosition}>
            Thêm chức vụ
          </Button>
        }
      />
      {loading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <SectionPanel title="Danh sách chức vụ">
          <div className="compact-list">
            {positions.map((p) => (
              <div className="compact-row" key={p.positionCode}>
                <div>
                  <strong>{p.positionName}</strong>
                  <span>
                    {p.positionCode} · Cấp {p.rankLevel} ·{" "}
                    {p.standardSalary ? formatCurrency(p.standardSalary) : "Chưa có lương chuẩn"}
                  </span>
                </div>
                <div className="row-actions">
                  <Badge appearance="tint" color={p.isActive ? "success" : "subtle"}>
                    {p.isActive ? "Hoạt động" : "Ngừng"}
                  </Badge>
                  <Button size="small" onClick={() => openEditPosition(p)}>
                    Sửa
                  </Button>
                  <Button
                    size="small"
                    onClick={() => (p.isActive ? setLockPosTarget(p) : togglePosition(p))}
                  >
                    {p.isActive ? "Khóa" : "Mở khóa"}
                  </Button>
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
              <Field label="Cấp bậc" hint="Số càng nhỏ càng cao cấp. Để hở khoảng cách (vd 10, 20, 30) để dễ chèn thêm chức vụ mới ở giữa.">
                <Input
                  type="number"
                  value={posForm.rankLevel}
                  onChange={(_, data) => setPosForm((v) => ({ ...v, rankLevel: data.value }))}
                />
              </Field>
              <Field label="Mô tả">
                <Textarea resize="vertical" value={posForm.description} onChange={(_, data) => setPosForm((v) => ({ ...v, description: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPosOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={submitPosition}>
                {editingPosition ? "Lưu thay đổi" : "Thêm mới"}
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
    </div>
  );
}

// Admin xem/duyệt toàn bộ Sale trong hệ thống — backend đã có sẵn logic bypass cho ADMIN
// (SaleService.FilterByTeamAsync), nên chỉ cần trang UI dùng chung API /sales/*, không cần
// endpoint riêng. Cấu trúc gần giống ManagerSalesPage nhưng phạm vi toàn công ty thay vì team.
const emptySaleFilters = {
  departmentCode: "",
  approver: "",
  submitter: "",
  customer: "",
  saleCode: "",
};

export function AdminSalesPage() {
  const notify = useNotify();
  const [pending, setPending] = useState<SaleDto[]>([]);
  const [history, setHistory] = useState<SaleDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SaleDto | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [filters, setFilters] = useState(emptySaleFilters);

  const load = () => {
    setLoading(true);
    Promise.all([saleApi.getPending(), saleApi.getHistory(), departmentApi.getAll()])
      .then(([p, h, d]) => {
        setPending(p);
        setHistory(h);
        setDepartments(d);
      })
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (id: number) => {
    setBusyId(id);
    try {
      await saleApi.approve(id);
      notify({ ok: true, message: "Đã duyệt sale." });
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (sale: SaleDto) => {
    setRejectTarget(sale);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      notify({ ok: false, message: "Vui lòng nhập lý do từ chối." });
      return;
    }
    setRejecting(true);
    try {
      await saleApi.reject(rejectTarget.id, { rejectionReason: rejectReason });
      notify({ ok: true, message: "Đã từ chối sale." });
      setRejectTarget(null);
      load();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setRejecting(false);
    }
  };

  const rawList = tab === "pending" ? pending : history;

  // Lọc phía client trên danh sách đã tải — quy mô công ty nội bộ, không cần filter ở backend.
  const list = rawList.filter((sale) => {
    if (filters.departmentCode && sale.departmentCode !== filters.departmentCode) return false;
    if (filters.approver && !(sale.approverName ?? "").toLowerCase().includes(filters.approver.toLowerCase())) {
      return false;
    }
    if (
      filters.submitter &&
      !`${sale.employeeName} ${sale.employeeCode}`.toLowerCase().includes(filters.submitter.toLowerCase())
    ) {
      return false;
    }
    if (
      filters.customer &&
      !`${sale.customerCode} ${sale.customerPhone ?? ""}`.toLowerCase().includes(filters.customer.toLowerCase())
    ) {
      return false;
    }
    if (filters.saleCode && !sale.saleCode.toLowerCase().includes(filters.saleCode.toLowerCase())) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== "");

  const approvedRevenue = history
    .filter((s) => s.status === "Confirmed" || s.status === "Completed")
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản lý Sale"
        description="Xem và duyệt sale trên toàn hệ thống."
        action={
          <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
            <Tab value="pending">Chờ duyệt ({pending.length})</Tab>
            <Tab value="history">Lịch sử</Tab>
          </TabList>
        }
      />
      <MetricRail
        items={[
          { label: "Doanh số đã duyệt", value: formatCurrency(approvedRevenue), tone: "success" },
          { label: "Sale chờ duyệt", value: pending.length, tone: pending.length ? "warning" : "success" },
        ]}
      />

      <SectionPanel title="Bộ lọc">
        <div className="form-grid">
          <Field label="Phòng ban">
            <Dropdown
              value={departments.find((d) => d.departmentCode === filters.departmentCode)?.departmentName ?? "Tất cả"}
              selectedOptions={[filters.departmentCode]}
              onOptionSelect={(_, data) => setFilters((v) => ({ ...v, departmentCode: data.optionValue ?? "" }))}
            >
              <Option key="" value="">
                Tất cả
              </Option>
              {departments.map((d) => (
                <Option key={d.departmentCode} value={d.departmentCode} text={d.departmentName}>
                  {d.departmentName}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Người duyệt">
            <Input
              value={filters.approver}
              placeholder="Tên người duyệt..."
              onChange={(_, data) => setFilters((v) => ({ ...v, approver: data.value }))}
            />
          </Field>
          <Field label="Người nộp">
            <Input
              value={filters.submitter}
              placeholder="Tên hoặc mã NV..."
              onChange={(_, data) => setFilters((v) => ({ ...v, submitter: data.value }))}
            />
          </Field>
          <Field label="Khách hàng">
            <Input
              value={filters.customer}
              placeholder="SĐT hoặc mã khách hàng..."
              onChange={(_, data) => setFilters((v) => ({ ...v, customer: data.value }))}
            />
          </Field>
          <Field label="Mã sale">
            <Input
              value={filters.saleCode}
              onChange={(_, data) => setFilters((v) => ({ ...v, saleCode: data.value }))}
            />
          </Field>
        </div>
        {hasActiveFilters ? (
          <Button size="small" onClick={() => setFilters(emptySaleFilters)}>
            Xoá bộ lọc
          </Button>
        ) : null}
      </SectionPanel>

      {loading ? (
        <Spinner label="Đang tải..." />
      ) : list.length ? (
        <div className="review-list">
          {list.map((sale) => (
            <article key={sale.id} className="review-content">
              <div>
                <strong>{sale.employeeName}</strong>
                <span>
                  {sale.saleCode} · {sale.departmentName} · {sale.customerName} · {formatCurrency(sale.amount)} ·{" "}
                  {formatDate(sale.orderDate)}
                  {sale.approverName ? ` · Duyệt bởi ${sale.approverName}` : ""}
                </span>
                {sale.note ? <p>{sale.note}</p> : null}
                {sale.rejectionReason ? <p>Lý do từ chối: {sale.rejectionReason}</p> : null}
              </div>
              {tab === "pending" ? (
                <div className="review-actions">
                  <Button appearance="primary" disabled={busyId === sale.id} onClick={() => approve(sale.id)}>
                    Duyệt
                  </Button>
                  <Button disabled={busyId === sale.id} onClick={() => openReject(sale)}>
                    Từ chối
                  </Button>
                </div>
              ) : (
                <RequestBadge status={sale.status} />
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Không có sale" description="Danh sách sẽ cập nhật khi có sale mới." />
      )}

      <Dialog open={rejectTarget !== null} onOpenChange={(_, data) => !data.open && setRejectTarget(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Từ chối sale?</DialogTitle>
            <DialogContent className="form-stack">
              <p>
                Sale của <strong>{rejectTarget?.employeeName}</strong> — khách hàng {rejectTarget?.customerName},{" "}
                {rejectTarget ? formatCurrency(rejectTarget.amount) : ""}.
              </p>
              <Field label="Lý do từ chối" required>
                <Textarea
                  resize="vertical"
                  value={rejectReason}
                  onChange={(_, data) => setRejectReason(data.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRejectTarget(null)} disabled={rejecting}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={confirmReject} disabled={rejecting}>
                {rejecting ? <Spinner size="tiny" /> : "Từ chối sale"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}


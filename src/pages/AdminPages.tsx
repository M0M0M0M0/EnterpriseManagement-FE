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
import { AddRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { EmptyState, FieldError, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import {
  customerApi,
  departmentApi,
  employeeApi,
  positionApi,
} from "../services/api";
import { errorMessage } from "../services/http";
import type {
  CustomerDto,
  DepartmentDto,
  EmployeeDto,
  PositionDto,
} from "../types/domain";
import { formatCurrency, formatDate } from "../utils/format";

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
      if (!managerStillValid) setManagerQuery("");
      return { ...v, departmentCode, managerCode: managerStillValid ? v.managerCode : "" };
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
    if (!editing && (!form.firstName.trim() || !form.lastName.trim())) {
      notify({ ok: false, message: "Vui lòng nhập đủ họ tên." });
      return;
    }
    setSending(true);
    try {
      if (editing) {
        await employeeApi.update(editing.employeeCode, {
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

  // Ứng viên quản lý: cùng phòng ban đã chọn, chưa nghỉ việc, không phải chính mình.
  // Vẫn giữ quản lý hiện tại của hồ sơ (nếu có) trong danh sách dù người đó khác phòng ban,
  // để mở form Sửa không làm mất lựa chọn đang có sẵn.
  const departmentManagerCandidates = employees.filter(
    (e) =>
      e.departmentCode === form.departmentCode &&
      e.employmentStatus !== "Terminated" &&
      e.employeeCode !== editing?.employeeCode,
  );
  const currentManager = editing?.managerCode
    ? employees.find((e) => e.employeeCode === editing.managerCode)
    : undefined;
  const managerCandidates =
    currentManager && !departmentManagerCandidates.some((e) => e.employeeCode === currentManager.employeeCode)
      ? [currentManager, ...departmentManagerCandidates]
      : departmentManagerCandidates;
  const managerSearch = managerQuery.trim().toLowerCase();
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
                      <Button size="small" onClick={() => toggleActive(e)}>
                        {e.employmentStatus === "Active" ? "Khóa" : "Mở khóa"}
                      </Button>
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

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editing ? `Sửa hồ sơ: ${editing.fullName}` : "Thêm nhân viên mới"}</DialogTitle>
            <DialogContent className="form-stack">
              {!editing ? (
                <>
                  <div className="form-grid">
                    <Field label="Họ" required>
                      <Input value={form.lastName} onChange={(_, data) => setForm((v) => ({ ...v, lastName: data.value }))} />
                    </Field>
                    <Field label="Tên" required>
                      <Input value={form.firstName} onChange={(_, data) => setForm((v) => ({ ...v, firstName: data.value }))} />
                    </Field>
                  </div>
                  <Field label="Email">
                    <Input value={form.email} onChange={(_, data) => setForm((v) => ({ ...v, email: data.value }))} />
                  </Field>
                </>
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
                <Field label="Quản lý trực tiếp">
                  <Combobox
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
                  {form.departmentCode && managerCandidates.length === 0 ? (
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


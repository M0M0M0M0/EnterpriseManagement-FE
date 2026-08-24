import {
  Badge,
  Button,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
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
  Tab,
  TabList,
  TableCellLayout,
  Textarea,
  createTableColumn,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { DonutChart } from "@fluentui/react-charts";
import {
  AddRegular,
  ArrowDownloadRegular,
  ArrowLeftRegular,
  CalendarClockRegular,
  CheckmarkRegular,
  DeleteRegular,
  DismissRegular,
  EditRegular,
  EyeRegular,
  PersonAddRegular,
} from "@fluentui/react-icons";
import { format, subDays } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AttendanceBadge,
  EmployeeAvatar,
  EmptyState,
  MetricRail,
  PageHeader,
  RequestBadge,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useAppStore } from "../store/useAppStore";
import type {
  Department,
  Employee,
  EmployeeStatus,
  LeaveRequest,
  Position,
  Shift,
} from "../types/domain";
import {
  formatDate,
  formatTime,
  isoDate,
  leaveTypeLabels,
  requestLabels,
} from "../utils/format";

const newEmployeeDefaults = {
  fullName: "",
  email: "",
  phone: "",
  departmentId: "dep-hr",
  positionId: "pos-hrs",
  shiftId: "shift-office",
  startDate: isoDate(),
  birthDate: "2000-01-01",
  address: "",
  status: "active" as EmployeeStatus,
  leaveBalance: 12,
};

export function HrEmployeesPage() {
  const employees = useAppStore((state) => state.employees);
  const departments = useAppStore((state) => state.departments);
  const positions = useAppStore((state) => state.positions);
  const shifts = useAppStore((state) => state.shifts);
  const addEmployee = useAppStore((state) => state.addEmployee);
  const updateEmployee = useAppStore((state) => state.updateEmployee);
  const toggleEmployee = useAppStore((state) => state.toggleEmployee);
  const notify = useNotify();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [draft, setDraft] = useState(newEmployeeDefaults);

  const filtered = useMemo(
    () =>
      employees.filter((employee) => {
        const haystack =
          `${employee.fullName} ${employee.employeeCode} ${employee.email}`.toLowerCase();
        return (
          haystack.includes(search.toLowerCase()) &&
          (department === "all" || employee.departmentId === department) &&
          (status === "all" || employee.status === status)
        );
      }),
    [employees, search, department, status],
  );
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleEmployees = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const openCreate = () => {
    setEditing(null);
    setDraft(newEmployeeDefaults);
    setOpen(true);
  };
  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setDraft({
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      departmentId: employee.departmentId,
      positionId: employee.positionId,
      shiftId: employee.shiftId,
      startDate: employee.startDate,
      birthDate: employee.birthDate,
      address: employee.address,
      status: employee.status,
      leaveBalance: employee.leaveBalance,
    });
    setOpen(true);
  };
  const save = () => {
    if (!draft.fullName.trim() || !draft.email.trim() || !draft.phone.trim()) {
      notify({
        ok: false,
        message: "Vui lòng điền họ tên, email và số điện thoại.",
      });
      return;
    }
    const result = editing
      ? updateEmployee(editing.id, draft)
      : addEmployee(draft);
    notify(result);
    if (result.ok) setOpen(false);
  };

  const columns: TableColumnDefinition<Employee>[] = [
    createTableColumn({
      columnId: "employee",
      compare: (a, b) => a.fullName.localeCompare(b.fullName),
      renderHeaderCell: () => "Nhân viên",
      renderCell: (item) => (
        <TableCellLayout
          media={
            <EmployeeAvatar
              name={item.fullName}
              color={item.avatarColor}
              size={34}
            />
          }
        >
          <strong>{item.fullName}</strong>
          <small>{item.employeeCode}</small>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "department",
      renderHeaderCell: () => "Phòng ban",
      renderCell: (item) =>
        departments.find((value) => value.id === item.departmentId)?.name ??
        "--",
    }),
    createTableColumn({
      columnId: "position",
      renderHeaderCell: () => "Chức vụ",
      renderCell: (item) =>
        positions.find((value) => value.id === item.positionId)?.name ?? "--",
    }),
    createTableColumn({
      columnId: "email",
      renderHeaderCell: () => "Liên hệ",
      renderCell: (item) => (
        <TableCellLayout>
          <span>{item.email}</span>
          <small>{item.phone}</small>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Trạng thái",
      renderCell: (item) => (
        <Badge
          appearance="tint"
          color={item.status === "active" ? "success" : "danger"}
        >
          {item.status === "active" ? "Đang làm việc" : "Ngừng hoạt động"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (item) => (
        <div className="row-actions">
          <Button
            appearance="subtle"
            icon={<EyeRegular />}
            aria-label="Xem hồ sơ"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/hr/employees/${item.id}`);
            }}
          />
          <Button
            appearance="subtle"
            icon={<EditRegular />}
            aria-label="Sửa hồ sơ"
            onClick={(event) => {
              event.stopPropagation();
              openEdit(item);
            }}
          />
        </div>
      ),
    }),
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Nhân viên"
        description="Quản lý hồ sơ, trạng thái làm việc và thông tin phân công."
        action={
          <Button
            appearance="primary"
            icon={<PersonAddRegular />}
            onClick={openCreate}
          >
            Thêm nhân viên
          </Button>
        }
      />
      <div className="toolbar employee-filters">
        <Field label="Tìm kiếm">
          <Input
            value={search}
            onChange={(_, data) => {
              setSearch(data.value);
              setPage(1);
            }}
            placeholder="Tên, mã hoặc email"
          />
        </Field>
        <Field label="Phòng ban">
          <Dropdown
            value={
              department === "all"
                ? "Tất cả phòng ban"
                : departments.find((item) => item.id === department)?.name
            }
            selectedOptions={[department]}
            onOptionSelect={(_, data) => {
              setDepartment(data.optionValue ?? "all");
              setPage(1);
            }}
          >
            <Option value="all">Tất cả phòng ban</Option>
            {departments.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Trạng thái">
          <Dropdown
            value={
              status === "all"
                ? "Tất cả trạng thái"
                : status === "active"
                  ? "Đang làm việc"
                  : "Ngừng hoạt động"
            }
            selectedOptions={[status]}
            onOptionSelect={(_, data) => {
              setStatus(data.optionValue ?? "all");
              setPage(1);
            }}
          >
            <Option value="all">Tất cả trạng thái</Option>
            <Option value="active">Đang làm việc</Option>
            <Option value="inactive">Ngừng hoạt động</Option>
          </Dropdown>
        </Field>
      </div>
      <SectionPanel
        title="Danh sách nhân viên"
        action={
          <Badge appearance="tint" color="informative">
            {filtered.length} hồ sơ
          </Badge>
        }
      >
        <div className="data-grid-wrap">
          <DataGrid
            items={visibleEmployees}
            columns={columns}
            sortable
            getRowId={(item) => item.id}
          >
            <DataGridHeader>
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<Employee>>
              {({ item, rowId }) => (
                <DataGridRow<Employee>
                  key={rowId}
                  onClick={() => navigate(`/hr/employees/${item.id}`)}
                >
                  {({ renderCell }) => (
                    <DataGridCell>{renderCell(item)}</DataGridCell>
                  )}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
        <div className="mobile-record-list">
          {visibleEmployees.map((employee) => (
            <button
              type="button"
              key={employee.id}
              onClick={() => navigate(`/hr/employees/${employee.id}`)}
            >
              <div className="person-line">
                <EmployeeAvatar
                  name={employee.fullName}
                  color={employee.avatarColor}
                />
                <div>
                  <strong>{employee.fullName}</strong>
                  <span>
                    {
                      departments.find(
                        (item) => item.id === employee.departmentId,
                      )?.name
                    }
                  </span>
                </div>
              </div>
              <Badge
                appearance="tint"
                color={employee.status === "active" ? "success" : "danger"}
              >
                {employee.status === "active" ? "Hoạt động" : "Đã khóa"}
              </Badge>
            </button>
          ))}
        </div>
        {filtered.length ? (
          <nav className="pagination" aria-label="Phân trang nhân viên">
            <span>
              Trang {page} / {totalPages}
            </span>
            <div>
              <Button
                size="small"
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Trước
              </Button>
              <Button
                size="small"
                disabled={page === totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                Sau
              </Button>
            </div>
          </nav>
        ) : null}
      </SectionPanel>

      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {editing ? "Cập nhật nhân viên" : "Thêm nhân viên"}
            </DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Họ và tên" required>
                  <Input
                    value={draft.fullName}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, fullName: data.value }))
                    }
                  />
                </Field>
                <Field label="Số điện thoại" required>
                  <Input
                    value={draft.phone}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, phone: data.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, email: data.value }))
                  }
                />
              </Field>
              <div className="form-grid">
                <Field label="Phòng ban">
                  <Dropdown
                    value={
                      departments.find((item) => item.id === draft.departmentId)
                        ?.name
                    }
                    selectedOptions={[draft.departmentId]}
                    onOptionSelect={(_, data) => {
                      const departmentId =
                        data.optionValue ?? draft.departmentId;
                      const firstPosition = positions.find(
                        (item) => item.departmentId === departmentId,
                      );
                      setDraft((value) => ({
                        ...value,
                        departmentId,
                        positionId: firstPosition?.id ?? value.positionId,
                      }));
                    }}
                  >
                    {departments.map((item) => (
                      <Option key={item.id} value={item.id}>
                        {item.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Chức vụ">
                  <Dropdown
                    value={
                      positions.find((item) => item.id === draft.positionId)
                        ?.name
                    }
                    selectedOptions={[draft.positionId]}
                    onOptionSelect={(_, data) =>
                      setDraft((value) => ({
                        ...value,
                        positionId: data.optionValue ?? value.positionId,
                      }))
                    }
                  >
                    {positions
                      .filter(
                        (item) => item.departmentId === draft.departmentId,
                      )
                      .map((item) => (
                        <Option key={item.id} value={item.id}>
                          {item.name}
                        </Option>
                      ))}
                  </Dropdown>
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Ca làm">
                  <Dropdown
                    value={
                      shifts.find((item) => item.id === draft.shiftId)?.name
                    }
                    selectedOptions={[draft.shiftId]}
                    onOptionSelect={(_, data) =>
                      setDraft((value) => ({
                        ...value,
                        shiftId: data.optionValue ?? value.shiftId,
                      }))
                    }
                  >
                    {shifts.map((item) => (
                      <Option key={item.id} value={item.id}>
                        {item.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Ngày vào làm">
                  <Input
                    type="date"
                    value={draft.startDate}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, startDate: data.value }))
                    }
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Ngày sinh">
                  <Input
                    type="date"
                    value={draft.birthDate}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, birthDate: data.value }))
                    }
                  />
                </Field>
                <Field label="Phép năm">
                  <Input
                    type="number"
                    min={0}
                    value={String(draft.leaveBalance)}
                    onChange={(_, data) =>
                      setDraft((value) => ({
                        ...value,
                        leaveBalance: Number(data.value),
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Địa chỉ">
                <Textarea
                  resize="vertical"
                  value={draft.address}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, address: data.value }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              {editing ? (
                <Button
                  appearance="secondary"
                  onClick={() => notify(toggleEmployee(editing.id))}
                >
                  {editing.status === "active"
                    ? "Ngừng hoạt động"
                    : "Kích hoạt lại"}
                </Button>
              ) : null}
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={save}>
                Lưu hồ sơ
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function HrEmployeeDetailPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const employee = useAppStore((state) =>
    state.employees.find((item) => item.id === employeeId),
  );
  const departments = useAppStore((state) => state.departments);
  const positions = useAppStore((state) => state.positions);
  const shifts = useAppStore((state) => state.shifts);
  const attendance = useAppStore((state) =>
    state.attendanceRecords.filter((item) => item.employeeId === employeeId),
  );
  const leave = useAppStore((state) =>
    state.leaveRequests.filter((item) => item.employeeId === employeeId),
  );
  const [tab, setTab] = useState("profile");
  if (!employee)
    return (
      <EmptyState
        title="Không tìm thấy nhân viên"
        description="Hồ sơ có thể đã bị xóa hoặc đường dẫn không hợp lệ."
        actionLabel="Về danh sách"
        onAction={() => navigate("/hr/employees")}
      />
    );
  const department = departments.find(
    (item) => item.id === employee.departmentId,
  );
  const position = positions.find((item) => item.id === employee.positionId);
  const shift = shifts.find((item) => item.id === employee.shiftId);
  return (
    <div className="page-stack">
      <Button
        appearance="subtle"
        icon={<ArrowLeftRegular />}
        onClick={() => navigate("/hr/employees")}
      >
        Danh sách nhân viên
      </Button>
      <section className="profile-banner">
        <EmployeeAvatar
          name={employee.fullName}
          color={employee.avatarColor}
          size={76}
        />
        <div>
          <h1>{employee.fullName}</h1>
          <p>
            {employee.employeeCode} · {position?.name}
          </p>
          <Badge
            appearance="tint"
            color={employee.status === "active" ? "success" : "danger"}
          >
            {employee.status === "active" ? "Đang làm việc" : "Ngừng hoạt động"}
          </Badge>
        </div>
      </section>
      <TabList
        selectedValue={tab}
        onTabSelect={(_, data) => setTab(String(data.value))}
      >
        <Tab value="profile">Hồ sơ</Tab>
        <Tab value="attendance">Chấm công</Tab>
        <Tab value="leave">Nghỉ phép</Tab>
      </TabList>
      {tab === "profile" ? (
        <div className="two-column-grid">
          <SectionPanel title="Thông tin cá nhân">
            <dl className="detail-list">
              <div>
                <dt>Email</dt>
                <dd>{employee.email}</dd>
              </div>
              <div>
                <dt>Điện thoại</dt>
                <dd>{employee.phone}</dd>
              </div>
              <div>
                <dt>Ngày sinh</dt>
                <dd>{formatDate(employee.birthDate)}</dd>
              </div>
              <div>
                <dt>Địa chỉ</dt>
                <dd>{employee.address}</dd>
              </div>
            </dl>
          </SectionPanel>
          <SectionPanel title="Công việc">
            <dl className="detail-list">
              <div>
                <dt>Phòng ban</dt>
                <dd>{department?.name}</dd>
              </div>
              <div>
                <dt>Chức vụ</dt>
                <dd>{position?.name}</dd>
              </div>
              <div>
                <dt>Ngày vào làm</dt>
                <dd>{formatDate(employee.startDate)}</dd>
              </div>
              <div>
                <dt>Ca làm</dt>
                <dd>{shift?.name}</dd>
              </div>
            </dl>
          </SectionPanel>
        </div>
      ) : null}
      {tab === "attendance" ? (
        <SectionPanel title="10 bản ghi gần nhất">
          <div className="attendance-list">
            {attendance.slice(0, 10).map((item) => (
              <article className="attendance-list-item" key={item.id}>
                <div className="date-block">
                  <strong>{formatDate(item.date, "dd")}</strong>
                  <span>{formatDate(item.date, "MM")}</span>
                </div>
                <div className="attendance-times">
                  <div>
                    <span>Vào</span>
                    <strong>{formatTime(item.checkIn)}</strong>
                  </div>
                  <div>
                    <span>Ra</span>
                    <strong>{formatTime(item.checkOut)}</strong>
                  </div>
                </div>
                <AttendanceBadge status={item.status} />
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
      {tab === "leave" ? (
        <SectionPanel title="Lịch sử nghỉ phép">
          <div className="request-list">
            {leave.map((item) => (
              <article key={item.id}>
                <div className="request-main">
                  <strong>{leaveTypeLabels[item.type]}</strong>
                  <span>
                    {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </span>
                  <p>{item.reason}</p>
                </div>
                <RequestBadge status={item.status} />
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
    </div>
  );
}

export function HrOrganizationPage() {
  const departments = useAppStore((state) => state.departments);
  const positions = useAppStore((state) => state.positions);
  const employees = useAppStore((state) => state.employees);
  const addDepartment = useAppStore((state) => state.addDepartment);
  const updateDepartment = useAppStore((state) => state.updateDepartment);
  const removeDepartment = useAppStore((state) => state.removeDepartment);
  const addPosition = useAppStore((state) => state.addPosition);
  const updatePosition = useAppStore((state) => state.updatePosition);
  const removePosition = useAppStore((state) => state.removePosition);
  const notify = useNotify();
  const [tab, setTab] = useState("departments");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [departmentDraft, setDepartmentDraft] = useState<
    Omit<Department, "id">
  >({
    name: "",
    code: "",
    description: "",
  });
  const [positionDraft, setPositionDraft] = useState<Omit<Position, "id">>({
    name: "",
    departmentId: departments[0]?.id ?? "",
    level: "staff",
  });
  const openCreate = () => {
    setEditingId(null);
    setDepartmentDraft({ name: "", code: "", description: "" });
    setPositionDraft({
      name: "",
      departmentId: departments[0]?.id ?? "",
      level: "staff",
    });
    setOpen(true);
  };
  const editDepartment = (department: Department) => {
    setEditingId(department.id);
    setDepartmentDraft({
      name: department.name,
      code: department.code,
      description: department.description,
      managerId: department.managerId,
    });
    setOpen(true);
  };
  const editPosition = (position: Position) => {
    setEditingId(position.id);
    setPositionDraft({
      name: position.name,
      departmentId: position.departmentId,
      level: position.level,
    });
    setOpen(true);
  };
  const save = () => {
    const result =
      tab === "departments"
        ? editingId
          ? updateDepartment(editingId, departmentDraft)
          : addDepartment(departmentDraft)
        : editingId
          ? updatePosition(editingId, positionDraft)
          : addPosition(positionDraft);
    notify(result);
    if (result.ok) {
      setOpen(false);
      setDepartmentDraft({ name: "", code: "", description: "" });
      setPositionDraft({
        name: "",
        departmentId: departments[0]?.id ?? "",
        level: "staff",
      });
    }
  };
  return (
    <div className="page-stack">
      <PageHeader
        title="Cơ cấu tổ chức"
        description="Quản lý phòng ban, chức vụ và số lượng nhân sự liên quan."
        action={
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={openCreate}
          >
            {tab === "departments" ? "Thêm phòng ban" : "Thêm chức vụ"}
          </Button>
        }
      />
      <TabList
        selectedValue={tab}
        onTabSelect={(_, data) => {
          setTab(String(data.value));
          setEditingId(null);
          setOpen(false);
        }}
      >
        <Tab value="departments">Phòng ban</Tab>
        <Tab value="positions">Chức vụ</Tab>
      </TabList>
      {tab === "departments" ? (
        <div className="organization-grid">
          {departments.map((department) => {
            const count = employees.filter(
              (item) => item.departmentId === department.id,
            ).length;
            return (
              <article className="organization-card" key={department.id}>
                <div className="organization-code">{department.code}</div>
                <div>
                  <h2>{department.name}</h2>
                  <p>{department.description}</p>
                </div>
                <div className="organization-footer">
                  <span>{count} nhân viên</span>
                  <div className="row-actions">
                    <Button
                      appearance="subtle"
                      icon={<EditRegular />}
                      aria-label="Sửa phòng ban"
                      onClick={() => editDepartment(department)}
                    />
                    <Button
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      aria-label="Xóa phòng ban"
                      onClick={() => notify(removeDepartment(department.id))}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <SectionPanel>
          <div className="position-list">
            {positions.map((position) => {
              const department = departments.find(
                (item) => item.id === position.departmentId,
              );
              const count = employees.filter(
                (item) => item.positionId === position.id,
              ).length;
              return (
                <div key={position.id}>
                  <div>
                    <strong>{position.name}</strong>
                    <span>
                      {department?.name} ·{" "}
                      {position.level === "manager"
                        ? "Quản lý"
                        : position.level === "lead"
                          ? "Trưởng nhóm"
                          : "Nhân viên"}
                    </span>
                  </div>
                  <div>
                    <Badge appearance="outline">{count} người</Badge>
                    <Button
                      appearance="subtle"
                      icon={<EditRegular />}
                      aria-label="Sửa chức vụ"
                      onClick={() => editPosition(position)}
                    />
                    <Button
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      aria-label="Xóa chức vụ"
                      onClick={() => notify(removePosition(position.id))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      )}
      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {editingId
                ? tab === "departments"
                  ? "Cập nhật phòng ban"
                  : "Cập nhật chức vụ"
                : tab === "departments"
                  ? "Thêm phòng ban"
                  : "Thêm chức vụ"}
            </DialogTitle>
            <DialogContent className="form-stack">
              {tab === "departments" ? (
                <>
                  <Field label="Tên phòng ban" required>
                    <Input
                      value={departmentDraft.name}
                      onChange={(_, data) =>
                        setDepartmentDraft((value) => ({
                          ...value,
                          name: data.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Mã phòng ban" required>
                    <Input
                      value={departmentDraft.code}
                      onChange={(_, data) =>
                        setDepartmentDraft((value) => ({
                          ...value,
                          code: data.value.toUpperCase(),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Mô tả">
                    <Textarea
                      value={departmentDraft.description}
                      onChange={(_, data) =>
                        setDepartmentDraft((value) => ({
                          ...value,
                          description: data.value,
                        }))
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Tên chức vụ" required>
                    <Input
                      value={positionDraft.name}
                      onChange={(_, data) =>
                        setPositionDraft((value) => ({
                          ...value,
                          name: data.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Phòng ban">
                    <Dropdown
                      value={
                        departments.find(
                          (item) => item.id === positionDraft.departmentId,
                        )?.name
                      }
                      selectedOptions={[positionDraft.departmentId]}
                      onOptionSelect={(_, data) =>
                        setPositionDraft((value) => ({
                          ...value,
                          departmentId: data.optionValue ?? value.departmentId,
                        }))
                      }
                    >
                      {departments.map((item) => (
                        <Option key={item.id} value={item.id}>
                          {item.name}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <Field label="Cấp bậc">
                    <Dropdown
                      value={
                        positionDraft.level === "manager"
                          ? "Quản lý"
                          : positionDraft.level === "lead"
                            ? "Trưởng nhóm"
                            : "Nhân viên"
                      }
                      selectedOptions={[positionDraft.level]}
                      onOptionSelect={(_, data) =>
                        setPositionDraft((value) => ({
                          ...value,
                          level: (data.optionValue ??
                            "staff") as Position["level"],
                        }))
                      }
                    >
                      <Option value="staff">Nhân viên</Option>
                      <Option value="lead">Trưởng nhóm</Option>
                      <Option value="manager">Quản lý</Option>
                    </Dropdown>
                  </Field>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={save}>
                Lưu
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function HrShiftsPage() {
  const shifts = useAppStore((state) => state.shifts);
  const employees = useAppStore((state) => state.employees);
  const addShift = useAppStore((state) => state.addShift);
  const updateShift = useAppStore((state) => state.updateShift);
  const removeShift = useAppStore((state) => state.removeShift);
  const assignShift = useAppStore((state) => state.assignShift);
  const notify = useNotify();
  const [shiftOpen, setShiftOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:30",
    breakMinutes: 60,
    color: "#2563EB",
  });
  const [assignment, setAssignment] = useState({
    employeeId: employees[0]?.id ?? "",
    shiftId: shifts[0]?.id ?? "",
    effectiveFrom: isoDate(),
  });
  const openCreate = () => {
    setEditing(null);
    setDraft({
      name: "",
      startTime: "08:00",
      endTime: "17:30",
      breakMinutes: 60,
      color: "#2563EB",
    });
    setShiftOpen(true);
  };
  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setDraft({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      color: shift.color,
    });
    setShiftOpen(true);
  };
  const saveShift = () => {
    const result = editing ? updateShift(editing.id, draft) : addShift(draft);
    notify(result);
    if (result.ok) setShiftOpen(false);
  };
  const saveAssignment = () => {
    const result = assignShift(
      assignment.employeeId,
      assignment.shiftId,
      assignment.effectiveFrom,
    );
    notify(result);
    if (result.ok) setAssignOpen(false);
  };
  return (
    <div className="page-stack">
      <PageHeader
        title="Ca làm"
        description="Quản lý mẫu ca và phân công lịch làm việc cho nhân viên."
        action={
          <div className="page-actions">
            <Button
              appearance="secondary"
              icon={<CalendarClockRegular />}
              onClick={() => setAssignOpen(true)}
            >
              Gán ca
            </Button>
            <Button
              appearance="primary"
              icon={<AddRegular />}
              onClick={openCreate}
            >
              Thêm ca
            </Button>
          </div>
        }
      />
      <div className="shift-grid">
        {shifts.map((shift) => {
          const assigned = employees.filter(
            (item) => item.shiftId === shift.id,
          ).length;
          return (
            <article className="shift-card" key={shift.id}>
              <span
                className="shift-color"
                style={{ background: shift.color }}
              />
              <div>
                <h2>{shift.name}</h2>
                <strong>
                  {shift.startTime} - {shift.endTime}
                </strong>
                <p>Nghỉ giữa ca {shift.breakMinutes} phút</p>
              </div>
              <div className="shift-card-footer">
                <span>{assigned} nhân viên</span>
                <div className="row-actions">
                  <Button
                    appearance="subtle"
                    icon={<EditRegular />}
                    aria-label={`Sửa ${shift.name}`}
                    onClick={() => openEdit(shift)}
                  />
                  <Button
                    appearance="subtle"
                    icon={<DeleteRegular />}
                    aria-label={`Xóa ${shift.name}`}
                    onClick={() => notify(removeShift(shift.id))}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <SectionPanel title="Lịch phân ca tuần này">
        <div className="weekly-roster">
          <div className="weekly-roster-header">
            <span>Nhân viên</span>
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          {employees
            .filter((item) => item.status === "active")
            .slice(0, 8)
            .map((employee) => {
              const shift = shifts.find((item) => item.id === employee.shiftId);
              return (
                <div className="weekly-roster-row" key={employee.id}>
                  <div className="person-line">
                    <EmployeeAvatar
                      name={employee.fullName}
                      color={employee.avatarColor}
                      size={30}
                    />
                    <div>
                      <strong>{employee.fullName}</strong>
                      <span>{employee.employeeCode}</span>
                    </div>
                  </div>
                  {Array.from({ length: 7 }, (_, day) => (
                    <span className={day > 4 ? "is-off" : ""} key={day}>
                      {day > 4 ? "Nghỉ" : shift?.startTime}
                    </span>
                  ))}
                </div>
              );
            })}
        </div>
      </SectionPanel>
      <Dialog
        open={shiftOpen}
        onOpenChange={(_, data) => setShiftOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {editing ? "Cập nhật mẫu ca" : "Thêm mẫu ca"}
            </DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Tên ca" required>
                <Input
                  value={draft.name}
                  onChange={(_, data) =>
                    setDraft((value) => ({ ...value, name: data.value }))
                  }
                />
              </Field>
              <div className="form-grid">
                <Field label="Bắt đầu">
                  <Input
                    type="time"
                    value={draft.startTime}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, startTime: data.value }))
                    }
                  />
                </Field>
                <Field label="Kết thúc">
                  <Input
                    type="time"
                    value={draft.endTime}
                    onChange={(_, data) =>
                      setDraft((value) => ({ ...value, endTime: data.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="Thời gian nghỉ (phút)">
                <Input
                  type="number"
                  min={0}
                  value={String(draft.breakMinutes)}
                  onChange={(_, data) =>
                    setDraft((value) => ({
                      ...value,
                      breakMinutes: Number(data.value),
                    }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShiftOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={saveShift}>
                Lưu ca
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog
        open={assignOpen}
        onOpenChange={(_, data) => setAssignOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Gán ca cho nhân viên</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Nhân viên">
                <Dropdown
                  value={
                    employees.find((item) => item.id === assignment.employeeId)
                      ?.fullName
                  }
                  selectedOptions={[assignment.employeeId]}
                  onOptionSelect={(_, data) =>
                    setAssignment((value) => ({
                      ...value,
                      employeeId: data.optionValue ?? value.employeeId,
                    }))
                  }
                >
                  {employees
                    .filter((item) => item.status === "active")
                    .map((item) => (
                      <Option key={item.id} value={item.id}>
                        {item.fullName}
                      </Option>
                    ))}
                </Dropdown>
              </Field>
              <Field label="Mẫu ca">
                <Dropdown
                  value={
                    shifts.find((item) => item.id === assignment.shiftId)?.name
                  }
                  selectedOptions={[assignment.shiftId]}
                  onOptionSelect={(_, data) =>
                    setAssignment((value) => ({
                      ...value,
                      shiftId: data.optionValue ?? value.shiftId,
                    }))
                  }
                >
                  {shifts.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Hiệu lực từ">
                <Input
                  type="date"
                  value={assignment.effectiveFrom}
                  onChange={(_, data) =>
                    setAssignment((value) => ({
                      ...value,
                      effectiveFrom: data.value,
                    }))
                  }
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAssignOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={saveAssignment}>
                Xác nhận
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

export function HrLeavePage() {
  const requests = useAppStore((state) => state.leaveRequests);
  const overtimeRequests = useAppStore((state) => state.overtimeRequests);
  const employees = useAppStore((state) => state.employees);
  const reviewRequest = useAppStore((state) => state.reviewRequest);
  const notify = useNotify();
  const [tab, setTab] = useState("pending");
  const [note, setNote] = useState("");
  const filtered = requests.filter((item) => item.status === tab);
  const review = (request: LeaveRequest, decision: "approved" | "rejected") => {
    notify(
      reviewRequest(
        "leave",
        request.id,
        decision,
        note ||
          (decision === "approved"
            ? "Đã xác nhận kế hoạch nhân sự."
            : "Chưa thể bố trí nhân sự thay thế."),
      ),
    );
    setNote("");
  };
  return (
    <div className="page-stack">
      <PageHeader
        title="Duyệt nghỉ phép"
        description="Xem số dư, khoảng nghỉ và phản hồi yêu cầu của nhân viên."
      />
      <MetricRail
        items={[
          {
            label: "Chờ duyệt",
            value:
              requests.filter((item) => item.status === "pending").length +
              overtimeRequests.filter((item) => item.status === "pending")
                .length,
            detail: "Cần phản hồi",
            tone: "warning",
          },
          {
            label: "Đã duyệt",
            value: requests.filter((item) => item.status === "approved").length,
            detail: "Trong dữ liệu minh họa",
            tone: "success",
          },
          {
            label: "Đã từ chối",
            value: requests.filter((item) => item.status === "rejected").length,
            detail: "Có ghi chú xử lý",
            tone: "danger",
          },
        ]}
      />
      <TabList
        selectedValue={tab}
        onTabSelect={(_, data) => setTab(String(data.value))}
      >
        <Tab value="pending">Chờ duyệt</Tab>
        <Tab value="approved">Đã duyệt</Tab>
        <Tab value="rejected">Từ chối</Tab>
      </TabList>
      <SectionPanel>
        {filtered.length ? (
          <div className="leave-review-list">
            {filtered.map((request) => {
              const employee = employees.find(
                (item) => item.id === request.employeeId,
              );
              return (
                <article key={request.id}>
                  <div className="leave-review-header">
                    <div className="person-line">
                      <EmployeeAvatar
                        name={employee?.fullName ?? ""}
                        color={employee?.avatarColor ?? "#2563EB"}
                      />
                      <div>
                        <strong>{employee?.fullName}</strong>
                        <span>
                          {employee?.employeeCode} · Còn{" "}
                          {employee?.leaveBalance} ngày phép
                        </span>
                      </div>
                    </div>
                    <RequestBadge status={request.status} />
                  </div>
                  <div className="leave-review-body">
                    <div>
                      <span>Loại nghỉ</span>
                      <strong>{leaveTypeLabels[request.type]}</strong>
                    </div>
                    <div>
                      <span>Thời gian</span>
                      <strong>
                        {formatDate(request.startDate)} -{" "}
                        {formatDate(request.endDate)} ({request.days} ngày)
                      </strong>
                    </div>
                    <div>
                      <span>Lý do</span>
                      <strong>{request.reason}</strong>
                    </div>
                  </div>
                  {request.status === "pending" ? (
                    <>
                      <Field label="Ghi chú phản hồi">
                        <Textarea
                          value={note}
                          onChange={(_, data) => setNote(data.value)}
                        />
                      </Field>
                      <div className="review-actions">
                        <Button
                          appearance="primary"
                          icon={<CheckmarkRegular />}
                          onClick={() => review(request, "approved")}
                        >
                          Duyệt
                        </Button>
                        <Button
                          appearance="secondary"
                          icon={<DismissRegular />}
                          onClick={() => review(request, "rejected")}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </>
                  ) : request.reviewNote ? (
                    <div className="review-note">
                      Phản hồi: {request.reviewNote}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={`Không có đơn ${requestLabels[tab as keyof typeof requestLabels].toLowerCase()}`}
            description="Danh sách sẽ cập nhật khi trạng thái đơn thay đổi."
          />
        )}
      </SectionPanel>
      <SectionPanel
        title="Đăng ký OT"
        action={
          <Badge
            appearance="tint"
            color={
              overtimeRequests.some((item) => item.status === "pending")
                ? "warning"
                : "success"
            }
          >
            {overtimeRequests.filter((item) => item.status === "pending").length}
          </Badge>
        }
      >
        {overtimeRequests.length ? (
          <div className="review-list">
            {overtimeRequests.map((request) => {
              const employee = employees.find(
                (item) => item.id === request.employeeId,
              );
              return (
                <article key={request.id}>
                  <div className="review-content">
                    <div className="person-line">
                      <EmployeeAvatar
                        name={employee?.fullName ?? ""}
                        color={employee?.avatarColor ?? "#2563EB"}
                      />
                      <div>
                        <strong>{employee?.fullName}</strong>
                        <span>
                          {formatDate(request.date)} · {request.hours} giờ
                        </span>
                      </div>
                    </div>
                    <p>{request.reason}</p>
                    <RequestBadge status={request.status} />
                  </div>
                  {request.status === "pending" ? (
                    <div className="review-actions">
                      <Button
                        appearance="primary"
                        icon={<CheckmarkRegular />}
                        onClick={() =>
                          notify(
                            reviewRequest(
                              "overtime",
                              request.id,
                              "approved",
                              "Đã xác nhận OT.",
                            ),
                          )
                        }
                      >
                        Duyệt
                      </Button>
                      <Button
                        appearance="secondary"
                        icon={<DismissRegular />}
                        onClick={() =>
                          notify(
                            reviewRequest(
                              "overtime",
                              request.id,
                              "rejected",
                              "Chưa đủ điều kiện OT.",
                            ),
                          )
                        }
                      >
                        Từ chối
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Chưa có đăng ký OT"
            description="Các yêu cầu làm thêm giờ sẽ xuất hiện tại đây."
          />
        )}
      </SectionPanel>
    </div>
  );
}

export function HrReportsPage() {
  const records = useAppStore((state) => state.attendanceRecords);
  const employees = useAppStore((state) => state.employees);
  const departments = useAppStore((state) => state.departments);
  const leave = useAppStore((state) => state.leaveRequests);
  const [from, setFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(isoDate());
  const [department, setDepartment] = useState("all");
  const filteredEmployees = employees.filter(
    (item) => department === "all" || item.departmentId === department,
  );
  const filtered = records.filter(
    (item) =>
      item.date >= from &&
      item.date <= to &&
      filteredEmployees.some((employee) => employee.id === item.employeeId),
  );
  const counts = {
    onTime: filtered.filter((item) => item.status === "on-time").length,
    late: filtered.filter((item) => item.status === "late").length,
    absent: filtered.filter((item) => item.status === "absent").length,
    other: filtered.filter(
      (item) =>
        item.status === "early-leave" || item.status === "missing-checkout",
    ).length,
  };
  const total = Math.max(filtered.length, 1);
  const chartData = [
    { legend: "Đúng giờ", data: counts.onTime, color: "#2563EB" },
    { legend: "Đi muộn", data: counts.late, color: "#D97706" },
    { legend: "Vắng mặt", data: counts.absent, color: "#DC2626" },
    { legend: "Khác", data: counts.other, color: "#64748B" },
  ];
  const exportCsv = () => {
    const header = [
      "Ngày",
      "Mã nhân viên",
      "Họ tên",
      "Phòng ban",
      "Check-in",
      "Check-out",
      "Trạng thái",
    ];
    const rows = filtered.map((record) => {
      const employee = employees.find((item) => item.id === record.employeeId);
      return [
        record.date,
        employee?.employeeCode,
        employee?.fullName,
        departments.find((item) => item.id === employee?.departmentId)?.name,
        formatTime(record.checkIn),
        formatTime(record.checkOut),
        record.status,
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bao-cao-cham-cong-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="page-stack">
      <PageHeader
        title="Báo cáo"
        description="Tổng hợp dữ liệu chấm công và nghỉ phép theo khoảng thời gian."
        action={
          <Button
            appearance="primary"
            icon={<ArrowDownloadRegular />}
            onClick={exportCsv}
          >
            Xuất CSV
          </Button>
        }
      />
      <div className="toolbar filter-grid">
        <Field label="Từ ngày">
          <Input
            type="date"
            value={from}
            onChange={(_, data) => setFrom(data.value)}
          />
        </Field>
        <Field label="Đến ngày">
          <Input
            type="date"
            value={to}
            onChange={(_, data) => setTo(data.value)}
          />
        </Field>
        <Field label="Phòng ban">
          <Dropdown
            value={
              department === "all"
                ? "Toàn công ty"
                : departments.find((item) => item.id === department)?.name
            }
            selectedOptions={[department]}
            onOptionSelect={(_, data) =>
              setDepartment(data.optionValue ?? "all")
            }
          >
            <Option value="all">Toàn công ty</Option>
            {departments.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      <MetricRail
        items={[
          {
            label: "Tỷ lệ đúng giờ",
            value: `${Math.round((counts.onTime / total) * 100)}%`,
            detail: `${counts.onTime} bản ghi`,
            tone: "brand",
          },
          {
            label: "Đi muộn",
            value: counts.late,
            detail: "Trong kỳ báo cáo",
            tone: "warning",
          },
          {
            label: "Vắng mặt",
            value: counts.absent,
            detail: "Trong kỳ báo cáo",
            tone: "danger",
          },
          {
            label: "Nghỉ đã duyệt",
            value: leave
              .filter(
                (item) =>
                  item.status === "approved" &&
                  item.startDate >= from &&
                  item.endDate <= to,
              )
              .reduce((sum, item) => sum + item.days, 0),
            detail: "Ngày nghỉ",
            tone: "success",
          },
        ]}
      />
      <div className="dashboard-grid">
        <SectionPanel title="Phân bổ trạng thái">
          <div className="donut-wrap">
            <DonutChart
              data={{ chartData }}
              innerRadius={70}
              valueInsideDonut={`${filtered.length}`}
              enableReflow
            />
          </div>
        </SectionPanel>
        <SectionPanel title="Theo phòng ban">
          <div className="department-breakdown">
            {departments
              .filter((item) => department === "all" || item.id === department)
              .map((item) => {
                const ids = employees
                  .filter((employee) => employee.departmentId === item.id)
                  .map((employee) => employee.id);
                const deptRecords = filtered.filter((record) =>
                  ids.includes(record.employeeId),
                );
                const onTime = deptRecords.filter(
                  (record) => record.status === "on-time",
                ).length;
                return (
                  <div key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{deptRecords.length} bản ghi</span>
                    </div>
                    <span className="department-share">
                      {deptRecords.length
                        ? Math.round((onTime / deptRecords.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                );
              })}
          </div>
        </SectionPanel>
      </div>
      <SectionPanel title="Ghi chú báo cáo">
        <div className="info-banner">
          <ArrowDownloadRegular />
          <div>
            <strong>Dữ liệu chỉ phục vụ trình diễn</strong>
            <p>
              File CSV được tạo trực tiếp trong trình duyệt và không gửi dữ liệu
              ra ngoài.
            </p>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}

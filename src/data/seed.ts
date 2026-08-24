import { format, getDay, subDays } from "date-fns";
import type {
  AuditLog,
  AttendanceRecord,
  Customer,
  Department,
  Employee,
  Kpi,
  LeaveBalance,
  MenuItem,
  OvertimeRequest,
  Payroll,
  Permission,
  Position,
  Role,
  SaleRecord,
  SeedData,
  Shift,
  User,
} from "../types/domain";

export const departments: Department[] = [
  {
    id: "dep-hr",
    name: "Nhân sự",
    code: "HR",
    description: "Con người và vận hành nội bộ",
  },
  {
    id: "dep-tech",
    name: "Công nghệ",
    code: "TECH",
    description: "Phát triển và vận hành hệ thống",
  },
  {
    id: "dep-sales",
    name: "Kinh doanh",
    code: "SALES",
    description: "Tăng trưởng và chăm sóc khách hàng",
  },
  {
    id: "dep-finance",
    name: "Tài chính",
    code: "FIN",
    description: "Kế toán và kiểm soát ngân sách",
  },
  {
    id: "dep-ops",
    name: "Vận hành",
    code: "OPS",
    description: "Điều phối hoạt động doanh nghiệp",
  },
];

export const positions: Position[] = [
  {
    id: "pos-hrm",
    name: "Trưởng phòng nhân sự",
    departmentId: "dep-hr",
    level: "manager",
  },
  {
    id: "pos-hrs",
    name: "Chuyên viên nhân sự",
    departmentId: "dep-hr",
    level: "staff",
  },
  {
    id: "pos-dev",
    name: "Kỹ sư phần mềm",
    departmentId: "dep-tech",
    level: "staff",
  },
  {
    id: "pos-techlead",
    name: "Trưởng nhóm kỹ thuật",
    departmentId: "dep-tech",
    level: "lead",
  },
  {
    id: "pos-sales",
    name: "Chuyên viên kinh doanh",
    departmentId: "dep-sales",
    level: "staff",
  },
  {
    id: "pos-accountant",
    name: "Kế toán viên",
    departmentId: "dep-finance",
    level: "staff",
  },
  {
    id: "pos-ops",
    name: "Chuyên viên vận hành",
    departmentId: "dep-ops",
    level: "staff",
  },
];

export const shifts: Shift[] = [
  {
    id: "shift-office",
    name: "Ca hành chính",
    startTime: "08:00",
    endTime: "17:30",
    breakMinutes: 90,
    color: "#2563EB",
  },
  {
    id: "shift-morning",
    name: "Ca sáng",
    startTime: "06:00",
    endTime: "14:00",
    breakMinutes: 45,
    color: "#0F766E",
  },
  {
    id: "shift-evening",
    name: "Ca chiều",
    startTime: "14:00",
    endTime: "22:00",
    breakMinutes: 45,
    color: "#B45309",
  },
];

const names = [
  "Nguyễn Minh Anh",
  "Trần Quốc Bảo",
  "Lê Hoàng Châu",
  "Phạm Gia Hân",
  "Võ Đức Huy",
  "Đặng Thùy Linh",
  "Bùi Nhật Minh",
  "Đỗ Khánh Ngân",
  "Hồ Quang Phúc",
  "Ngô Mai Phương",
  "Dương Anh Quân",
  "Lý Thanh Tâm",
  "Mai Gia Thịnh",
  "Tạ Ngọc Trâm",
  "Đinh Tuấn Vũ",
  "Chu Mỹ Duyên",
  "Nguyễn Hải Đăng",
  "Trần Bảo Ngọc",
  "Lê Thành Công",
  "Phạm Thảo Vy",
  "Võ Trung Kiên",
  "Đặng Minh Khoa",
  "Bùi Hà My",
  "Đỗ Anh Tuấn",
  "Hồ Diệu Linh",
  "Ngô Phúc An",
  "Dương Quỳnh Chi",
  "Lý Gia Bảo",
  "Mai Thanh Hà",
  "Tạ Quốc Khánh",
  "Đinh Như Ý",
  "Chu Hoàng Nam",
];

const avatarColors = [
  "#1D4ED8",
  "#0F766E",
  "#B45309",
  "#7C3AED",
  "#BE123C",
  "#0369A1",
];
const departmentCycle = [
  "dep-hr",
  "dep-tech",
  "dep-tech",
  "dep-sales",
  "dep-ops",
  "dep-finance",
];

function positionFor(departmentId: string, index: number) {
  if (departmentId === "dep-hr") return index === 0 ? "pos-hrm" : "pos-hrs";
  if (departmentId === "dep-tech")
    return index % 7 === 0 ? "pos-techlead" : "pos-dev";
  if (departmentId === "dep-sales") return "pos-sales";
  if (departmentId === "dep-finance") return "pos-accountant";
  return "pos-ops";
}

export const employees: Employee[] = names.map((fullName, index) => {
  const departmentId = departmentCycle[index % departmentCycle.length];
  return {
    id: `emp-${String(index + 1).padStart(3, "0")}`,
    employeeCode: `NV${String(index + 1).padStart(3, "0")}`,
    fullName,
    email: `nhanvien${index + 1}@bussines.demo`,
    phone: `09${String(12034000 + index * 137).slice(-8)}`,
    departmentId,
    positionId: positionFor(departmentId, index),
    shiftId:
      index % 9 === 0
        ? "shift-morning"
        : index % 11 === 0
          ? "shift-evening"
          : "shift-office",
    startDate: format(subDays(new Date(), 120 + index * 9), "yyyy-MM-dd"),
    birthDate: `${1988 + (index % 12)}-${String((index % 9) + 1).padStart(2, "0")}-${String((index % 23) + 1).padStart(2, "0")}`,
    address: `${18 + index} Nguyễn Văn Linh, TP. Hồ Chí Minh`,
    status: index === 30 ? "inactive" : "active",
    leaveBalance: 5 + (index % 8),
    avatarColor: avatarColors[index % avatarColors.length],
  };
});

function isoAt(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function generateAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  for (let dayIndex = 0; dayIndex < 60; dayIndex += 1) {
    const day = subDays(new Date(), dayIndex);
    const weekday = getDay(day);
    if (weekday === 0 || weekday === 6) continue;
    const date = format(day, "yyyy-MM-dd");

    employees.forEach((employee, employeeIndex) => {
      const seed = dayIndex + employeeIndex * 3;
      const absent = seed % 37 === 0;
      const late = seed % 11 === 0;
      const early = seed % 29 === 0;
      const missingCheckout = dayIndex > 0 && seed % 43 === 0;
      const shift =
        shifts.find((item) => item.id === employee.shiftId) ?? shifts[0];
      if (absent) {
        records.push({
          id: `att-${date}-${employee.id}`,
          employeeId: employee.id,
          date,
          shiftId: employee.shiftId,
          status: "absent",
        });
        return;
      }
      const baseHour = Number(shift.startTime.slice(0, 2));
      const checkInTime = late
        ? `${String(baseHour).padStart(2, "0")}:${String(9 + (seed % 22)).padStart(2, "0")}`
        : `${String(Math.max(0, baseHour - (seed % 2))).padStart(2, "0")}:${String(48 + (seed % 11)).padStart(2, "0")}`;
      const endHour = Number(shift.endTime.slice(0, 2));
      const checkOutTime = `${String(early ? endHour - 1 : endHour).padStart(2, "0")}:${early ? "08" : String(31 + (seed % 22)).padStart(2, "0")}`;
      records.push({
        id: `att-${date}-${employee.id}`,
        employeeId: employee.id,
        date,
        shiftId: employee.shiftId,
        checkIn: isoAt(date, checkInTime),
        checkOut: missingCheckout ? undefined : isoAt(date, checkOutTime),
        status: missingCheckout
          ? "missing-checkout"
          : late
            ? "late"
            : early
              ? "early-leave"
              : "on-time",
        capture: {
          method: "geolocation",
          capturedAt: isoAt(date, checkInTime),
          latitude: 10.7769,
          longitude: 106.7009,
          accuracy: 14 + (seed % 15),
          locationLabel: "Văn phòng mô phỏng",
        },
      });
    });
  }
  return records;
}

const permissionModules = [
  ["dashboard", "Dashboard"],
  ["user", "User"],
  ["role", "Role"],
  ["employee", "Employee"],
  ["department", "Department"],
  ["position", "Position"],
  ["attendance", "Attendance"],
  ["leave", "Leave"],
  ["sale", "Sales"],
  ["kpi", "KPI"],
  ["customer", "Customer"],
  ["payroll", "Payroll"],
  ["report", "Reports"],
  ["audit", "Audit"],
] as const;

const permissionActions = ["view", "create", "update", "delete", "approve"] as const;

export const permissions: Permission[] = permissionModules.flatMap(
  ([module, label]) =>
    permissionActions.map((action) => ({
      id: `perm-${module}-${action}`,
      permissionCode: `${module}.${action}`,
      permissionName: `${label} ${action}`,
      module: label,
      isActive: true,
    })),
);

const adminPermissions = permissions.map((item) => item.permissionCode);
const hrPermissions = adminPermissions.filter(
  (code) =>
    code.startsWith("dashboard.") ||
    code.startsWith("employee.") ||
    code.startsWith("department.") ||
    code.startsWith("position.") ||
    code.startsWith("attendance.") ||
    code.startsWith("leave.") ||
    code.startsWith("report.") ||
    code.startsWith("audit."),
);
const employeePermissions = [
  "dashboard.view",
  "attendance.view",
  "attendance.create",
  "leave.view",
  "leave.create",
];

export const roles: Role[] = [
  {
    id: "role-admin",
    roleCode: "ADMIN",
    roleName: "System Administrator",
    description: "Toàn quyền quản trị hệ thống",
    permissions: adminPermissions,
    isActive: true,
  },
  {
    id: "role-hr",
    roleCode: "HR",
    roleName: "Human Resources",
    description: "Quản lý nhân sự, chấm công và nghỉ phép",
    permissions: hrPermissions,
    isActive: true,
  },
  {
    id: "role-sales",
    roleCode: "SALES",
    roleName: "Sales",
    description: "Quản lý khách hàng, doanh số và KPI",
    permissions: adminPermissions.filter(
      (code) =>
        code.startsWith("dashboard.") ||
        code.startsWith("sale.") ||
        code.startsWith("kpi.") ||
        code.startsWith("customer.") ||
        code.startsWith("report."),
    ),
    isActive: true,
  },
  {
    id: "role-payroll",
    roleCode: "PAYROLL",
    roleName: "Payroll",
    description: "Quản lý bảng lương",
    permissions: adminPermissions.filter(
      (code) =>
        code.startsWith("dashboard.") ||
        code.startsWith("payroll.") ||
        code.startsWith("employee.view") ||
        code.startsWith("attendance.view") ||
        code.startsWith("report."),
    ),
    isActive: true,
  },
  {
    id: "role-employee",
    roleCode: "EMPLOYEE",
    roleName: "Employee",
    description: "Nhân viên tự phục vụ",
    permissions: employeePermissions,
    isActive: true,
  },
];

export const users: User[] = [
  {
    id: "user-admin",
    employeeId: "emp-001",
    username: "admin",
    email: "admin@ems.demo",
    isActive: true,
    roleIds: ["role-admin"],
  },
  {
    id: "user-hr",
    employeeId: "emp-001",
    username: "hr",
    email: "hr@ems.demo",
    isActive: true,
    roleIds: ["role-hr"],
  },
  {
    id: "user-sales",
    employeeId: "emp-004",
    username: "sales",
    email: "sales@ems.demo",
    isActive: true,
    roleIds: ["role-sales"],
  },
  {
    id: "user-payroll",
    employeeId: "emp-006",
    username: "payroll",
    email: "payroll@ems.demo",
    isActive: true,
    roleIds: ["role-payroll"],
  },
  {
    id: "user-employee",
    employeeId: "emp-006",
    username: "employee",
    email: "employee@ems.demo",
    isActive: true,
    roleIds: ["role-employee"],
  },
];

export const menus: MenuItem[] = [
  ["dashboard", "Tổng quan", "dashboard", "/hr/dashboard", "dashboard.view"],
  ["attendance", "Chấm công", "clock", "/hr/attendance", "attendance.view"],
  ["employees", "Nhân viên", "people", "/hr/employees", "employee.view"],
  ["organization", "Phòng ban", "building", "/hr/organization", "department.view"],
  ["shifts", "Ca làm", "calendar", "/hr/shifts", "attendance.view"],
  ["leave", "Nghỉ phép", "document", "/hr/leave", "leave.view"],
  ["customers", "Khách hàng", "contacts", "/sales/customers", "customer.view"],
  ["sales", "Sales", "money", "/sales/records", "sale.view"],
  ["kpi", "KPI", "target", "/sales/kpis", "kpi.view"],
  ["payroll", "Bảng lương", "wallet", "/payroll", "payroll.view"],
  ["reports", "Báo cáo", "chart", "/hr/reports", "report.view"],
  ["users", "Tài khoản", "shield", "/admin/users", "user.view"],
  ["audit", "Audit log", "history", "/admin/audit", "audit.view"],
].map(([code, name, icon, route, permission], index) => ({
  id: `menu-${code}`,
  menuCode: code,
  menuName: name,
  icon,
  route,
  displayOrder: index + 1,
  isVisible: true,
  isActive: true,
  permissions: [permission],
}));

export const customers: Customer[] = [
  {
    id: "cus-001",
    customerCode: "CUS001",
    customerName: "An Phát Retail",
    email: "contact@anphat.demo",
    phone: "0901888123",
    address: "Quận 3, TP. Hồ Chí Minh",
    status: "active",
    contractEndDate: "2026-12-31",
  },
  {
    id: "cus-002",
    customerCode: "CUS002",
    customerName: "Bình Minh Logistics",
    email: "ops@binhminh.demo",
    phone: "0912444567",
    address: "Thủ Đức, TP. Hồ Chí Minh",
    status: "expiring",
    contractEndDate: "2026-09-15",
  },
  {
    id: "cus-003",
    customerCode: "CUS003",
    customerName: "Cửu Long Foods",
    email: "hello@cuulong.demo",
    phone: "0933777999",
    address: "Cần Thơ",
    status: "active",
    contractEndDate: "2027-03-20",
  },
];

export const salesRecords: SaleRecord[] = [
  {
    id: "sale-001",
    saleCode: "SALE001",
    employeeId: "emp-004",
    customerId: "cus-001",
    contractValue: 85000000,
    saleDate: "2026-08-05",
    status: "approved",
    note: "Hợp đồng dịch vụ năm",
    reviewedBy: "user-admin",
    reviewedAt: "2026-08-06T03:00:00.000Z",
  },
  {
    id: "sale-002",
    saleCode: "SALE002",
    employeeId: "emp-010",
    customerId: "cus-002",
    contractValue: 42000000,
    saleDate: "2026-08-12",
    status: "pending",
    note: "Gia hạn hợp đồng quý",
  },
  {
    id: "sale-003",
    saleCode: "SALE003",
    employeeId: "emp-016",
    customerId: "cus-003",
    contractValue: 125000000,
    saleDate: "2026-08-18",
    status: "approved",
    note: "Triển khai chi nhánh mới",
    reviewedBy: "user-admin",
    reviewedAt: "2026-08-19T04:30:00.000Z",
  },
];

export const kpis: Kpi[] = [
  {
    id: "kpi-001",
    employeeId: "emp-004",
    period: "2026-08",
    targetValue: 100000000,
    actualValue: 85000000,
    achievementRate: 85,
    status: "in-progress",
  },
  {
    id: "kpi-002",
    employeeId: "emp-010",
    period: "2026-08",
    targetValue: 75000000,
    actualValue: 42000000,
    achievementRate: 56,
    status: "in-progress",
  },
  {
    id: "kpi-003",
    employeeId: "emp-016",
    period: "2026-08",
    targetValue: 120000000,
    actualValue: 125000000,
    achievementRate: 104.2,
    status: "completed",
  },
];

export const payrolls: Payroll[] = employees.slice(0, 12).map((employee, index) => {
  const baseSalary = 10000000 + (index % 5) * 1800000;
  const workingDays = 20 + (index % 3);
  const leaveDays = index % 4;
  const commission = employee.departmentId === "dep-sales" ? 2500000 : 0;
  const allowance = 700000;
  const deduction = leaveDays * Math.round(baseSalary / 26);
  const grossSalary = baseSalary + commission + allowance;
  const netSalary = grossSalary - deduction;
  return {
    id: `payroll-${employee.id}`,
    employeeId: employee.id,
    period: "2026-08",
    baseSalary,
    workingDays,
    leaveDays,
    commission,
    allowance,
    deduction,
    grossSalary,
    netSalary,
    status: index < 4 ? "approved" : index < 8 ? "draft" : "paid",
    note: "Dữ liệu bảng lương minh họa",
  };
});

export const leaveBalances: LeaveBalance[] = employees.map((employee) => ({
  id: `balance-${employee.id}`,
  employeeId: employee.id,
  year: 2026,
  leaveType: "annual",
  allocated: 12,
  used: 12 - employee.leaveBalance,
  remaining: employee.leaveBalance,
}));

export const overtimeRequests: OvertimeRequest[] = [
  {
    id: "ot-001",
    employeeId: "emp-006",
    date: "2026-08-21",
    hours: 2,
    reason: "Hoàn tất báo cáo sprint",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "ot-002",
    employeeId: "emp-014",
    date: "2026-08-19",
    hours: 3,
    reason: "Hỗ trợ triển khai khách hàng",
    status: "approved",
    reviewNote: "Đã xác nhận với trưởng bộ phận",
    createdAt: subDays(new Date(), 2).toISOString(),
    reviewedAt: subDays(new Date(), 1).toISOString(),
  },
];

export const auditLogs: AuditLog[] = [
  {
    id: "audit-001",
    userId: "user-hr",
    module: "Attendance",
    action: "approve",
    target: "adj-002",
    createdAt: subDays(new Date(), 1).toISOString(),
    ipAddress: "127.0.0.1",
  },
  {
    id: "audit-002",
    userId: "user-admin",
    module: "Payroll",
    action: "calculate",
    target: "2026-08",
    createdAt: new Date().toISOString(),
    ipAddress: "127.0.0.1",
  },
];

export function createSeedData(): SeedData {
  const today = format(new Date(), "yyyy-MM-dd");
  return {
    users: users.map((item) => ({ ...item, roleIds: [...item.roleIds] })),
    roles: roles.map((item) => ({
      ...item,
      permissions: [...item.permissions],
    })),
    permissions: permissions.map((item) => ({ ...item })),
    menus: menus.map((item) => ({ ...item, permissions: [...item.permissions] })),
    departments: departments.map((item) => ({ ...item })),
    positions: positions.map((item) => ({ ...item })),
    shifts: shifts.map((item) => ({ ...item })),
    employees: employees.map((item) => ({ ...item })),
    shiftAssignments: employees.map((employee) => ({
      id: `assignment-${employee.id}`,
      employeeId: employee.id,
      shiftId: employee.shiftId,
      effectiveFrom: employee.startDate,
    })),
    attendanceRecords: generateAttendance(),
    adjustmentRequests: [
      {
        id: "adj-001",
        employeeId: "emp-006",
        date: format(subDays(new Date(), 2), "yyyy-MM-dd"),
        requestedCheckIn: isoAt(
          format(subDays(new Date(), 2), "yyyy-MM-dd"),
          "08:01",
        ),
        requestedCheckOut: isoAt(
          format(subDays(new Date(), 2), "yyyy-MM-dd"),
          "17:35",
        ),
        reason: "Điện thoại hết pin nên chưa ghi nhận check-out.",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "adj-002",
        employeeId: "emp-014",
        date: format(subDays(new Date(), 5), "yyyy-MM-dd"),
        requestedCheckIn: isoAt(
          format(subDays(new Date(), 5), "yyyy-MM-dd"),
          "07:58",
        ),
        reason: "Ứng dụng không nhận vị trí tại sảnh.",
        status: "approved",
        reviewNote: "Đã đối chiếu camera sảnh.",
        createdAt: subDays(new Date(), 4).toISOString(),
        reviewedAt: subDays(new Date(), 3).toISOString(),
      },
    ],
    leaveRequests: [
      {
        id: "leave-001",
        employeeId: "emp-006",
        type: "annual",
        startDate: format(subDays(new Date(), -5), "yyyy-MM-dd"),
        endDate: format(subDays(new Date(), -6), "yyyy-MM-dd"),
        days: 2,
        reason: "Giải quyết việc gia đình.",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "leave-002",
        employeeId: "emp-009",
        type: "sick",
        startDate: format(subDays(new Date(), 3), "yyyy-MM-dd"),
        endDate: format(subDays(new Date(), 3), "yyyy-MM-dd"),
        days: 1,
        reason: "Khám sức khỏe theo chỉ định.",
        status: "approved",
        reviewNote: "Đã xác nhận.",
        createdAt: subDays(new Date(), 5).toISOString(),
        reviewedAt: subDays(new Date(), 4).toISOString(),
      },
      {
        id: "leave-003",
        employeeId: "emp-021",
        type: "annual",
        startDate: format(subDays(new Date(), -9), "yyyy-MM-dd"),
        endDate: format(subDays(new Date(), -10), "yyyy-MM-dd"),
        days: 2,
        reason: "Nghỉ phép cá nhân.",
        status: "pending",
        createdAt: subDays(new Date(), 1).toISOString(),
      },
    ],
    leaveBalances: leaveBalances.map((item) => ({ ...item })),
    overtimeRequests: overtimeRequests.map((item) => ({ ...item })),
    customers: customers.map((item) => ({ ...item })),
    salesRecords: salesRecords.map((item) => ({ ...item })),
    kpis: kpis.map((item) => ({ ...item })),
    payrolls: payrolls.map((item) => ({ ...item })),
    auditLogs: auditLogs.map((item) => ({ ...item })),
    notifications: [
      {
        id: "note-001",
        title: "Đơn nghỉ phép mới",
        body: "Có 2 đơn nghỉ phép đang chờ xử lý.",
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: "note-002",
        employeeId: "emp-006",
        title: "Yêu cầu đã ghi nhận",
        body: "HR đang xem xét yêu cầu điều chỉnh chấm công của bạn.",
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: "note-003",
        title: "Dữ liệu minh họa",
        body: `Bộ dữ liệu được làm mới ngày ${today}.`,
        createdAt: new Date().toISOString(),
        read: true,
      },
    ],
  };
}

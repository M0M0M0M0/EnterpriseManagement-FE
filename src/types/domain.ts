export type UserRole = "admin" | "hr" | "manager" | "sales" | "payroll" | "employee";
export type EmployeeStatus = "active" | "inactive";
export type AttendanceMethod = "geolocation" | "qr";
export type AttendanceStatus =
  "on-time" | "late" | "early-leave" | "absent" | "missing-checkout";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type LeaveType = "annual" | "sick" | "unpaid" | "compensatory" | "other";
export type EmploymentStatus = "active" | "probation" | "inactive" | "terminated";
export type Gender = "male" | "female" | "other";
export type SaleStatus = "pending" | "approved" | "rejected" | "cancelled";
export type KpiStatus = "active" | "in-progress" | "completed";
export type PayrollStatus = "draft" | "approved" | "paid";
export type CustomerStatus = "active" | "expiring" | "inactive";

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  managerId?: string;
}

export interface Position {
  id: string;
  name: string;
  departmentId: string;
  level: "staff" | "lead" | "manager";
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  departmentId: string;
  positionId: string;
  managerId?: string;
  shiftId: string;
  startDate: string;
  hireDate?: string;
  birthDate: string;
  gender?: Gender;
  address: string;
  status: EmployeeStatus;
  employmentStatus?: EmploymentStatus;
  baseSalary?: number;
  leaveBalance: number;
  avatarColor: string;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface AttendanceCapture {
  method: AttendanceMethod;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  locationLabel?: string;
  qrToken?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  shiftId: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  capture?: AttendanceCapture;
  note?: string;
}

export interface AttendanceAdjustmentRequest {
  id: string;
  employeeId: string;
  attendanceId?: string;
  date: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: RequestStatus;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: RequestStatus;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  cancelledAt?: string;
}

export interface Permission {
  id: string;
  permissionCode: string;
  permissionName: string;
  module: string;
  description?: string;
  isActive: boolean;
}

export interface Role {
  id: string;
  roleCode: string;
  roleName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
}

export interface User {
  id: string;
  employeeId?: string;
  username: string;
  email: string;
  isActive: boolean;
  roleIds: string[];
  lastLoginAt?: string;
}

export interface MenuItem {
  id: string;
  parentMenuId?: string;
  menuCode: string;
  menuName: string;
  icon: string;
  route: string;
  displayOrder: number;
  isVisible: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  leaveType: LeaveType;
  allocated: number;
  used: number;
  remaining: number;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  reason: string;
  status: RequestStatus;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  contractEndDate?: string;
}

export interface SaleRecord {
  id: string;
  saleCode: string;
  employeeId: string;
  customerId: string;
  contractValue: number;
  saleDate: string;
  status: SaleStatus;
  note?: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  cancelReason?: string;
  correctionReason?: string;
}

export interface Kpi {
  id: string;
  employeeId: string;
  period: string;
  targetValue: number;
  actualValue: number;
  achievementRate: number;
  status: KpiStatus;
}

export interface Payroll {
  id: string;
  employeeId: string;
  period: string;
  baseSalary: number;
  workingDays: number;
  leaveDays: number;
  commission: number;
  allowance: number;
  deduction: number;
  grossSalary: number;
  netSalary: number;
  status: PayrollStatus;
  note?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  module: string;
  action: string;
  target: string;
  createdAt: string;
  ipAddress: string;
}

export interface AttendanceSummary {
  employeeId?: string;
  departmentId?: string;
  month: number;
  year: number;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  totalWorkHours: number;
}

export interface DashboardOverview {
  employees: { total: number; active: number; inactive: number };
  attendance: { present: number; absent: number; onLeave: number; late: number };
  sales: { totalSales: number; revenue: number };
  payroll: { totalPayroll: number };
}

export interface ApiListResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiResult<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

export interface Notification {
  id: string;
  employeeId?: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface DemoSession {
  locationMode: "inside" | "outside";
  simulatedDate?: string;
  simulateError: boolean;
}

export interface SeedData {
  users: User[];
  roles: Role[];
  permissions: Permission[];
  menus: MenuItem[];
  departments: Department[];
  positions: Position[];
  shifts: Shift[];
  employees: Employee[];
  shiftAssignments: ShiftAssignment[];
  attendanceRecords: AttendanceRecord[];
  adjustmentRequests: AttendanceAdjustmentRequest[];
  leaveRequests: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  overtimeRequests: OvertimeRequest[];
  customers: Customer[];
  salesRecords: SaleRecord[];
  kpis: Kpi[];
  payrolls: Payroll[];
  auditLogs: AuditLog[];
  notifications: Notification[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

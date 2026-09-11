export type UserRole = "admin" | "manager" | "employee";

export type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface AuthSession {
  token: string;
  username: string;
  employeeCode?: string;
  roles: string[];
}

export interface EmployeeDto {
  employeeCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentCode: string;
  departmentName: string;
  positionCode: string;
  positionName: string;
  managerCode?: string;
  employmentStatus: string;
  hireDate: string;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentCode: string;
  positionCode: string;
  managerCode?: string;
  hireDate: string;
}

export interface UpdateEmployeeRequest {
  phone?: string;
  address?: string;
  departmentCode: string;
  positionCode: string;
  managerCode?: string;
}

export interface DepartmentDto {
  departmentCode: string;
  departmentName: string;
  managerName?: string;
  description?: string;
  isActive: boolean;
}

export interface CreateDepartmentRequest {
  departmentCode: string;
  departmentName: string;
  managerId?: number;
  description?: string;
}

export interface UpdateDepartmentRequest {
  departmentName: string;
  managerId?: number;
  description?: string;
}

export interface PositionDto {
  positionCode: string;
  positionName: string;
  description?: string;
  isActive: boolean;
  standardSalary?: number;
}

export interface CreatePositionRequest {
  positionCode: string;
  positionName: string;
  description?: string;
}

export interface UpdatePositionRequest {
  positionName: string;
  description?: string;
}

export interface AttendanceRecordDto {
  employeeCode: string;
  employeeName: string;
  attendanceDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  status: string;
}

export interface AttendanceAdjustmentDto {
  id: number;
  employeeCode: string;
  employeeName: string;
  attendanceDate: string;
  reason: string;
  oldCheckInTime?: string;
  newCheckInTime?: string;
  oldCheckOutTime?: string;
  newCheckOutTime?: string;
  status: string;
  approverName?: string;
  approvedAt?: string;
}

export interface SubmitAdjustmentRequest {
  attendanceDate: string;
  reason: string;
  newCheckInTime?: string;
  newCheckOutTime?: string;
}

export type LeaveUnit = "Days" | "Hours";
export type LeaveAccrualPeriod = "ProratedYearly" | "MonthlyReset" | "FlatYearly";
export type LeaveSession = "Morning" | "Afternoon" | "FullDay";

export interface LeaveTypeDto {
  leaveTypeCode: string;
  leaveTypeName: string;
  accrualAmount: number;
  accrualUnit: LeaveUnit;
  accrualPeriod: LeaveAccrualPeriod;
  isPaid: boolean;
  description?: string;
  isActive: boolean;
}

export interface LeaveBalanceDto {
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  month?: number;
  unit: LeaveUnit;
  allocatedTime: number;
  usedTime: number;
  remainingTime: number;
}

export interface LeaveRequestDto {
  id: number;
  employeeCode: string;
  employeeName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  session?: LeaveSession;
  unit: LeaveUnit;
  totalTime: number;
  reason?: string;
  status: string;
  approverName?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface SubmitLeaveRequest {
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  session?: LeaveSession;
  reason?: string;
}

export interface CustomerDto {
  customerCode: string;
  customerName: string;
  phone?: string;
  email?: string;
  address?: string;
  assignedEmployeeName?: string;
  status: string;
}

export interface CreateCustomerRequest {
  customerName: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SaleDto {
  id: number;
  saleCode: string;
  customerCode: string;
  customerName: string;
  employeeCode: string;
  employeeName: string;
  amount: number;
  orderDate: string;
  status: string;
  note?: string;
  approverName?: string;
  approvedAt?: string;
}

export interface SubmitSaleRequest {
  customerCode: string;
  amount: number;
  note?: string;
}

export interface UpdateSaleRequest {
  amount: number;
  note?: string;
}

export interface EmployeeDashboardDto {
  employeeCode: string;
  employeeName: string;
  todayAttendance?: AttendanceRecordDto;
  totalRemainingLeaveDays: number;
  pendingLeaveRequestsCount: number;
  pendingSalesCount: number;
  pendingAttendanceAdjustmentsCount: number;
}

export interface ManagerDashboardDto {
  managerCode: string;
  teamSize: number;
  pendingLeaveRequestsCount: number;
  pendingSalesCount: number;
  pendingAttendanceAdjustmentsCount: number;
  teamMonthlyRevenue: number;
  teamPresentTodayCount: number;
  teamAbsentTodayCount: number;
}

export interface UserDto {
  username: string;
  email: string;
  employeeCode?: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  roleCode: string;
  employeeCode?: string;
}

export interface UpdateUserRequest {
  email?: string;
  employeeCode?: string;
  roleCodes?: string[];
  isActive?: boolean;
}

export interface CreateUserResult {
  user: UserDto;
  generatedPassword: string;
}

export interface RoleDto {
  roleCode: string;
  roleName: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
}

export interface CreateRoleRequest {
  roleCode: string;
  roleName: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  roleName: string;
  description?: string;
  permissions: string[];
}

export interface PermissionDto {
  permissionCode: string;
  permissionName: string;
  module: string;
  description?: string;
  isActive: boolean;
}

export interface CreatePermissionRequest {
  permissionCode: string;
  permissionName: string;
  module: string;
  description?: string;
}

export interface UpdatePermissionRequest {
  permissionName: string;
  module: string;
  description?: string;
}

export interface MenuDto {
  menuCode: string;
  menuName: string;
  icon?: string;
  route: string;
  displayOrder: number;
  permissions: string[];
  isVisible: boolean;
  isActive: boolean;
}

export interface CreateMenuRequest {
  menuCode: string;
  menuName: string;
  icon?: string;
  route: string;
  displayOrder: number;
  permissions: string[];
}

export interface UpdateMenuRequest {
  menuName: string;
  icon?: string;
  route: string;
  displayOrder: number;
  permissions: string[];
}

export interface AuditLogDto {
  id: number | string;
  createdAt: string;
  username?: string;
  module: string;
  action: string;
  target?: string;
  ipAddress?: string;
}

export interface AuditLogFilters {
  username?: string;
  module?: string;
  action?: string;
  date?: string;
}

export interface SalaryCalculationResult {
  employeeCode: string;
  year: number;
  month: number;
  baseSalary: number;
  standardWorkingDays: number;
  deductedDays: number;
  dailyRate: number;
  deductionAmount: number;
  netSalary: number;
}

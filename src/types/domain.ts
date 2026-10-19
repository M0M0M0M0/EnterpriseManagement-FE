export type UserRole = "admin" | "manager" | "hr" | "employee";

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
  // Mã quyền của tài khoản (trả về lúc đăng nhập); phiên cũ chưa lưu thì undefined.
  permissions?: string[];
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface EmployeeDto {
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentCode: string;
  departmentName: string;
  positionCode: string;
  positionName: string;
  managerCode?: string;
  managerName?: string;
  employmentStatus: string;
  hireDate: string;
  // Tài khoản đăng nhập gắn với hồ sơ (quan hệ 1-1).
  username: string;
  roleCodes: string[];
  roleNames: string[];
  isAccountActive: boolean;
  lastLoginAt?: string;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  // Bỏ trống thì backend lấy theo chức vụ (mặc định EMPLOYEE).
  roleCode?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentCode: string;
  positionCode: string;
  managerCode?: string;
  hireDate: string;
}

export interface CreateEmployeeResult {
  employee: EmployeeDto;
  generatedPassword: string;
}

export interface UpdateEmployeeRequest {
  firstName: string;
  lastName: string;
  email?: string;
  roleCodes?: string[];
  phone?: string;
  address?: string;
  departmentCode: string;
  positionCode: string;
  managerCode?: string;
}

export interface DepartmentDto {
  departmentCode: string;
  departmentName: string;
  managerCode?: string;
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
  // Mã mới của phòng ban (bỏ trống hoặc giống mã cũ thì giữ nguyên).
  departmentCode?: string;
  departmentName: string;
  // Mã nhân viên làm trưởng phòng: không gửi = giữ nguyên, chuỗi rỗng = bỏ trưởng phòng.
  managerCode?: string;
  description?: string;
}

// Các giá trị Module và Action đang có trong nhật ký hệ thống (cho ô chọn ở màn lọc).
export interface AuditLogFilterOptionsDto {
  modules: string[];
  actions: string[];
}

export interface PositionDto {
  positionCode: string;
  positionName: string;
  description?: string;
  isActive: boolean;
  standardSalary?: number;
  // Vai trò mặc định của chức vụ (nếu backend trả).
  roleCode?: string;
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
  // Tóm tắt cả ngày: Present, Late, HalfDay, HalfDayAbsent, Absent, OnLeave, None.
  status: string;
  // Trạng thái hiệu lực tách theo buổi (SessionStatus) và nguồn (SessionSource) do backend tính; xem types/attendanceHr.ts.
  morningStatus?: string;
  afternoonStatus?: string;
  morningSource?: string;
  afternoonSource?: string;
  leaveTypeName?: string;
  morningNote?: string;
  afternoonNote?: string;
  isWeekend?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  // Số phút làm thêm giờ đã được duyệt trong ngày.
  overtimeMinutes?: number;
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
  // Pending (chờ Manager), PendingHr (Manager đã duyệt, chờ người xử lý áp dụng), Approved (đã áp dụng), Rejected.
  status: string;
  approverName?: string;
  approvedAt?: string;
  processedByName?: string;
  processedAt?: string;
  rejectionReason?: string;
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

export interface UpdateLeaveTypeRequest {
  leaveTypeName: string;
  accrualAmount: number;
  accrualUnit: LeaveUnit;
  accrualPeriod: LeaveAccrualPeriod;
  isPaid: boolean;
  description?: string;
}

export interface CreateLeaveTypeRequest extends UpdateLeaveTypeRequest {
  leaveTypeCode: string;
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
  // Phần phép đã được hoàn do rút ngắn phép; usedTime và remainingTime ở trên đã tính phần hoàn này.
  refundedTime?: number;
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

export interface EmployeeDashboardDto {
  employeeCode: string;
  employeeName: string;
  todayAttendance?: AttendanceRecordDto;
  totalRemainingLeaveDays: number;
  pendingLeaveRequestsCount: number;
  pendingAttendanceAdjustmentsCount: number;
}

export interface ManagerDashboardDto {
  managerCode: string;
  teamSize: number;
  pendingLeaveRequestsCount: number;
  pendingAttendanceAdjustmentsCount: number;
  teamPresentTodayCount: number;
  teamOnLeaveTodayCount?: number;
  teamAbsentTodayCount: number;
}

export interface ResetPasswordResult {
  username: string;
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

export interface OrgTreeNodeDto {
  employeeCode: string;
  fullName: string;
  positionName: string;
  departmentName: string;
  employmentStatus: string;
  todayAttendanceStatus: string;
  subordinateCount: number;
  subordinates: OrgTreeNodeDto[];
}

// Một thông báo trong hộp thông báo (khớp NotificationDto của backend).
export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  route?: string | null;
  refId?: number | null;
  isRead: boolean;
  createdAt: string;
}

// Vị trí công ty và bán kính cho phép chấm công.
export interface OfficeLocationDto {
  name: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
}

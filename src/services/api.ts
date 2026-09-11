import { http } from "./http";
import type {
  AttendanceAdjustmentDto,
  AttendanceRecordDto,
  AuthSession,
  CreateCustomerRequest,
  CreateDepartmentRequest,
  CreateEmployeeRequest,
  CreatePositionRequest,
  CreateUserRequest,
  CreateUserResult,
  CustomerDto,
  DepartmentDto,
  EmployeeDashboardDto,
  EmployeeDto,
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveTypeDto,
  ManagerDashboardDto,
  PositionDto,
  SaleDto,
  SalaryCalculationResult,
  SubmitAdjustmentRequest,
  SubmitLeaveRequest,
  SubmitSaleRequest,
  UpdateDepartmentRequest,
  UpdateEmployeeRequest,
  UpdatePositionRequest,
  UpdateSaleRequest,
  UserDto,
} from "../types/domain";

export const authApi = {
  login: (username: string, password: string) =>
    http.post<AuthSession & { token: string }>("/auth/login", { username, password }),
};

export const dashboardApi = {
  employee: (employeeCode: string) =>
    http.get<EmployeeDashboardDto>(`/dashboard/employee/${employeeCode}`),
  manager: (managerCode: string) =>
    http.get<ManagerDashboardDto>(`/dashboard/manager/${managerCode}`),
};

export const employeeApi = {
  getAll: () => http.get<EmployeeDto[]>("/employees"),
  getByCode: (employeeCode: string) =>
    http.get<EmployeeDto>(`/employees/${employeeCode}`),
  getTeam: (managerEmployeeCode: string) =>
    http.get<EmployeeDto[]>(`/employees/team/${managerEmployeeCode}`),
  create: (request: CreateEmployeeRequest) =>
    http.post<EmployeeDto>("/employees", request),
  update: (employeeCode: string, request: UpdateEmployeeRequest) =>
    http.put<EmployeeDto>(`/employees/${employeeCode}`, request),
  setActive: (employeeCode: string, isActive: boolean) =>
    http.put<EmployeeDto>(`/employees/${employeeCode}/active`, { isActive }),
};

export const departmentApi = {
  getAll: () => http.get<DepartmentDto[]>("/departments"),
  getByCode: (departmentCode: string) =>
    http.get<DepartmentDto>(`/departments/${departmentCode}`),
  create: (request: CreateDepartmentRequest) =>
    http.post<DepartmentDto>("/departments", request),
  update: (departmentCode: string, request: UpdateDepartmentRequest) =>
    http.put<DepartmentDto>(`/departments/${departmentCode}`, request),
  setActive: (departmentCode: string, isActive: boolean) =>
    http.put<DepartmentDto>(`/departments/${departmentCode}/active`, { isActive }),
};

export const positionApi = {
  getAll: () => http.get<PositionDto[]>("/positions"),
  getByCode: (positionCode: string) =>
    http.get<PositionDto>(`/positions/${positionCode}`),
  create: (request: CreatePositionRequest) =>
    http.post<PositionDto>("/positions", request),
  update: (positionCode: string, request: UpdatePositionRequest) =>
    http.put<PositionDto>(`/positions/${positionCode}`, request),
  setActive: (positionCode: string, isActive: boolean) =>
    http.put<PositionDto>(`/positions/${positionCode}/active`, { isActive }),
  setStandardSalary: (positionCode: string, standardSalary: number) =>
    http.put<PositionDto>(`/positions/${positionCode}/salary`, { standardSalary }),
};

export const attendanceApi = {
  punch: () => http.post<AttendanceRecordDto>("/attendance/punch"),
  getHistory: (employeeCode: string) =>
    http.get<AttendanceRecordDto[]>(`/attendance/${employeeCode}/history`),
  getByDepartment: (departmentCode: string, startDate: string, endDate: string) =>
    http.get<AttendanceRecordDto[]>(
      `/attendance/department/${departmentCode}?startDate=${startDate}&endDate=${endDate}`,
    ),
  submitAdjustment: (request: SubmitAdjustmentRequest) =>
    http.post<AttendanceAdjustmentDto>("/attendance/adjustments", request),
  getMyAdjustments: () =>
    http.get<AttendanceAdjustmentDto[]>("/attendance/adjustments/mine"),
  getPendingAdjustments: () =>
    http.get<AttendanceAdjustmentDto[]>("/attendance/adjustments/pending"),
  approveAdjustment: (id: number) =>
    http.put<AttendanceAdjustmentDto>(`/attendance/adjustments/${id}/approve`),
  rejectAdjustment: (id: number) =>
    http.put<AttendanceAdjustmentDto>(`/attendance/adjustments/${id}/reject`),
};

export const leaveTypeApi = {
  getAll: () => http.get<LeaveTypeDto[]>("/leave-types"),
};

export const leaveBalanceApi = {
  getByEmployee: (employeeCode: string, year: number) =>
    http.get<LeaveBalanceDto[]>(`/leave-balances/${employeeCode}?year=${year}`),
  setAllocatedDays: (
    employeeCode: string,
    leaveTypeCode: string,
    year: number,
    allocatedDays: number,
  ) =>
    http.put<LeaveBalanceDto>("/leave-balances", {
      employeeCode,
      leaveTypeCode,
      year,
      allocatedDays,
    }),
};

export const leaveRequestApi = {
  submit: (request: SubmitLeaveRequest) =>
    http.post<LeaveRequestDto>("/leave-requests", request),
  getMine: () => http.get<LeaveRequestDto[]>("/leave-requests/mine"),
  cancel: (id: number) => http.put<LeaveRequestDto>(`/leave-requests/${id}/cancel`),
  getPending: () => http.get<LeaveRequestDto[]>("/leave-requests/pending"),
  getHistory: () => http.get<LeaveRequestDto[]>("/leave-requests/history"),
  approve: (id: number) => http.put<LeaveRequestDto>(`/leave-requests/${id}/approve`),
  reject: (id: number, rejectionReason?: string) =>
    http.put<LeaveRequestDto>(`/leave-requests/${id}/reject`, { rejectionReason }),
};

export const customerApi = {
  getAll: () => http.get<CustomerDto[]>("/customers"),
  getByCode: (customerCode: string) =>
    http.get<CustomerDto>(`/customers/${customerCode}`),
  create: (request: CreateCustomerRequest) =>
    http.post<CustomerDto>("/customers", request),
};

export const saleApi = {
  submit: (request: SubmitSaleRequest) => http.post<SaleDto>("/sales", request),
  getMine: () => http.get<SaleDto[]>("/sales/mine"),
  update: (id: number, request: UpdateSaleRequest) =>
    http.put<SaleDto>(`/sales/${id}`, request),
  getPending: () => http.get<SaleDto[]>("/sales/pending"),
  getHistory: () => http.get<SaleDto[]>("/sales/history"),
  approve: (id: number) => http.put<SaleDto>(`/sales/${id}/approve`),
  reject: (id: number) => http.put<SaleDto>(`/sales/${id}/reject`),
};

export const userApi = {
  getAll: () => http.get<UserDto[]>("/users"),
  create: (request: CreateUserRequest) => http.post<CreateUserResult>("/users", request),
  setActive: (username: string, isActive: boolean) =>
    http.put<UserDto>(`/users/${username}/active`, { isActive }),
  resetPassword: (username: string) =>
    http.post<CreateUserResult>(`/users/${username}/reset-password`),
};

export const payrollApi = {
  calculate: (employeeCode: string, year: number, month: number) =>
    http.get<SalaryCalculationResult>(
      `/payroll/calculate?employeeCode=${employeeCode}&year=${year}&month=${month}`,
    ),
};

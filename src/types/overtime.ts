// Làm thêm giờ (OT), ngày nghỉ lễ và bảng công tháng. Khớp hợp đồng API của backend.

export type OvertimeStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface SubmitOvertimeRequest {
  date: string;
  // Giờ dạng "HH:mm".
  startTime: string;
  endTime: string;
  reason: string;
}

export interface OvertimeRequestDto {
  id: number;
  employeeCode: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  reason: string;
  status: OvertimeStatus;
  approverName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// Hạn mức làm thêm giờ theo luật (tháng/năm) và phần đã dùng hoặc đang chờ duyệt.
export interface OvertimeQuotaDto {
  year: number;
  month: number;
  monthUsedMinutes: number;
  monthLimitMinutes: number;
  yearUsedMinutes: number;
  yearLimitMinutes: number;
}

export interface HolidayDto {
  id: number;
  date: string;
  name: string;
}

export interface TimesheetRowDto {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  workedDays: number;
  leaveDays: number;
  absentDays: number;
  lateSessions: number;
  overtimeHours: number;
}

export interface TimesheetDto {
  year: number;
  month: number;
  standardDays: number;
  isClosed: boolean;
  closedAt?: string;
  closedByName?: string;
  rows: TimesheetRowDto[];
}

import { http } from "./http";
import type { AttendanceAdjustmentDto, AttendanceRecordDto } from "../types/domain";
import type {
  AttendanceCalendarDayDto,
  AttendanceNoteDto,
  CreateAttendanceNoteRequest,
  LeaveReturnPreviewDto,
  LeaveReturnRequestDto,
  ProcessLeaveReturnRequest,
  SubmitLeaveReturnRequest,
} from "../types/attendanceHr";

// Lịch hiệu lực từng ngày (tách buổi sáng/chiều) và chấm công toàn công ty.
export const attendanceViewApi = {
  getCalendar: (employeeCode: string, from: string, to: string) =>
    http.get<AttendanceCalendarDayDto[]>(`/attendance/${employeeCode}/calendar?from=${from}&to=${to}`),
  // Quyền attendance.view.all. departmentCode để trống = toàn công ty.
  getAll: (startDate: string, endDate: string, departmentCode?: string) =>
    http.get<AttendanceRecordDto[]>(
      `/attendance/all?startDate=${startDate}&endDate=${endDate}${departmentCode ? `&departmentCode=${departmentCode}` : ""}`,
    ),
};

// Ghi chú ngoại lệ chấm công (quyền attendance.note.manage).
export const attendanceNoteApi = {
  list: (from: string, to: string, employeeCode?: string) =>
    http.get<AttendanceNoteDto[]>(
      `/attendance-notes?from=${from}&to=${to}${employeeCode ? `&employeeCode=${employeeCode}` : ""}`,
    ),
  create: (request: CreateAttendanceNoteRequest) => http.post<AttendanceNoteDto[]>("/attendance-notes", request),
  revoke: (id: number) => http.delete<void>(`/attendance-notes/${id}`),
};

// Điều chỉnh công bước 2: người có quyền attendance.adjustment.apply áp dụng sau khi Manager đã duyệt.
export const adjustmentProcessingApi = {
  getPending: () => http.get<AttendanceAdjustmentDto[]>("/attendance/adjustments/pending-processing"),
  apply: (id: number) => http.put<AttendanceAdjustmentDto>(`/attendance/adjustments/${id}/apply`),
  reject: (id: number, rejectionReason?: string) =>
    http.put<AttendanceAdjustmentDto>(`/attendance/adjustments/${id}/reject-processing`, { rejectionReason }),
};

// Yêu cầu đi làm lại.
export const leaveReturnApi = {
  // Nhân viên (leave.request.self)
  preview: (fromDate: string, fromSession: string) =>
    http.get<LeaveReturnPreviewDto>(`/leave-returns/preview?fromDate=${fromDate}&fromSession=${fromSession}`),
  submit: (request: SubmitLeaveReturnRequest) => http.post<LeaveReturnRequestDto>("/leave-returns", request),
  getMine: () => http.get<LeaveReturnRequestDto[]>("/leave-returns/mine"),
  // Manager (leave.request.view / leave.request.approve)
  getPending: () => http.get<LeaveReturnRequestDto[]>("/leave-returns/pending"),
  approve: (id: number) => http.put<LeaveReturnRequestDto>(`/leave-returns/${id}/approve`),
  reject: (id: number, reason?: string) => http.put<LeaveReturnRequestDto>(`/leave-returns/${id}/reject`, { reason }),
  // Người xử lý (attendance.note.manage)
  getAwaitingProcessing: () => http.get<LeaveReturnRequestDto[]>("/leave-returns/awaiting-processing"),
  process: (id: number, request: ProcessLeaveReturnRequest) =>
    http.put<LeaveReturnRequestDto>(`/leave-returns/${id}/process`, request),
  rejectProcessing: (id: number, reason?: string) =>
    http.put<LeaveReturnRequestDto>(`/leave-returns/${id}/reject-processing`, { reason }),
};

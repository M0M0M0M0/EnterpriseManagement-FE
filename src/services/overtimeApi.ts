import { http } from "./http";
import type {
  HolidayDto,
  OvertimeQuotaDto,
  OvertimeRequestDto,
  SubmitOvertimeRequest,
  TimesheetDto,
} from "../types/overtime";

// Xin làm thêm giờ: nhân viên gửi/hủy (overtime.request.self), quản lý duyệt (overtime.request.view / approve).
export const overtimeApi = {
  submit: (request: SubmitOvertimeRequest) => http.post<OvertimeRequestDto>("/overtime-requests", request),
  getMine: () => http.get<OvertimeRequestDto[]>("/overtime-requests/mine"),
  getQuota: () => http.get<OvertimeQuotaDto>("/overtime-requests/quota"),
  cancel: (id: number) => http.put<OvertimeRequestDto>(`/overtime-requests/${id}/cancel`),
  getPending: () => http.get<OvertimeRequestDto[]>("/overtime-requests/pending"),
  getHistory: () => http.get<OvertimeRequestDto[]>("/overtime-requests/history"),
  approve: (id: number) => http.put<OvertimeRequestDto>(`/overtime-requests/${id}/approve`),
  reject: (id: number, rejectionReason?: string) =>
    http.put<OvertimeRequestDto>(`/overtime-requests/${id}/reject`, { rejectionReason }),
};

// Ngày nghỉ lễ: ai đăng nhập cũng xem được; thêm/xóa cần holiday.manage.
export const holidayApi = {
  getByYear: (year: number) => http.get<HolidayDto[]>(`/holidays?year=${year}`),
  create: (date: string, name: string) => http.post<HolidayDto>("/holidays", { date, name }),
  remove: (id: number) => http.delete<void>(`/holidays/${id}`),
};

// Bảng công tháng: xem/xuất cần timesheet.manage, chốt/mở lại cần timesheet.close (trưởng nhân sự).
export const timesheetApi = {
  get: (year: number, month: number) => http.get<TimesheetDto>(`/timesheets?year=${year}&month=${month}`),
  // Bảng công của team mình (quản lý chỉ xem).
  getTeam: (year: number, month: number) => http.get<TimesheetDto>(`/timesheets/team?year=${year}&month=${month}`),
  close: (year: number, month: number) => http.post<unknown>(`/timesheets/close?year=${year}&month=${month}`),
  reopen: (year: number, month: number) => http.delete<void>(`/timesheets/close?year=${year}&month=${month}`),
};

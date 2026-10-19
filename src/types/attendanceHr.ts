// Kiểu dữ liệu cho chấm công theo buổi, ghi chú ngoại lệ, yêu cầu rút ngắn nghỉ phép. Khớp hợp đồng API của backend.

export type SessionStatus = "None" | "OnTime" | "Late" | "Absent" | "OnLeave";
export type SessionSource = "None" | "Weekend" | "Holiday" | "Leave" | "ReturnConfirmed" | "Note" | "Attendance" | "Missing";
export type DaySession = "Morning" | "Afternoon";

// Trạng thái hiệu lực của một ngày, tách theo buổi (API lịch).
export interface AttendanceCalendarDayDto {
  date: string;
  isWeekend: boolean;
  // Ngày nghỉ lễ của công ty (có tên) và số phút làm thêm giờ đã được duyệt trong ngày.
  isHoliday?: boolean;
  holidayName?: string;
  overtimeMinutes?: number;
  morning: SessionStatus;
  afternoon: SessionStatus;
  morningSource: SessionSource;
  afternoonSource: SessionSource;
  leaveTypeName?: string;
  morningNote?: string;
  afternoonNote?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

// ---- Ghi chú ngoại lệ chấm công (HR) ----

export type NoteStatus = "OnTime" | "Late" | "Absent";

export interface CreateAttendanceNoteRequest {
  employeeCode: string;
  startDate: string;
  endDate: string;
  session: "Morning" | "Afternoon" | "FullDay";
  status: NoteStatus;
  note: string;
}

export interface AttendanceNoteDto {
  id: number;
  employeeCode: string;
  employeeName: string;
  date: string;
  session: DaySession;
  status: NoteStatus;
  note: string;
  createdByName: string;
  createdAt: string;
}

// ---- Đi làm lại ----

export type ReturnRequestStatus = "PendingManager" | "PendingHr" | "Completed" | "Rejected";
export type ReturnSessionState = "Pending" | "AwaitingHr" | "Active" | "Rejected";

export interface SubmitLeaveReturnRequest {
  fromDate: string;
  fromSession: DaySession;
  reason: string;
}

export interface LeaveReturnSessionDto {
  date: string;
  session: DaySession;
  leaveRequestId: number;
  leaveTypeName: string;
  state: ReturnSessionState;
  workedStatus?: "OnTime" | "Late";
}

export interface LeaveReturnPreviewDto {
  sessions: LeaveReturnSessionDto[];
  sessionCount: number;
  refundDays: number;
  leaveRequestIds: number[];
}

export interface LeaveReturnRequestDto {
  id: number;
  employeeCode: string;
  employeeName: string;
  fromDate: string;
  fromSession: DaySession;
  reason: string;
  status: ReturnRequestStatus;
  sessions: LeaveReturnSessionDto[];
  managerName?: string;
  managerApprovedAt?: string;
  processedByName?: string;
  processedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface ProcessLeaveReturnItem {
  date: string;
  session: DaySession;
  status: "OnTime" | "Late";
}

export interface ProcessLeaveReturnRequest {
  items: ProcessLeaveReturnItem[];
}

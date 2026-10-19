import { http } from "./http";

export type LeaveCancelStatus = "Pending" | "Approved" | "Rejected" | "Withdrawn";

// Yêu cầu hủy một đơn nghỉ phép đã duyệt nhưng chưa bắt đầu (LeaveCancelRequestDto của backend).
export interface LeaveCancelRequestDto {
  id: number;
  leaveRequestId: number;
  employeeCode: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  session?: string;
  unit: string;
  totalTime: number;
  reason: string;
  status: LeaveCancelStatus;
  managerName?: string;
  decidedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export const leaveCancelStatusLabels: Record<string, string> = {
  Pending: "Chờ duyệt hủy",
  Approved: "Đã hủy",
  Rejected: "Từ chối hủy",
  Withdrawn: "Đã rút lại",
};

// Nhân viên xin hủy (leave.request.self), quản lý duyệt (leave.request.view / leave.request.approve).
export const leaveCancelApi = {
  submit: (leaveRequestId: number, reason: string) =>
    http.post<LeaveCancelRequestDto>("/leave-cancels", { leaveRequestId, reason }),
  getMine: () => http.get<LeaveCancelRequestDto[]>("/leave-cancels/mine"),
  withdraw: (id: number) => http.put<LeaveCancelRequestDto>(`/leave-cancels/${id}/withdraw`),
  getPending: () => http.get<LeaveCancelRequestDto[]>("/leave-cancels/pending"),
  getHistory: () => http.get<LeaveCancelRequestDto[]>("/leave-cancels/history"),
  approve: (id: number) => http.put<LeaveCancelRequestDto>(`/leave-cancels/${id}/approve`),
  reject: (id: number, rejectionReason?: string) =>
    http.put<LeaveCancelRequestDto>(`/leave-cancels/${id}/reject`, { rejectionReason }),
};

export const LEAVE_CANCEL_EVENTS = ["LeaveCancelSubmitted", "LeaveCancelApproved", "LeaveCancelRejected"];

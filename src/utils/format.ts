import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

export const TIMEZONE = "Asia/Ho_Chi_Minh";

export function formatDate(value: string, pattern = "dd/MM/yyyy") {
  return format(parseISO(value), pattern, { locale: vi });
}

export function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTime(value?: string) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isoDate(value = new Date()) {
  return format(value, "yyyy-MM-dd");
}

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const attendanceLabels: Record<string, string> = {
  Present: "Đúng giờ",
  Late: "Đi muộn",
  HalfDay: "Nửa ngày",
  HalfDayAbsent: "Vắng nửa buổi sáng",
  Absent: "Vắng mặt",
  OnLeave: "Nghỉ phép",
};

export const requestLabels: Record<string, string> = {
  Pending: "Chờ duyệt",
  Approved: "Đã duyệt",
  Confirmed: "Đã xác nhận",
  Completed: "Hoàn tất",
  Rejected: "Từ chối",
  Cancelled: "Đã hủy",
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
    value,
  );
}

// Định dạng số khi gõ vào ô nhập tiền: tự thêm dấu phẩy ngăn cách mỗi 3 số 0 (vd 5000000 ->
// 5,000,000). Bỏ mọi ký tự không phải chữ số trước khi nhóm lại, để dùng trực tiếp trong
// onChange của Input mà không cần validate riêng.
export function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Ngược lại với formatAmountInput: bỏ dấu phẩy để lấy số thật, dùng khi submit lên API.
export function parseAmountInput(value: string) {
  return Number(value.replace(/,/g, ""));
}

export const leaveUnitLabels: Record<string, string> = {
  Days: "ngày",
  Hours: "giờ",
};

export function formatLeaveTime(value: number, unit: string) {
  return `${formatNumber(value)} ${leaveUnitLabels[unit] ?? unit}`;
}

export const leaveSessionLabels: Record<string, string> = {
  Morning: "Buổi sáng (08:00-12:00)",
  Afternoon: "Buổi chiều (13:00-17:00)",
  FullDay: "Cả ngày",
};

// Khung giờ nghỉ ngắn cố định 30 phút, khớp với ShortLeaveSlotStarts ở backend
// (LeaveRequestService.cs) — sáng 8h-12h, chiều 13h-17h, không tính giờ nghỉ trưa.
export const shortLeaveSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

export function shortLeaveSlotLabel(start: string) {
  const [h, m] = start.split(":").map(Number);
  const endMinutes = h * 60 + m + 30;
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return `${start} - ${end}`;
}

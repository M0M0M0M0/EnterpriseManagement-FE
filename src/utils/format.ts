import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import type {
  AttendanceStatus,
  LeaveType,
  RequestStatus,
} from "../types/domain";

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

export function countLeaveDays(startDate: string, endDate: string) {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

export const attendanceLabels: Record<AttendanceStatus, string> = {
  "on-time": "Đúng giờ",
  late: "Đi muộn",
  "early-leave": "Về sớm",
  absent: "Vắng mặt",
  "missing-checkout": "Thiếu check-out",
};

export const requestLabels: Record<RequestStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const leaveTypeLabels: Record<LeaveType, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm",
  unpaid: "Nghỉ không lương",
  compensatory: "Nghỉ bù",
  other: "Khác",
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

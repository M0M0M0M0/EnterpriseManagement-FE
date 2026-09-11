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

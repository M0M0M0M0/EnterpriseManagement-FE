import type { TimesheetDto } from "../types/overtime";

// Sự kiện làm tải lại im lặng (khớp NotificationTypes.employeeOvertime / managerOvertime của mobile).
export const OVERTIME_EVENTS = ["OvertimeSubmitted", "OvertimeApproved", "OvertimeRejected"];

// 90 -> "1 giờ 30 phút", 120 -> "2 giờ", 30 -> "30 phút".
export function overtimeDurationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

// 18.5 -> "18,5"; 20 -> "20" (số ngày công hiển thị theo kiểu Việt Nam).
export function dayCountLabel(value: number) {
  return String(value).replace(".", ",");
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

// Dựng CSV (có BOM cho Excel) giống bản mobile.
export function timesheetCsv(sheet: TimesheetDto) {
  const lines = [
    `Bảng công tháng ${String(sheet.month).padStart(2, "0")}/${sheet.year},${sheet.isClosed ? "Đã chốt" : "Chưa chốt"},Công chuẩn ${sheet.standardDays} ngày`,
    "Mã NV,Họ tên,Phòng ban,Ngày công đi làm,Ngày nghỉ phép,Ngày vắng,Số buổi đi muộn,Giờ làm thêm",
    ...sheet.rows.map((r) =>
      [r.employeeCode, r.employeeName, r.departmentName, r.workedDays, r.leaveDays, r.absentDays, r.lateSessions, r.overtimeHours]
        .map(csvCell)
        .join(","),
    ),
  ];
  return `﻿${lines.join("\n")}\n`;
}

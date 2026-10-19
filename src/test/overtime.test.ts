import { describe, expect, it } from "vitest";
import type { TimesheetDto } from "../types/overtime";
import { dayCountLabel, overtimeDurationLabel, timesheetCsv } from "../utils/overtime";

describe("làm thêm giờ", () => {
  it("nhãn thời lượng", () => {
    expect(overtimeDurationLabel(30)).toBe("30 phút");
    expect(overtimeDurationLabel(120)).toBe("2 giờ");
    expect(overtimeDurationLabel(90)).toBe("1 giờ 30 phút");
  });

  it("số ngày công dùng dấu phẩy kiểu Việt Nam", () => {
    expect(dayCountLabel(18.5)).toBe("18,5");
    expect(dayCountLabel(20)).toBe("20");
  });
});

describe("bảng công tháng", () => {
  const sheet: TimesheetDto = {
    year: 2026,
    month: 9,
    standardDays: 22,
    isClosed: true,
    rows: [
      {
        employeeCode: "A1",
        employeeName: 'An "Bé" Nguyễn',
        departmentName: "Kinh doanh",
        workedDays: 20.5,
        leaveDays: 1,
        absentDays: 0.5,
        lateSessions: 2,
        overtimeHours: 3.5,
      },
    ],
  };

  it("CSV có BOM, tiêu đề tháng và thoát dấu nháy kép", () => {
    const csv = timesheetCsv(sheet);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Bảng công tháng 09/2026,Đã chốt,Công chuẩn 22 ngày");
    expect(csv).toContain('"An ""Bé"" Nguyễn"');
    expect(csv).toContain('"20.5","1","0.5","2","3.5"');
  });
});

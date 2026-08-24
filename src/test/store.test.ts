import { beforeEach, describe, expect, it } from "vitest";
import { createSeedData } from "../data/seed";
import { useAppStore } from "../store/useAppStore";

function prepareEmployeeState() {
  useAppStore.setState({
    ...createSeedData(),
    role: "employee",
    currentEmployeeId: "emp-006",
    attendanceRecords: [],
    adjustmentRequests: [],
    leaveRequests: [],
    shiftAssignments: [],
    demo: {
      locationMode: "inside",
      simulateError: false,
      simulatedDate: "2035-01-15",
    },
  });
}

describe("quy tắc nghiệp vụ chấm công", () => {
  beforeEach(() => {
    localStorage.clear();
    prepareEmployeeState();
  });

  it("không cho check-in hai lần trong một ca", () => {
    expect(useAppStore.getState().checkIn().ok).toBe(true);
    expect(useAppStore.getState().checkIn()).toMatchObject({ ok: false });
    expect(useAppStore.getState().attendanceRecords).toHaveLength(1);
  });

  it("không cho check-out khi chưa check-in", () => {
    expect(useAppStore.getState().checkOut()).toMatchObject({ ok: false });
  });

  it("từ chối check-in ngoài bán kính văn phòng", () => {
    useAppStore.getState().setDemoLocation("outside");
    expect(useAppStore.getState().checkIn()).toMatchObject({ ok: false });
  });
});

describe("quy tắc nghỉ phép và phê duyệt", () => {
  beforeEach(prepareEmployeeState);

  it("từ chối khoảng ngày không hợp lệ", () => {
    const result = useAppStore.getState().submitLeave({
      type: "annual",
      startDate: "2035-02-10",
      endDate: "2035-02-09",
      reason: "Việc gia đình",
    });
    expect(result.ok).toBe(false);
  });

  it("từ chối đơn vượt số dư phép", () => {
    const result = useAppStore.getState().submitLeave({
      type: "annual",
      startDate: "2035-02-01",
      endDate: "2035-02-28",
      reason: "Việc gia đình",
    });
    expect(result.ok).toBe(false);
  });

  it("từ chối đơn trùng với đơn đang chờ", () => {
    const input = {
      type: "annual" as const,
      startDate: "2035-02-03",
      endDate: "2035-02-04",
      reason: "Việc gia đình",
    };
    expect(useAppStore.getState().submitLeave(input).ok).toBe(true);
    expect(
      useAppStore.getState().submitLeave({
        ...input,
        startDate: "2035-02-04",
        endDate: "2035-02-05",
      }).ok,
    ).toBe(false);
  });

  it("trừ số dư đúng một lần khi HR duyệt đơn phép năm", () => {
    useAppStore.getState().submitLeave({
      type: "annual",
      startDate: "2035-03-03",
      endDate: "2035-03-04",
      reason: "Việc gia đình",
    });
    const request = useAppStore.getState().leaveRequests[0];
    const before = useAppStore
      .getState()
      .employees.find((item) => item.id === "emp-006")?.leaveBalance;

    expect(
      useAppStore
        .getState()
        .reviewRequest("leave", request.id, "approved", "Đồng ý").ok,
    ).toBe(true);
    expect(
      useAppStore
        .getState()
        .reviewRequest("leave", request.id, "approved", "Duyệt lại").ok,
    ).toBe(false);
    expect(
      useAppStore.getState().employees.find((item) => item.id === "emp-006")
        ?.leaveBalance,
    ).toBe((before ?? 0) - 2);
  });
});

describe("phê duyệt điều chỉnh chấm công", () => {
  beforeEach(prepareEmployeeState);

  it("cập nhật giờ đề xuất vào bản ghi khi HR duyệt", () => {
    useAppStore.setState({
      attendanceRecords: [
        {
          id: "att-test",
          employeeId: "emp-006",
          date: "2035-01-14",
          shiftId: "shift-office",
          checkIn: "2035-01-14T02:30:00.000Z",
          status: "missing-checkout",
        },
      ],
    });
    useAppStore.getState().submitAdjustment({
      date: "2035-01-14",
      requestedCheckIn: "2035-01-14T01:00:00.000Z",
      requestedCheckOut: "2035-01-14T10:30:00.000Z",
      reason: "Thiết bị không ghi nhận",
    });
    const request = useAppStore.getState().adjustmentRequests[0];

    expect(
      useAppStore
        .getState()
        .reviewRequest("adjustment", request.id, "approved", "Đã đối chiếu").ok,
    ).toBe(true);
    expect(useAppStore.getState().attendanceRecords[0]).toMatchObject({
      checkIn: "2035-01-14T01:00:00.000Z",
      checkOut: "2035-01-14T10:30:00.000Z",
      status: "on-time",
    });
  });
});

describe("quy tắc ca làm", () => {
  beforeEach(prepareEmployeeState);

  it("không tạo mẫu ca trùng khoảng thời gian", () => {
    const result = useAppStore.getState().addShift({
      name: "Ca trùng",
      startTime: "08:00",
      endTime: "17:30",
      breakMinutes: 60,
      color: "#2563EB",
    });
    expect(result.ok).toBe(false);
  });

  it("không gán hai ca cùng ngày hiệu lực cho một nhân viên", () => {
    expect(
      useAppStore
        .getState()
        .assignShift("emp-006", "shift-office", "2035-04-01").ok,
    ).toBe(true);
    expect(
      useAppStore.getState().assignShift("emp-006", "shift-early", "2035-04-01")
        .ok,
    ).toBe(false);
  });
});

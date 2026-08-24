import { addMinutes, isAfter, isBefore, parseISO } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSeedData } from "../data/seed";
import type {
  ActionResult,
  AttendanceAdjustmentRequest,
  AttendanceRecord,
  AuthSession,
  Customer,
  DemoSession,
  Department,
  Employee,
  Kpi,
  LeaveRequest,
  OvertimeRequest,
  Payroll,
  Position,
  RequestStatus,
  SaleRecord,
  SeedData,
  Shift,
  UserRole,
} from "../types/domain";
import { countLeaveDays, isoDate } from "../utils/format";

type EmployeeDraft = Omit<Employee, "id" | "employeeCode" | "avatarColor">;
type DepartmentDraft = Omit<Department, "id">;
type ShiftDraft = Omit<Shift, "id">;
type PositionDraft = Omit<Position, "id">;

interface AppState extends SeedData {
  role: UserRole | null;
  currentEmployeeId: string | null;
  currentUserId: string | null;
  authSession: AuthSession | null;
  demo: DemoSession;
  login: (role: UserRole) => void;
  loginWithPassword: (username: string, password: string) => ActionResult;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  currentPermissions: () => string[];
  setDemoLocation: (mode: DemoSession["locationMode"]) => void;
  setSimulatedDate: (date?: string) => void;
  setSimulateError: (value: boolean) => void;
  checkIn: () => ActionResult;
  checkOut: () => ActionResult;
  submitAdjustment: (
    input: Pick<
      AttendanceAdjustmentRequest,
      "date" | "requestedCheckIn" | "requestedCheckOut" | "reason"
    >,
  ) => ActionResult;
  submitLeave: (
    input: Pick<LeaveRequest, "type" | "startDate" | "endDate" | "reason">,
  ) => ActionResult;
  updateLeave: (
    id: string,
    input: Pick<LeaveRequest, "type" | "startDate" | "endDate" | "reason">,
  ) => ActionResult;
  cancelLeave: (id: string, reason: string) => ActionResult;
  submitOvertime: (
    input: Pick<OvertimeRequest, "date" | "hours" | "reason">,
  ) => ActionResult;
  reviewRequest: (
    kind: "leave" | "adjustment" | "overtime",
    id: string,
    status: Exclude<RequestStatus, "pending">,
    note: string,
  ) => ActionResult;
  addEmployee: (draft: EmployeeDraft) => ActionResult;
  updateEmployee: (id: string, draft: Partial<EmployeeDraft>) => ActionResult;
  toggleEmployee: (id: string) => ActionResult;
  addDepartment: (draft: DepartmentDraft) => ActionResult;
  updateDepartment: (id: string, draft: DepartmentDraft) => ActionResult;
  removeDepartment: (id: string) => ActionResult;
  addPosition: (draft: PositionDraft) => ActionResult;
  updatePosition: (id: string, draft: PositionDraft) => ActionResult;
  removePosition: (id: string) => ActionResult;
  addShift: (draft: ShiftDraft) => ActionResult;
  updateShift: (id: string, draft: ShiftDraft) => ActionResult;
  removeShift: (id: string) => ActionResult;
  assignShift: (
    employeeId: string,
    shiftId: string,
    effectiveFrom: string,
  ) => ActionResult;
  addAttendanceRecord: (
    input: Pick<
      AttendanceRecord,
      "employeeId" | "date" | "shiftId" | "checkIn" | "checkOut" | "status" | "note"
    >,
  ) => ActionResult;
  updateAttendanceRecord: (
    id: string,
    input: Partial<AttendanceRecord>,
  ) => ActionResult;
  removeAttendanceRecord: (id: string) => ActionResult;
  addCustomer: (input: Omit<Customer, "id" | "customerCode">) => ActionResult;
  updateCustomer: (id: string, input: Partial<Customer>) => ActionResult;
  addSale: (
    input: Pick<SaleRecord, "employeeId" | "customerId" | "contractValue" | "saleDate" | "note">,
  ) => ActionResult;
  updateSale: (id: string, input: Partial<SaleRecord>) => ActionResult;
  reviewSale: (
    id: string,
    status: "approved" | "rejected",
    note: string,
  ) => ActionResult;
  cancelSale: (id: string, reason: string) => ActionResult;
  correctSale: (id: string, input: Partial<SaleRecord>, reason: string) => ActionResult;
  addKpi: (
    input: Pick<Kpi, "employeeId" | "period" | "targetValue">,
  ) => ActionResult;
  updateKpi: (id: string, targetValue: number) => ActionResult;
  calculateKpi: (id: string) => ActionResult;
  createPayroll: (employeeId: string, period: string) => ActionResult;
  updatePayroll: (
    id: string,
    input: Pick<Payroll, "allowance" | "deduction" | "note">,
  ) => ActionResult;
  calculatePayroll: (id: string) => ActionResult;
  approvePayroll: (id: string, note: string) => ActionResult;
  payPayroll: (
    id: string,
    paymentMethod: string,
    paymentReference: string,
  ) => ActionResult;
  markNotificationsRead: () => void;
  resetDemo: () => void;
}

const initialSession = {
  role: null as UserRole | null,
  currentEmployeeId: null as string | null,
  currentUserId: null as string | null,
  authSession: null as AuthSession | null,
  demo: {
    locationMode: "inside" as const,
    simulateError: false,
  },
};

function currentDate(state: AppState) {
  return state.demo.simulatedDate || isoDate();
}

function currentIso(state: AppState) {
  const date = currentDate(state);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

function roleForDemo(role: UserRole) {
  if (role === "admin") return "user-admin";
  if (role === "sales") return "user-sales";
  if (role === "payroll") return "user-payroll";
  if (role === "employee") return "user-employee";
  return "user-hr";
}

function roleFromUser(state: AppState, userId: string): UserRole {
  const user = state.users.find((item) => item.id === userId);
  const roleCode = state.roles
    .find((role) => user?.roleIds.includes(role.id))
    ?.roleCode.toLowerCase();
  if (roleCode === "admin") return "admin";
  if (roleCode === "sales") return "sales";
  if (roleCode === "payroll") return "payroll";
  if (roleCode === "employee") return "employee";
  return "hr";
}

function permissionsForCurrentUser(state: AppState) {
  const user = state.users.find((item) => item.id === state.currentUserId);
  if (!user) return [];
  const granted = state.roles
    .filter((role) => user.roleIds.includes(role.id) && role.isActive)
    .flatMap((role) => role.permissions);
  return Array.from(new Set(granted));
}

function appendAudit(
  state: AppState,
  module: string,
  action: string,
  target: string,
) {
  return [
    {
      id: `audit-${Date.now()}`,
      userId: state.currentUserId ?? "user-system",
      module,
      action,
      target,
      createdAt: new Date().toISOString(),
      ipAddress: "127.0.0.1",
    },
    ...state.auditLogs,
  ];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createSeedData(),
      ...initialSession,
      login: (role) =>
        set((state) => {
          const currentUserId = roleForDemo(role);
          const user = state.users.find((item) => item.id === currentUserId);
          return {
          role,
          currentUserId,
          currentEmployeeId:
            role === "employee" ? (user?.employeeId ?? "emp-006") : null,
          authSession: {
            accessToken: `mock-access-${Date.now()}`,
            refreshToken: `mock-refresh-${Date.now()}`,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            userId: currentUserId,
          },
          auditLogs: appendAudit(state, "Auth", "login", currentUserId),
        };
        }),
      loginWithPassword: (username, password) => {
        const state = get();
        const user = state.users.find(
          (item) =>
            item.username.toLowerCase() === username.trim().toLowerCase() &&
            item.isActive,
        );
        if (!user || !password.trim())
          return {
            ok: false,
            message: "Tài khoản hoặc mật khẩu không hợp lệ.",
          };
        const role = roleFromUser(state, user.id);
        set((current) => ({
          role,
          currentUserId: user.id,
          currentEmployeeId: role === "employee" ? (user.employeeId ?? null) : null,
          authSession: {
            accessToken: `mock-access-${Date.now()}`,
            refreshToken: `mock-refresh-${Date.now()}`,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            userId: user.id,
          },
          users: current.users.map((item) =>
            item.id === user.id
              ? { ...item, lastLoginAt: new Date().toISOString() }
              : item,
          ),
          auditLogs: appendAudit(current, "Auth", "login", user.id),
        }));
        return { ok: true, message: "Đăng nhập thành công." };
      },
      logout: () =>
        set((state) => ({
          role: null,
          currentEmployeeId: null,
          currentUserId: null,
          authSession: null,
          auditLogs: appendAudit(state, "Auth", "logout", state.currentUserId ?? "guest"),
        })),
      hasPermission: (permission) => {
        const state = get();
        if (!state.role) return false;
        if (state.role === "admin") return true;
        return permissionsForCurrentUser(state).includes(permission);
      },
      currentPermissions: () => permissionsForCurrentUser(get()),
      setDemoLocation: (locationMode) =>
        set((state) => ({ demo: { ...state.demo, locationMode } })),
      setSimulatedDate: (simulatedDate) =>
        set((state) => ({ demo: { ...state.demo, simulatedDate } })),
      setSimulateError: (simulateError) =>
        set((state) => ({ demo: { ...state.demo, simulateError } })),
      checkIn: () => {
        const state = get();
        if (!state.currentEmployeeId)
          return { ok: false, message: "Không xác định được nhân viên." };
        if (state.demo.simulateError)
          return {
            ok: false,
            message: "Mô phỏng lỗi kết nối. Hãy tắt chế độ lỗi và thử lại.",
          };
        if (state.demo.locationMode === "outside")
          return { ok: false, message: "Bạn đang ở ngoài bán kính văn phòng." };
        const date = currentDate(state);
        const existing = state.attendanceRecords.find(
          (item) =>
            item.employeeId === state.currentEmployeeId && item.date === date,
        );
        if (existing?.checkIn)
          return { ok: false, message: "Bạn đã check-in trong ngày này." };
        const employee = state.employees.find(
          (item) => item.id === state.currentEmployeeId,
        );
        if (!employee)
          return { ok: false, message: "Không tìm thấy hồ sơ nhân viên." };
        const capturedAt = currentIso(state);
        const shift = state.shifts.find((item) => item.id === employee.shiftId);
        const shiftStart = new Date(
          `${date}T${shift?.startTime ?? "08:00"}:00+07:00`,
        );
        const status = isAfter(new Date(capturedAt), addMinutes(shiftStart, 5))
          ? "late"
          : "on-time";
        const record: AttendanceRecord = {
          id: existing?.id ?? `att-${date}-${employee.id}`,
          employeeId: employee.id,
          date,
          shiftId: employee.shiftId,
          checkIn: capturedAt,
          status,
          capture: {
            method: "geolocation",
            capturedAt,
            latitude: 10.7769,
            longitude: 106.7009,
            accuracy: 12,
            locationLabel: "Văn phòng mô phỏng",
          },
        };
        set((current) => ({
          attendanceRecords: existing
            ? current.attendanceRecords.map((item) =>
                item.id === existing.id ? { ...item, ...record } : item,
              )
            : [record, ...current.attendanceRecords],
        }));
        return {
          ok: true,
          message:
            status === "late"
              ? "Check-in thành công. Hệ thống ghi nhận đi muộn."
              : "Check-in thành công.",
        };
      },
      checkOut: () => {
        const state = get();
        if (!state.currentEmployeeId)
          return { ok: false, message: "Không xác định được nhân viên." };
        if (state.demo.simulateError)
          return {
            ok: false,
            message: "Mô phỏng lỗi kết nối. Hãy thử lại sau.",
          };
        const date = currentDate(state);
        const record = state.attendanceRecords.find(
          (item) =>
            item.employeeId === state.currentEmployeeId && item.date === date,
        );
        if (!record?.checkIn)
          return {
            ok: false,
            message: "Bạn cần check-in trước khi check-out.",
          };
        if (record.checkOut)
          return { ok: false, message: "Bạn đã check-out trong ngày này." };
        const capturedAt = currentIso(state);
        const shift = state.shifts.find((item) => item.id === record.shiftId);
        const shiftEnd = new Date(
          `${date}T${shift?.endTime ?? "17:30"}:00+07:00`,
        );
        const status = isBefore(new Date(capturedAt), addMinutes(shiftEnd, -10))
          ? "early-leave"
          : record.status === "late"
            ? "late"
            : "on-time";
        set((current) => ({
          attendanceRecords: current.attendanceRecords.map((item) =>
            item.id === record.id
              ? { ...item, checkOut: capturedAt, status }
              : item,
          ),
        }));
        return {
          ok: true,
          message:
            status === "early-leave"
              ? "Check-out thành công. Hệ thống ghi nhận về sớm."
              : "Check-out thành công.",
        };
      },
      submitAdjustment: (input) => {
        const state = get();
        if (!state.currentEmployeeId)
          return { ok: false, message: "Không xác định được nhân viên." };
        if (!input.reason.trim())
          return { ok: false, message: "Vui lòng nhập lý do điều chỉnh." };
        const duplicate = state.adjustmentRequests.some(
          (item) =>
            item.employeeId === state.currentEmployeeId &&
            item.date === input.date &&
            item.status === "pending",
        );
        if (duplicate)
          return {
            ok: false,
            message: "Ngày này đã có yêu cầu đang chờ xử lý.",
          };
        const request: AttendanceAdjustmentRequest = {
          id: `adj-${Date.now()}`,
          employeeId: state.currentEmployeeId,
          attendanceId: state.attendanceRecords.find(
            (item) =>
              item.employeeId === state.currentEmployeeId &&
              item.date === input.date,
          )?.id,
          ...input,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((current) => ({
          adjustmentRequests: [request, ...current.adjustmentRequests],
        }));
        return { ok: true, message: "Đã gửi yêu cầu điều chỉnh chấm công." };
      },
      submitLeave: (input) => {
        const state = get();
        if (!state.currentEmployeeId)
          return { ok: false, message: "Không xác định được nhân viên." };
        if (!input.reason.trim())
          return { ok: false, message: "Vui lòng nhập lý do nghỉ." };
        const days = countLeaveDays(input.startDate, input.endDate);
        if (days < 1)
          return {
            ok: false,
            message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
          };
        const employee = state.employees.find(
          (item) => item.id === state.currentEmployeeId,
        );
        if (input.type === "annual" && days > (employee?.leaveBalance ?? 0))
          return { ok: false, message: "Số ngày nghỉ vượt quá phép còn lại." };
        const start = parseISO(input.startDate);
        const end = parseISO(input.endDate);
        const overlap = state.leaveRequests.some((item) => {
          if (
            item.employeeId !== state.currentEmployeeId ||
            item.status === "rejected"
          )
            return false;
          return (
            !isAfter(start, parseISO(item.endDate)) &&
            !isBefore(end, parseISO(item.startDate))
          );
        });
        if (overlap)
          return {
            ok: false,
            message: "Khoảng nghỉ bị trùng với một đơn đã tồn tại.",
          };
        const request: LeaveRequest = {
          id: `leave-${Date.now()}`,
          employeeId: state.currentEmployeeId,
          ...input,
          days,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((current) => ({
          leaveRequests: [request, ...current.leaveRequests],
        }));
        return { ok: true, message: "Đơn nghỉ phép đã được gửi." };
      },
      updateLeave: (id, input) => {
        const state = get();
        const request = state.leaveRequests.find((item) => item.id === id);
        if (!request || request.status !== "pending")
          return {
            ok: false,
            message: "Chỉ có thể cập nhật đơn đang chờ duyệt.",
          };
        const days = countLeaveDays(input.startDate, input.endDate);
        if (days < 1)
          return {
            ok: false,
            message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
          };
        set((current) => ({
          leaveRequests: current.leaveRequests.map((item) =>
            item.id === id ? { ...item, ...input, days } : item,
          ),
          auditLogs: appendAudit(current, "Leave", "update", id),
        }));
        return { ok: true, message: "Đã cập nhật đơn nghỉ phép." };
      },
      cancelLeave: (id, reason) => {
        if (!reason.trim())
          return { ok: false, message: "Vui lòng nhập lý do hủy đơn." };
        const request = get().leaveRequests.find((item) => item.id === id);
        if (!request || request.status !== "pending")
          return { ok: false, message: "Chỉ có thể hủy đơn đang chờ duyệt." };
        set((state) => ({
          leaveRequests: state.leaveRequests.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "cancelled",
                  reviewNote: reason,
                  cancelledAt: new Date().toISOString(),
                }
              : item,
          ),
          auditLogs: appendAudit(state, "Leave", "cancel", id),
        }));
        return { ok: true, message: "Đã hủy đơn nghỉ phép." };
      },
      submitOvertime: (input) => {
        const state = get();
        if (!state.currentEmployeeId)
          return { ok: false, message: "Không xác định được nhân viên." };
        if (input.hours <= 0 || !input.reason.trim())
          return { ok: false, message: "Nhập số giờ OT và lý do hợp lệ." };
        const request: OvertimeRequest = {
          id: `ot-${Date.now()}`,
          employeeId: state.currentEmployeeId,
          ...input,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((current) => ({
          overtimeRequests: [request, ...current.overtimeRequests],
          auditLogs: appendAudit(current, "Overtime", "create", request.id),
        }));
        return { ok: true, message: "Đã gửi đăng ký OT." };
      },
      reviewRequest: (kind, id, status, note) => {
        const reviewedAt = new Date().toISOString();
        if (kind === "leave") {
          const request = get().leaveRequests.find((item) => item.id === id);
          if (!request || request.status !== "pending")
            return {
              ok: false,
              message: "Đơn không còn ở trạng thái chờ duyệt.",
            };
          set((state) => ({
            leaveRequests: state.leaveRequests.map((item) =>
              item.id === id
                ? { ...item, status, reviewNote: note, reviewedAt }
                : item,
            ),
            employees:
              status === "approved" && request.type === "annual"
                ? state.employees.map((employee) =>
                    employee.id === request.employeeId
                      ? {
                          ...employee,
                          leaveBalance: Math.max(
                            0,
                            employee.leaveBalance - request.days,
                          ),
                        }
                      : employee,
                  )
                : state.employees,
            auditLogs: appendAudit(state, "Leave", status, id),
          }));
        } else if (kind === "adjustment") {
          const request = get().adjustmentRequests.find(
            (item) => item.id === id,
          );
          if (!request || request.status !== "pending")
            return {
              ok: false,
              message: "Yêu cầu không còn ở trạng thái chờ duyệt.",
            };
          set((state) => ({
            adjustmentRequests: state.adjustmentRequests.map((item) =>
              item.id === id
                ? { ...item, status, reviewNote: note, reviewedAt }
                : item,
            ),
            attendanceRecords:
              status === "approved" && request.attendanceId
                ? state.attendanceRecords.map((item) =>
                    item.id === request.attendanceId
                      ? {
                          ...item,
                          checkIn: request.requestedCheckIn ?? item.checkIn,
                          checkOut: request.requestedCheckOut ?? item.checkOut,
                          status: "on-time",
                        }
                      : item,
                  )
                : state.attendanceRecords,
            auditLogs: appendAudit(state, "Attendance", status, id),
          }));
        } else {
          const request = get().overtimeRequests.find((item) => item.id === id);
          if (!request || request.status !== "pending")
            return {
              ok: false,
              message: "Yêu cầu OT không còn ở trạng thái chờ duyệt.",
            };
          set((state) => ({
            overtimeRequests: state.overtimeRequests.map((item) =>
              item.id === id
                ? { ...item, status, reviewNote: note, reviewedAt }
                : item,
            ),
            auditLogs: appendAudit(state, "Overtime", status, id),
          }));
        }
        return {
          ok: true,
          message:
            status === "approved" ? "Đã duyệt yêu cầu." : "Đã từ chối yêu cầu.",
        };
      },
      addEmployee: (draft) => {
        const state = get();
        if (
          state.employees.some(
            (item) => item.email.toLowerCase() === draft.email.toLowerCase(),
          )
        )
          return { ok: false, message: "Email đã được sử dụng." };
        const nextNumber =
          Math.max(
            ...state.employees.map((item) =>
              Number(item.employeeCode.replace("NV", "")),
            ),
            0,
          ) + 1;
        const employee: Employee = {
          ...draft,
          id: `emp-${Date.now()}`,
          employeeCode: `NV${String(nextNumber).padStart(3, "0")}`,
          avatarColor: "#2563EB",
        };
        set((current) => ({ employees: [employee, ...current.employees] }));
        return { ok: true, message: "Đã thêm nhân viên mới." };
      },
      updateEmployee: (id, draft) => {
        if (!get().employees.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy nhân viên." };
        set((state) => ({
          employees: state.employees.map((item) =>
            item.id === id ? { ...item, ...draft } : item,
          ),
        }));
        return { ok: true, message: "Đã cập nhật hồ sơ nhân viên." };
      },
      toggleEmployee: (id) => {
        if (!get().employees.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy nhân viên." };
        set((state) => ({
          employees: state.employees.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: item.status === "active" ? "inactive" : "active",
                }
              : item,
          ),
        }));
        return { ok: true, message: "Đã cập nhật trạng thái nhân viên." };
      },
      addDepartment: (draft) => {
        if (
          get().departments.some(
            (item) => item.code.toLowerCase() === draft.code.toLowerCase(),
          )
        )
          return { ok: false, message: "Mã phòng ban đã tồn tại." };
        set((state) => ({
          departments: [
            ...state.departments,
            { ...draft, id: `dep-${Date.now()}` },
          ],
        }));
        return { ok: true, message: "Đã thêm phòng ban." };
      },
      updateDepartment: (id, draft) => {
        if (!get().departments.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy phòng ban." };
        if (
          get().departments.some(
            (item) =>
              item.id !== id &&
              item.code.toLowerCase() === draft.code.toLowerCase(),
          )
        )
          return { ok: false, message: "Mã phòng ban đã tồn tại." };
        set((state) => ({
          departments: state.departments.map((item) =>
            item.id === id ? { ...item, ...draft } : item,
          ),
        }));
        return { ok: true, message: "Đã cập nhật phòng ban." };
      },
      removeDepartment: (id) => {
        if (get().employees.some((item) => item.departmentId === id))
          return {
            ok: false,
            message: "Không thể xóa phòng ban đang có nhân viên.",
          };
        set((state) => ({
          departments: state.departments.filter((item) => item.id !== id),
        }));
        return { ok: true, message: "Đã xóa phòng ban." };
      },
      addPosition: (draft) => {
        if (
          get().positions.some(
            (item) =>
              item.name.toLowerCase() === draft.name.toLowerCase() &&
              item.departmentId === draft.departmentId,
          )
        )
          return { ok: false, message: "Chức vụ đã tồn tại trong phòng ban." };
        set((state) => ({
          positions: [
            ...state.positions,
            { ...draft, id: `pos-${Date.now()}` },
          ],
        }));
        return { ok: true, message: "Đã thêm chức vụ." };
      },
      updatePosition: (id, draft) => {
        if (!get().positions.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy chức vụ." };
        if (
          get().positions.some(
            (item) =>
              item.id !== id &&
              item.name.toLowerCase() === draft.name.toLowerCase() &&
              item.departmentId === draft.departmentId,
          )
        )
          return { ok: false, message: "Chức vụ đã tồn tại trong phòng ban." };
        set((state) => ({
          positions: state.positions.map((item) =>
            item.id === id ? { ...item, ...draft } : item,
          ),
        }));
        return { ok: true, message: "Đã cập nhật chức vụ." };
      },
      removePosition: (id) => {
        if (get().employees.some((item) => item.positionId === id))
          return {
            ok: false,
            message: "Không thể xóa chức vụ đang được sử dụng.",
          };
        set((state) => ({
          positions: state.positions.filter((item) => item.id !== id),
        }));
        return { ok: true, message: "Đã xóa chức vụ." };
      },
      addShift: (draft) => {
        const duplicate = get().shifts.some(
          (item) =>
            item.startTime === draft.startTime &&
            item.endTime === draft.endTime,
        );
        if (duplicate)
          return {
            ok: false,
            message: "Đã có một mẫu ca cùng khoảng thời gian.",
          };
        if (!draft.name.trim() || draft.endTime <= draft.startTime)
          return {
            ok: false,
            message: "Tên ca hoặc khoảng thời gian không hợp lệ.",
          };
        set((state) => ({
          shifts: [...state.shifts, { ...draft, id: `shift-${Date.now()}` }],
        }));
        return { ok: true, message: "Đã thêm mẫu ca." };
      },
      updateShift: (id, draft) => {
        if (!get().shifts.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy mẫu ca." };
        const duplicate = get().shifts.some(
          (item) =>
            item.id !== id &&
            item.startTime === draft.startTime &&
            item.endTime === draft.endTime,
        );
        if (duplicate)
          return {
            ok: false,
            message: "Đã có một mẫu ca cùng khoảng thời gian.",
          };
        if (!draft.name.trim() || draft.endTime <= draft.startTime)
          return {
            ok: false,
            message: "Tên ca hoặc khoảng thời gian không hợp lệ.",
          };
        set((state) => ({
          shifts: state.shifts.map((item) =>
            item.id === id ? { ...item, ...draft } : item,
          ),
        }));
        return { ok: true, message: "Đã cập nhật mẫu ca." };
      },
      removeShift: (id) => {
        const state = get();
        if (
          state.employees.some((item) => item.shiftId === id) ||
          state.shiftAssignments.some((item) => item.shiftId === id)
        )
          return {
            ok: false,
            message: "Không thể xóa ca đang được phân công.",
          };
        set((current) => ({
          shifts: current.shifts.filter((item) => item.id !== id),
        }));
        return { ok: true, message: "Đã xóa mẫu ca." };
      },
      assignShift: (employeeId, shiftId, effectiveFrom) => {
        const state = get();
        if (
          !state.employees.some((item) => item.id === employeeId) ||
          !state.shifts.some((item) => item.id === shiftId)
        )
          return { ok: false, message: "Nhân viên hoặc ca làm không hợp lệ." };
        if (
          state.shiftAssignments.some(
            (item) =>
              item.employeeId === employeeId &&
              item.effectiveFrom === effectiveFrom,
          )
        )
          return {
            ok: false,
            message: "Nhân viên đã có ca hiệu lực trong ngày này.",
          };
        set((current) => ({
          employees: current.employees.map((item) =>
            item.id === employeeId ? { ...item, shiftId } : item,
          ),
          shiftAssignments: [
            {
              id: `assignment-${Date.now()}`,
              employeeId,
              shiftId,
              effectiveFrom,
            },
            ...current.shiftAssignments,
          ],
        }));
        return { ok: true, message: "Đã gán ca cho nhân viên." };
      },
      addAttendanceRecord: (input) => {
        const duplicate = get().attendanceRecords.some(
          (item) => item.employeeId === input.employeeId && item.date === input.date,
        );
        if (duplicate)
          return { ok: false, message: "Nhân viên đã có bản ghi trong ngày này." };
        const record: AttendanceRecord = {
          id: `att-manual-${Date.now()}`,
          ...input,
          capture: {
            method: "qr",
            capturedAt: new Date().toISOString(),
            qrToken: "manual-entry",
          },
        };
        set((state) => ({
          attendanceRecords: [record, ...state.attendanceRecords],
          auditLogs: appendAudit(state, "Attendance", "create", record.id),
        }));
        return { ok: true, message: "Đã tạo bản ghi chấm công." };
      },
      updateAttendanceRecord: (id, input) => {
        if (!get().attendanceRecords.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy bản ghi chấm công." };
        set((state) => ({
          attendanceRecords: state.attendanceRecords.map((item) =>
            item.id === id ? { ...item, ...input } : item,
          ),
          auditLogs: appendAudit(state, "Attendance", "update", id),
        }));
        return { ok: true, message: "Đã cập nhật bản ghi chấm công." };
      },
      removeAttendanceRecord: (id) => {
        if (!get().attendanceRecords.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy bản ghi chấm công." };
        set((state) => ({
          attendanceRecords: state.attendanceRecords.filter((item) => item.id !== id),
          auditLogs: appendAudit(state, "Attendance", "delete", id),
        }));
        return { ok: true, message: "Đã xóa bản ghi chấm công." };
      },
      addCustomer: (input) => {
        const nextNumber = get().customers.length + 1;
        const customer: Customer = {
          ...input,
          id: `cus-${Date.now()}`,
          customerCode: `CUS${String(nextNumber).padStart(3, "0")}`,
        };
        set((state) => ({
          customers: [customer, ...state.customers],
          auditLogs: appendAudit(state, "Customer", "create", customer.id),
        }));
        return { ok: true, message: "Đã thêm khách hàng." };
      },
      updateCustomer: (id, input) => {
        if (!get().customers.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy khách hàng." };
        set((state) => ({
          customers: state.customers.map((item) =>
            item.id === id ? { ...item, ...input } : item,
          ),
          auditLogs: appendAudit(state, "Customer", "update", id),
        }));
        return { ok: true, message: "Đã cập nhật khách hàng." };
      },
      addSale: (input) => {
        const nextNumber = get().salesRecords.length + 1;
        const sale: SaleRecord = {
          id: `sale-${Date.now()}`,
          saleCode: `SALE${String(nextNumber).padStart(3, "0")}`,
          ...input,
          status: "pending",
        };
        set((state) => ({
          salesRecords: [sale, ...state.salesRecords],
          auditLogs: appendAudit(state, "Sales", "create", sale.id),
        }));
        return { ok: true, message: "Đã tạo sale." };
      },
      updateSale: (id, input) => {
        if (!get().salesRecords.some((item) => item.id === id))
          return { ok: false, message: "Không tìm thấy sale." };
        set((state) => ({
          salesRecords: state.salesRecords.map((item) =>
            item.id === id ? { ...item, ...input } : item,
          ),
          auditLogs: appendAudit(state, "Sales", "update", id),
        }));
        return { ok: true, message: "Đã cập nhật sale." };
      },
      reviewSale: (id, status, note) => {
        const sale = get().salesRecords.find((item) => item.id === id);
        if (!sale || sale.status !== "pending")
          return { ok: false, message: "Sale không còn ở trạng thái chờ duyệt." };
        set((state) => ({
          salesRecords: state.salesRecords.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status,
                  reviewNote: note,
                  reviewedBy: state.currentUserId ?? undefined,
                  reviewedAt: new Date().toISOString(),
                }
              : item,
          ),
          auditLogs: appendAudit(state, "Sales", status, id),
        }));
        return { ok: true, message: "Đã xử lý sale." };
      },
      cancelSale: (id, reason) => {
        if (!reason.trim())
          return { ok: false, message: "Vui lòng nhập lý do hủy sale." };
        set((state) => ({
          salesRecords: state.salesRecords.map((item) =>
            item.id === id
              ? { ...item, status: "cancelled", cancelReason: reason }
              : item,
          ),
          auditLogs: appendAudit(state, "Sales", "cancel", id),
        }));
        return { ok: true, message: "Đã hủy sale." };
      },
      correctSale: (id, input, reason) => {
        if (!reason.trim())
          return { ok: false, message: "Vui lòng nhập lý do điều chỉnh." };
        set((state) => ({
          salesRecords: state.salesRecords.map((item) =>
            item.id === id
              ? { ...item, ...input, correctionReason: reason }
              : item,
          ),
          auditLogs: appendAudit(state, "Sales", "correct", id),
        }));
        return { ok: true, message: "Đã điều chỉnh sale đã duyệt." };
      },
      addKpi: (input) => {
        const kpi: Kpi = {
          id: `kpi-${Date.now()}`,
          ...input,
          actualValue: 0,
          achievementRate: 0,
          status: "in-progress",
        };
        set((state) => ({
          kpis: [kpi, ...state.kpis],
          auditLogs: appendAudit(state, "KPI", "create", kpi.id),
        }));
        return { ok: true, message: "Đã tạo KPI." };
      },
      updateKpi: (id, targetValue) => {
        if (targetValue <= 0)
          return { ok: false, message: "Target KPI phải lớn hơn 0." };
        set((state) => ({
          kpis: state.kpis.map((item) =>
            item.id === id ? { ...item, targetValue } : item,
          ),
          auditLogs: appendAudit(state, "KPI", "update", id),
        }));
        return { ok: true, message: "Đã cập nhật KPI." };
      },
      calculateKpi: (id) => {
        const state = get();
        const kpi = state.kpis.find((item) => item.id === id);
        if (!kpi) return { ok: false, message: "Không tìm thấy KPI." };
        const actualValue = state.salesRecords
          .filter(
            (sale) =>
              sale.employeeId === kpi.employeeId &&
              sale.saleDate.startsWith(kpi.period) &&
              sale.status === "approved",
          )
          .reduce((sum, sale) => sum + sale.contractValue, 0);
        set((current) => ({
          kpis: current.kpis.map((item) =>
            item.id === id
              ? {
                  ...item,
                  actualValue,
                  achievementRate: Number(
                    ((actualValue / item.targetValue) * 100).toFixed(1),
                  ),
                  status:
                    actualValue >= item.targetValue ? "completed" : "in-progress",
                }
              : item,
          ),
          auditLogs: appendAudit(current, "KPI", "calculate", id),
        }));
        return { ok: true, message: "Đã tính lại KPI." };
      },
      createPayroll: (employeeId, period) => {
        const state = get();
        if (
          state.payrolls.some(
            (item) => item.employeeId === employeeId && item.period === period,
          )
        )
          return { ok: false, message: "Bảng lương kỳ này đã tồn tại." };
        const employee = state.employees.find((item) => item.id === employeeId);
        if (!employee) return { ok: false, message: "Không tìm thấy nhân viên." };
        const baseSalary = employee.baseSalary ?? 12000000;
        const payroll: Payroll = {
          id: `payroll-${Date.now()}`,
          employeeId,
          period,
          baseSalary,
          workingDays: 22,
          leaveDays: 0,
          commission: 0,
          allowance: 0,
          deduction: 0,
          grossSalary: baseSalary,
          netSalary: baseSalary,
          status: "draft",
        };
        set((current) => ({
          payrolls: [payroll, ...current.payrolls],
          auditLogs: appendAudit(current, "Payroll", "create", payroll.id),
        }));
        return { ok: true, message: "Đã tạo bảng lương." };
      },
      updatePayroll: (id, input) => {
        set((state) => ({
          payrolls: state.payrolls.map((item) =>
            item.id === id ? { ...item, ...input } : item,
          ),
          auditLogs: appendAudit(state, "Payroll", "update", id),
        }));
        return { ok: true, message: "Đã cập nhật bảng lương." };
      },
      calculatePayroll: (id) => {
        const payroll = get().payrolls.find((item) => item.id === id);
        if (!payroll)
          return { ok: false, message: "Không tìm thấy bảng lương." };
        const grossSalary =
          payroll.baseSalary + payroll.commission + payroll.allowance;
        const netSalary = grossSalary - payroll.deduction;
        set((state) => ({
          payrolls: state.payrolls.map((item) =>
            item.id === id ? { ...item, grossSalary, netSalary } : item,
          ),
          auditLogs: appendAudit(state, "Payroll", "calculate", id),
        }));
        return { ok: true, message: "Đã tính lại bảng lương." };
      },
      approvePayroll: (id, note) => {
        set((state) => ({
          payrolls: state.payrolls.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "approved",
                  note,
                  approvedBy: state.currentUserId ?? undefined,
                  approvedAt: new Date().toISOString(),
                }
              : item,
          ),
          auditLogs: appendAudit(state, "Payroll", "approve", id),
        }));
        return { ok: true, message: "Đã duyệt bảng lương." };
      },
      payPayroll: (id, paymentMethod, paymentReference) => {
        set((state) => ({
          payrolls: state.payrolls.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "paid",
                  paymentMethod,
                  paymentReference,
                  paidAt: new Date().toISOString(),
                }
              : item,
          ),
          auditLogs: appendAudit(state, "Payroll", "pay", id),
        }));
        return { ok: true, message: "Đã đánh dấu đã trả lương." };
      },
      markNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((item) => ({
            ...item,
            read: true,
          })),
        })),
      resetDemo: () => set({ ...createSeedData(), ...initialSession }),
    }),
    {
      name: "bussines-attendance-store",
      version: 3,
      migrate: (persisted, version) =>
        version === 3
          ? (persisted as AppState)
          : { ...createSeedData(), ...initialSession },
      partialize: (state) => ({
        role: state.role,
        currentEmployeeId: state.currentEmployeeId,
        currentUserId: state.currentUserId,
        authSession: state.authSession,
        demo: state.demo,
        users: state.users,
        roles: state.roles,
        permissions: state.permissions,
        menus: state.menus,
        departments: state.departments,
        positions: state.positions,
        shifts: state.shifts,
        employees: state.employees,
        shiftAssignments: state.shiftAssignments,
        attendanceRecords: state.attendanceRecords,
        adjustmentRequests: state.adjustmentRequests,
        leaveRequests: state.leaveRequests,
        leaveBalances: state.leaveBalances,
        overtimeRequests: state.overtimeRequests,
        customers: state.customers,
        salesRecords: state.salesRecords,
        kpis: state.kpis,
        payrolls: state.payrolls,
        auditLogs: state.auditLogs,
        notifications: state.notifications,
      }),
    },
  ),
);

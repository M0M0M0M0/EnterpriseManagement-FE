import { describe, expect, it } from "vitest";
import { buildPermissionGroups } from "../components/PermissionGroupEditor";
import type { PermissionDto } from "../types/domain";

const perm = (permissionCode: string, module = permissionCode.startsWith("page.") ? "page" : permissionCode.split(".")[0]): PermissionDto =>
  ({ permissionCode, permissionName: permissionCode, module, description: "", isActive: true }) as PermissionDto;

const codes = (items: PermissionDto[]) => items.map((p) => p.permissionCode);

describe("gom menu và quyền theo nhóm chức năng", () => {
  const all = [
    "page.employee.dashboard", "page.employee.attendance", "page.employee.leave", "attendance.punch", "attendance.adjustment.self", "leave.request.self",
    "page.manager.dashboard", "page.manager.employees", "page.manager.attendance", "page.manager.leave", "page.manager.organization", "page.manager.orgtree",
    "dashboard.view.team", "employee.view.team", "attendance.view.team", "attendance.adjustment.view", "attendance.adjustment.approve", "leave.request.view", "leave.request.approve",
    "page.hr.attendance", "page.hr.attendance-notes", "page.hr.adjustments", "page.hr.leave-returns",
    "attendance.view.all", "attendance.note.manage", "attendance.adjustment.apply", "employee.view.all", "leavebalance.manage",
    "page.admin.employees", "page.admin.departments", "page.admin.positions", "page.admin.leavetypes", "page.admin.audit", "page.admin.system",
    "employee.manage", "user.manage", "department.manage", "position.manage", "leavetype.manage", "role.manage", "permission.manage", "menu.manage", "audit.view",
  ].map((c) => perm(c));

  it("xếp đủ 43 quyền vào 4 nhóm, không còn nhóm Khác", () => {
    const groups = buildPermissionGroups(all);
    expect(groups.map((g) => g.key)).toEqual(["employee", "manager", "hr", "admin"]);
    expect(groups.reduce((n, g) => n + g.menus.length + g.actions.length, 0)).toBe(all.length);
  });

  it("nhóm Nhân viên cơ bản gồm 3 menu và 3 quyền chấm công/nghỉ phép của chính mình", () => {
    const g = buildPermissionGroups(all).find((x) => x.key === "employee")!;
    expect(codes(g.menus)).toEqual(["page.employee.dashboard", "page.employee.attendance", "page.employee.leave"]);
    expect(codes(g.actions)).toEqual(["attendance.punch", "attendance.adjustment.self", "leave.request.self"]);
  });

  it("quyền xem toàn bộ nhân viên thuộc nhóm HR, không thuộc Quản lý", () => {
    const groups = buildPermissionGroups(all);
    expect(codes(groups.find((x) => x.key === "hr")!.actions)).toContain("employee.view.all");
    expect(codes(groups.find((x) => x.key === "manager")!.actions)).not.toContain("employee.view.all");
  });

  it("menu mới chưa khai báo vẫn vào đúng nhóm theo tiền tố, quyền lạ vào nhóm Khác", () => {
    const groups = buildPermissionGroups([perm("page.hr.payroll"), perm("page.manager.reports"), perm("bonus.approve", "bonus")]);
    expect(codes(groups.find((x) => x.key === "hr")!.menus)).toEqual(["page.hr.payroll"]);
    expect(codes(groups.find((x) => x.key === "manager")!.menus)).toEqual(["page.manager.reports"]);
    expect(codes(groups.find((x) => x.key === "other")!.actions)).toEqual(["bonus.approve"]);
  });
});

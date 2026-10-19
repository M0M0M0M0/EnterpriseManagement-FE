import { Badge, Button, Checkbox, Input } from "@fluentui/react-components";
import { ChevronDownRegular, ChevronRightRegular, SearchRegular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import type { PermissionDto } from "../types/domain";
import { EmptyState } from "./ui";

// Gom menu (permission "page.*") và quyền hành động theo NHÓM CHỨC NĂNG, để Admin gán cho một vai trò theo cụm:
// tick ô đầu nhóm là chọn cả nhóm, hoặc tick riêng "tất cả menu" / "tất cả chức năng" của nhóm.
// Chỉ là cách sắp xếp hiển thị: giá trị chọn vẫn là danh sách mã quyền như trước.
interface FunctionalGroupDef {
  key: string;
  label: string;
  hint: string;
  menus: string[];
  actions: string[];
}

const FUNCTIONAL_GROUPS: FunctionalGroupDef[] = [
  {
    key: "employee",
    label: "Nhân viên cơ bản (ai cũng có)",
    hint: "Chấm công, xem lịch sử chấm công của mình, xin điều chỉnh công, xin nghỉ phép.",
    menus: ["page.employee.dashboard", "page.employee.attendance", "page.employee.leave", "page.employee.overtime"],
    actions: ["attendance.punch", "attendance.adjustment.self", "leave.request.self", "overtime.request.self"],
  },
  {
    key: "manager",
    label: "Quản lý (trưởng nhóm, trưởng phòng)",
    hint: "Xem nhân viên và chấm công của team, duyệt đơn nghỉ phép, xác nhận điều chỉnh công, cây tổ chức.",
    menus: [
      "page.manager.dashboard",
      "page.manager.employees",
      "page.manager.attendance",
      "page.manager.timesheet",
      "page.manager.leave",
      "page.manager.organization",
      "page.manager.orgtree",
    ],
    actions: [
      "dashboard.view.team",
      "employee.view.team",
      "attendance.view.team",
      "attendance.adjustment.view",
      "attendance.adjustment.approve",
      "leave.request.view",
      "leave.request.approve",
      "overtime.request.view",
      "overtime.request.approve",
    ],
  },
  {
    key: "hr",
    label: "Nhân sự (HR)",
    hint: "Chấm công toàn công ty, ghi nhận ngoại lệ, xử lý điều chỉnh công và đi làm lại, bảng công tháng, ngày nghỉ lễ, cấp lại số ngày nghỉ.",
    menus: ["page.hr.attendance", "page.hr.adjustments", "page.hr.leave-returns", "page.hr.attendance-notes", "page.hr.timesheet", "page.hr.holidays"],
    actions: [
      "attendance.view.all",
      "attendance.note.manage",
      "attendance.adjustment.apply",
      "employee.view.all",
      "leavebalance.manage",
      "timesheet.manage",
      "timesheet.close",
      "holiday.manage",
    ],
  },
  {
    key: "admin",
    label: "Quản trị hệ thống (Admin)",
    hint: "Quản lý nhân viên và tài khoản, phòng ban, chức vụ, loại nghỉ, vai trò, quyền, menu và nhật ký hệ thống.",
    menus: [
      "page.admin.employees",
      "page.admin.departments",
      "page.admin.positions",
      "page.admin.leavetypes",
      "page.admin.audit",
      "page.admin.system",
    ],
    actions: [
      "employee.manage",
      "user.manage",
      "department.manage",
      "position.manage",
      "leavetype.manage",
      "role.manage",
      "permission.manage",
      "menu.manage",
      "audit.view",
    ],
  },
];

const OTHER_GROUP: Pick<FunctionalGroupDef, "key" | "label" | "hint"> = {
  key: "other",
  label: "Khác",
  hint: "Các quyền chưa thuộc nhóm nào ở trên (ví dụ quyền mới được thêm sau).",
};

// Quyền/menu mới chưa có trong danh sách trên vẫn được xếp đúng nhóm theo tiền tố của mã trang.
const PAGE_PREFIX_GROUP: Record<string, string> = {
  "page.employee.": "employee",
  "page.manager.": "manager",
  "page.hr.": "hr",
  "page.admin.": "admin",
};

export interface PermissionGroup {
  key: string;
  label: string;
  hint: string;
  menus: PermissionDto[];
  actions: PermissionDto[];
}

export function buildPermissionGroups(permissions: PermissionDto[]): PermissionGroup[] {
  const groups: PermissionGroup[] = [
    ...FUNCTIONAL_GROUPS.map((g) => ({ key: g.key, label: g.label, hint: g.hint, menus: [] as PermissionDto[], actions: [] as PermissionDto[] })),
    { ...OTHER_GROUP, menus: [], actions: [] },
  ];
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const explicit = new Map<string, string>();
  for (const def of FUNCTIONAL_GROUPS) {
    for (const code of [...def.menus, ...def.actions]) explicit.set(code, def.key);
  }

  for (const permission of permissions) {
    const code = permission.permissionCode;
    const isMenu = permission.module === "page" || code.startsWith("page.");
    let key = explicit.get(code);
    if (!key && isMenu) {
      key = Object.entries(PAGE_PREFIX_GROUP).find(([prefix]) => code.startsWith(prefix))?.[1];
    }
    const group = byKey.get(key ?? OTHER_GROUP.key)!;
    (isMenu ? group.menus : group.actions).push(permission);
  }

  // Thứ tự trong nhóm theo đúng thứ tự khai báo ở trên (cho menu/quyền đã biết), phần còn lại theo tên.
  const order = new Map<string, number>();
  FUNCTIONAL_GROUPS.forEach((def) => [...def.menus, ...def.actions].forEach((code, i) => order.set(code, i)));
  const sorter = (a: PermissionDto, b: PermissionDto) =>
    (order.get(a.permissionCode) ?? 999) - (order.get(b.permissionCode) ?? 999) || a.permissionName.localeCompare(b.permissionName);
  for (const group of groups) {
    group.menus.sort(sorter);
    group.actions.sort(sorter);
  }

  return groups.filter((g) => g.menus.length || g.actions.length);
}

// Nhãn checkbox kèm mã quyền nhỏ bên dưới (giống mobile).
function permissionLabel(name: string, code: string) {
  return (
    <span className="adm-perm-label">
      {name}
      <small className="adm-perm-code">{code}</small>
    </span>
  );
}

type TriState = boolean | "mixed";

function triState(items: PermissionDto[], selected: Set<string>): TriState {
  const count = items.filter((p) => selected.has(p.permissionCode)).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

export function PermissionGroupEditor({
  permissions,
  selected,
  onChange,
}: {
  permissions: PermissionDto[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const groups = useMemo(() => buildPermissionGroups(permissions), [permissions]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  if (!groups.length) {
    return <EmptyState title="Chưa có quyền nào." description="Tạo quyền trước khi gán cho vai trò." />;
  }

  const setMany = (items: PermissionDto[], checked: boolean) => {
    const next = new Set(selectedSet);
    for (const p of items) {
      if (checked) next.add(p.permissionCode);
      else next.delete(p.permissionCode);
    }
    onChange(Array.from(next));
  };

  // Ô tick của cả nhóm/phần: đã chọn hết thì bỏ chọn hết, ngược lại chọn hết.
  const toggleMany = (items: PermissionDto[]) => setMany(items, triState(items, selectedSet) !== true);

  const q = query.trim().toLowerCase();
  const matches = (p: PermissionDto) =>
    !q || p.permissionName.toLowerCase().includes(q) || p.permissionCode.toLowerCase().includes(q);

  const isOpen = (key: string) => openKeys.includes(key) || Boolean(q);
  const toggleOpen = (key: string) =>
    setOpenKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const renderSection = (title: string, items: PermissionDto[]) => {
    const visible = items.filter(matches);
    if (!visible.length) return null;
    return (
      <div className="pg-section">
        <Checkbox
          className="pg-section-title"
          label={`${title} (${items.filter((p) => selectedSet.has(p.permissionCode)).length}/${items.length})`}
          checked={triState(items, selectedSet)}
          onChange={() => toggleMany(items)}
        />
        <div className="pg-items">
          {visible.map((permission) => (
            <Checkbox
              key={permission.permissionCode}
              label={permissionLabel(permission.permissionName, permission.permissionCode)}
              checked={selectedSet.has(permission.permissionCode)}
              onChange={(_, data) => setMany([permission], Boolean(data.checked))}
            />
          ))}
        </div>
      </div>
    );
  };

  const visibleGroups = groups.filter((g) => [...g.menus, ...g.actions].some(matches));

  return (
    <div className="pg-editor">
      <div className="pg-toolbar">
        <Input
          className="pg-search"
          contentBefore={<SearchRegular />}
          placeholder="Tìm menu hoặc quyền..."
          value={query}
          onChange={(_, data) => setQuery(data.value)}
        />
        <Button size="small" onClick={() => setOpenKeys(groups.map((g) => g.key))}>
          Mở rộng tất cả
        </Button>
        <Button size="small" onClick={() => setOpenKeys([])}>
          Thu gọn tất cả
        </Button>
      </div>

      {visibleGroups.length === 0 ? <p className="pg-empty">Không có menu hoặc quyền nào khớp "{query}".</p> : null}

      {visibleGroups.map((group) => {
        const all = [...group.menus, ...group.actions];
        const checkedCount = all.filter((p) => selectedSet.has(p.permissionCode)).length;
        const open = isOpen(group.key);

        return (
          <section className={`pg-group${checkedCount > 0 ? " has-selection" : ""}`} key={group.key}>
            <header className="pg-group-header">
              <Checkbox
                checked={triState(all, selectedSet)}
                onChange={() => toggleMany(all)}
                aria-label={`Chọn tất cả: ${group.label}`}
              />
              <button type="button" className="pg-group-toggle" onClick={() => toggleOpen(group.key)} aria-expanded={open}>
                <span className="pg-group-text">
                  <strong>{group.label}</strong>
                  <small>{group.hint}</small>
                </span>
                <Badge appearance="tint" color={checkedCount > 0 ? "brand" : "informative"} size="small">
                  {checkedCount}/{all.length}
                </Badge>
                {open ? <ChevronDownRegular /> : <ChevronRightRegular />}
              </button>
            </header>
            {open ? (
              <div className="pg-group-body">
                {renderSection("Menu hiển thị (các trang)", group.menus)}
                {renderSection("Chức năng (hành động trong trang)", group.actions)}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

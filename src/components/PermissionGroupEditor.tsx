import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Checkbox,
} from "@fluentui/react-components";
import { useMemo } from "react";
import type { PermissionDto } from "../types/domain";
import { EmptyState } from "./ui";

// Gom permission theo "tính năng" (module) để hiển thị theo đúng luồng thao tác của Admin:
// (1) chọn có được thấy menu tương ứng không (permission "page.*"), (2) mở rộng nhóm để
// chọn tiếp các permission hành động bên trong trang đó (xem/duyệt/từ chối...).
// Permission "page.*" của MenuSeeder dùng tên trang số nhiều/khác dạng số ít so với
// module của ActionPermissionSeeder (vd "customers" vs "customer") nên cần alias để gộp đúng nhóm.
const GROUP_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  attendance: "Chấm công",
  leave: "Nghỉ phép",
  organization: "Phòng ban & chức vụ",
  employee: "Nhân viên",
  users: "Tài khoản đăng nhập",
  audit: "Audit Log",
  system: "System Administration",
};

const PAGE_KEY_ALIASES: Record<string, string> = {
  employees: "employee",
};

function pageGroupKey(permissionCode: string): string {
  const segments = permissionCode.split(".");
  const last = segments[segments.length - 1] ?? permissionCode;
  return PAGE_KEY_ALIASES[last] ?? last;
}

const PAGE_SCOPE_LABELS: Record<string, string> = {
  employee: "Nhân viên",
  manager: "Manager",
  admin: "Admin",
};

// Nhiều permission "page.*" có thể trùng permissionName (vd "Audit Log" của cả
// page.admin.audit lẫn page.manager.audit), nên cần ghi thêm phạm vi (đoạn giữa
// của code, vd "admin"/"manager") để 2 checkbox không nhìn y hệt nhau.
function pagePermissionLabel(permission: PermissionDto): string {
  const segments = permission.permissionCode.split(".");
  const scope = segments.length === 3 ? PAGE_SCOPE_LABELS[segments[1]] : undefined;
  return scope ? `${permission.permissionName} (${scope})` : permission.permissionName;
}

export interface PermissionGroup {
  key: string;
  label: string;
  pagePermissions: PermissionDto[];
  actionPermissions: PermissionDto[];
}

export function buildPermissionGroups(permissions: PermissionDto[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();

  const ensureGroup = (key: string) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, label: GROUP_LABELS[key] ?? key, pagePermissions: [], actionPermissions: [] };
      groups.set(key, group);
    }
    return group;
  };

  for (const permission of permissions) {
    if (permission.module === "page") {
      ensureGroup(pageGroupKey(permission.permissionCode)).pagePermissions.push(permission);
    } else {
      ensureGroup(permission.module).actionPermissions.push(permission);
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
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

  if (!groups.length) {
    return <EmptyState title="Chưa có permission" description="Tạo permission trước khi gán cho role." />;
  }

  const toggle = (code: string, checked: boolean) => {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    onChange(Array.from(next));
  };

  return (
    <Accordion multiple collapsible defaultOpenItems={groups.map((group) => group.key)}>
      {groups.map((group) => {
        const groupPermissions = [...group.pagePermissions, ...group.actionPermissions];
        const checkedCount = groupPermissions.filter((p) => selectedSet.has(p.permissionCode)).length;

        return (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionHeader>
              <span className="permission-group-title">
                {group.label}
                {checkedCount > 0 ? (
                  <Badge appearance="tint" color="brand" size="small">
                    {checkedCount}
                  </Badge>
                ) : null}
              </span>
            </AccordionHeader>
            <AccordionPanel>
              <div className="permission-group-panel">
                {group.pagePermissions.length ? (
                  <div className="permission-group-section">
                    <span className="permission-group-section-title">Xem menu</span>
                    {group.pagePermissions.map((permission) => (
                      <Checkbox
                        key={permission.permissionCode}
                        label={pagePermissionLabel(permission)}
                        checked={selectedSet.has(permission.permissionCode)}
                        onChange={(_, data) => toggle(permission.permissionCode, Boolean(data.checked))}
                      />
                    ))}
                  </div>
                ) : null}
                {group.actionPermissions.length ? (
                  <div className="permission-group-section">
                    <span className="permission-group-section-title">Hành động trong trang</span>
                    {group.actionPermissions.map((permission) => (
                      <Checkbox
                        key={permission.permissionCode}
                        label={permission.permissionName}
                        checked={selectedSet.has(permission.permissionCode)}
                        onChange={(_, data) => toggle(permission.permissionCode, Boolean(data.checked))}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </AccordionPanel>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

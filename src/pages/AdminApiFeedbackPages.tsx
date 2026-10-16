import {
  Badge,
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Spinner,
  Switch,
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import { AddRegular, ArrowClockwiseRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { PermissionGroupEditor } from "../components/PermissionGroupEditor";
import { ConfirmDialog, EmptyState, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { useCan } from "../hooks/useCan";
import { auditApi, menuApi, permissionApi, roleApi } from "../services/api";
import { ApiError, errorMessage } from "../services/http";
import type { AuditLogDto, AuditLogFilterOptionsDto, MenuDto, PermissionDto, RoleDto } from "../types/domain";

import { TIMEZONE } from "../utils/format";

type AdminSystemTab = "roles" | "permissions" | "menus";

// Số dòng nhật ký hiện mỗi lần (giống mobile: tải về hết, hiện dần từng trang).
const AUDIT_PAGE_SIZE = 20;
const HIDDEN_MENU_ROUTE = "/internal/admin-login";

function isBackendUnavailable(error: unknown) {
  return error instanceof ApiError && [404, 501].includes(error.status);
}

function joinCodes(value?: string[]) {
  return value?.join(", ") ?? "";
}

// Thời gian kèm giây, giống mobile (dd/MM/yyyy HH:mm:ss).
function formatDateTimeSeconds(value?: string) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function UnavailableState({ description }: { description: string }) {
  return <EmptyState title="Chưa khả dụng" description={description} />;
}

export function AdminAuditLogApiPage() {
  const notify = useNotify();
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const emptyFilters = { username: "", module: "", action: "", date: "" };
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptionsDto | null>(null);
  const [visible, setVisible] = useState(AUDIT_PAGE_SIZE);
  const [detail, setDetail] = useState<AuditLogDto | null>(null);

  useEffect(() => {
    // Lỗi tải danh sách lọc thì chuyển ô chọn thành ô nhập tay, không ảnh hưởng phần còn lại của trang.
    auditApi.getFilterOptions().then(setFilterOptions).catch(() => setFilterOptions(null));
  }, []);

  const load = (current = filters) => {
    setLoading(true);
    setUnavailable(false);
    auditApi
      .getAll({
        username: current.username.trim() || undefined,
        module: current.module.trim() || undefined,
        action: current.action.trim() || undefined,
        date: current.date || undefined,
      })
      .then((items) => {
        setLogs(items);
        setVisible(AUDIT_PAGE_SIZE);
      })
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setLogs([]);
          setUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setFilters(emptyFilters);
    load(emptyFilters);
  };

  const filterField = (key: "module" | "action", items?: string[]) =>
    items?.length ? (
      <Dropdown
        value={filters[key] || "Tất cả"}
        selectedOptions={[filters[key]]}
        onOptionSelect={(_, data) => setFilters((value) => ({ ...value, [key]: data.optionValue ?? "" }))}
      >
        <Option value="" text="Tất cả">
          Tất cả
        </Option>
        {items.map((item) => (
          <Option key={item} value={item} text={item}>
            {item}
          </Option>
        ))}
      </Dropdown>
    ) : (
      <Input
        value={filters[key]}
        onChange={(_, data) => setFilters((value) => ({ ...value, [key]: data.value }))}
        onKeyDown={(e) => {
          if (e.key === "Enter") load();
        }}
      />
    );

  const shown = logs.slice(0, visible);
  const hasMore = visible < logs.length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Xem lịch sử thao tác toàn hệ thống, chỉ đọc."
        action={
          <Button icon={<ArrowClockwiseRegular />} onClick={() => load()}>
            Tải lại
          </Button>
        }
      />
      <SectionPanel>
        <div className="filter-grid">
          <Field label="Người dùng">
            <Input
              value={filters.username}
              onChange={(_, data) => setFilters((value) => ({ ...value, username: data.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") load();
              }}
            />
          </Field>
          <Field label="Phân hệ">{filterField("module", filterOptions?.modules)}</Field>
          <Field label="Hành động">{filterField("action", filterOptions?.actions)}</Field>
          <Field label="Ngày">
            <Input type="date" value={filters.date} onChange={(_, data) => setFilters((value) => ({ ...value, date: data.value }))} />
          </Field>
          <Button appearance="primary" onClick={() => load()}>
            Lọc
          </Button>
          <Button onClick={clearFilters}>Xoá lọc</Button>
        </div>
      </SectionPanel>
      <SectionPanel>
        {loading ? (
          <Spinner label="Đang tải nhật ký..." />
        ) : unavailable ? (
          <UnavailableState description="Backend chưa cung cấp API nhật ký hệ thống. Trang sẽ hiển thị dữ liệu khi endpoint sẵn sàng." />
        ) : logs.length ? (
          <>
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người dùng</th>
                    <th>Phân hệ</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>IP</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTimeSeconds(log.createdAt)}</td>
                      <td>{log.username ?? "--"}</td>
                      <td>{log.module}</td>
                      <td>{log.action}</td>
                      <td>{log.target ?? "--"}</td>
                      <td>{log.ipAddress ?? "--"}</td>
                      <td>
                        <Button size="small" onClick={() => setDetail(log)}>
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-actions">
              <span>{hasMore ? `Đang hiển thị ${shown.length}/${logs.length} dòng` : `Đã hiển thị ${logs.length} dòng`}</span>
              {hasMore ? (
                <Button onClick={() => setVisible((v) => v + AUDIT_PAGE_SIZE)}>Tải thêm</Button>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState title="Không có thao tác" description="Không có thao tác nào khớp với bộ lọc hiện tại." />
        )}
      </SectionPanel>

      <Dialog open={detail !== null} onOpenChange={(_, data) => !data.open && setDetail(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Chi tiết thao tác #{detail?.id}</DialogTitle>
            <DialogContent>
              {detail ? (
                <dl className="detail-list">
                  {(
                    [
                      ["Thời gian", formatDateTimeSeconds(detail.createdAt)],
                      ["Người dùng", detail.username ?? "--"],
                      ["Phân hệ", detail.module],
                      ["Hành động", detail.action],
                      ["Đối tượng", detail.target ?? "--"],
                      ["Địa chỉ IP", detail.ipAddress ?? "--"],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setDetail(null)}>
                Đóng
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Hộp xác nhận dùng chung cho các thao tác khoá/tắt trong trang quản trị hệ thống.
type PendingConfirm = { title: string; description: string; label: string; run: () => Promise<void> };

export function AdminSystemApiPage() {
  const notify = useNotify();
  const can = useCan();
  const canRole = can("role.manage");
  const canPermission = can("permission.manage");
  const canMenu = can("menu.manage");

  // Mỗi phần chỉ hiện khi có quyền tương ứng (giống mobile).
  const tabs: { value: AdminSystemTab; label: string }[] = [
    ...(canRole ? [{ value: "roles" as const, label: "Vai trò" }] : []),
    ...(canPermission ? [{ value: "permissions" as const, label: "Quyền" }] : []),
    ...(canMenu ? [{ value: "menus" as const, label: "Menu" }] : []),
  ];
  const [selectedTab, setSelectedTab] = useState<AdminSystemTab | null>(null);
  const tab = tabs.find((t) => t.value === selectedTab)?.value ?? tabs[0]?.value;

  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(canMenu);
  const [menusUnavailable, setMenusUnavailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuDto | null>(null);
  const [menuForm, setMenuForm] = useState({
    menuCode: "",
    menuName: "",
    icon: "",
    route: "",
    displayOrder: "1",
    permissions: [] as string[],
  });

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(canRole);
  const [rolesUnavailable, setRolesUnavailable] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);
  const [roleForm, setRoleForm] = useState({
    roleCode: "",
    roleName: "",
    description: "",
    permissions: [] as string[],
  });

  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(canPermission);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");
  const [permissionsUnavailable, setPermissionsUnavailable] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<PermissionDto | null>(null);
  const [permissionForm, setPermissionForm] = useState({
    permissionCode: "",
    permissionName: "",
    module: "",
    description: "",
  });

  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Danh sách phân hệ duy nhất từ các quyền hiện có, kèm giá trị đang sửa để không mất dữ liệu.
  const moduleOptions = Array.from(
    new Set([...permissions.map((p) => p.module), permissionForm.module].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const loadMenus = () => {
    setLoadingMenus(true);
    setMenusUnavailable(false);
    menuApi
      .getAll()
      .then((items) => setMenus(items.filter((item) => item.route !== HIDDEN_MENU_ROUTE)))
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setMenus([]);
          setMenusUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingMenus(false));
  };

  const loadRoles = () => {
    setLoadingRoles(true);
    setRolesUnavailable(false);
    roleApi
      .getAll()
      .then(setRoles)
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setRoles([]);
          setRolesUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingRoles(false));
  };

  const loadPermissions = () => {
    setLoadingPermissions(true);
    setPermissionsUnavailable(false);
    setPermissionsError("");
    permissionApi
      .getAll()
      .then((items) => {
        setPermissions(items);
        setPermissionsLoaded(true);
      })
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setPermissions([]);
          setPermissionsUnavailable(true);
          return;
        }
        setPermissionsError(errorMessage(err));
        if (canPermission) notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingPermissions(false));
  };

  // Form vai trò / menu cần danh sách quyền để gán, dù tài khoản không có phần "Quyền".
  const ensurePermissions = () => {
    if (!permissionsLoaded && !loadingPermissions) loadPermissions();
  };

  useEffect(() => {
    if (canMenu) loadMenus();
    if (canRole) loadRoles();
    if (canPermission) loadPermissions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateMenu = () => {
    setEditingMenu(null);
    setMenuForm({ menuCode: "", menuName: "", icon: "", route: "", displayOrder: "1", permissions: [] });
    ensurePermissions();
    setMenuOpen(true);
  };

  const openEditMenu = (menu: MenuDto) => {
    setEditingMenu(menu);
    setMenuForm({
      menuCode: menu.menuCode,
      menuName: menu.menuName,
      icon: menu.icon ?? "",
      route: menu.route,
      displayOrder: String(menu.displayOrder),
      permissions: menu.permissions ?? [],
    });
    ensurePermissions();
    setMenuOpen(true);
  };

  const submitMenu = async () => {
    if (!menuForm.menuCode.trim() || !menuForm.menuName.trim() || !menuForm.route.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã menu, tên menu và đường dẫn." });
      return;
    }
    if (menuForm.route.trim() === HIDDEN_MENU_ROUTE) {
      notify({ ok: false, message: "Không cấu hình URL đăng nhập quản trị ẩn trong menu." });
      return;
    }
    const order = Number(menuForm.displayOrder.trim());
    if (!menuForm.displayOrder.trim() || !Number.isInteger(order)) {
      notify({ ok: false, message: "Thứ tự phải là số nguyên." });
      return;
    }
    setSending(true);
    try {
      const body = {
        menuName: menuForm.menuName.trim(),
        icon: menuForm.icon.trim() || undefined,
        route: menuForm.route.trim(),
        displayOrder: order,
        permissions: menuForm.permissions,
      };
      if (editingMenu) {
        await menuApi.update(editingMenu.menuCode, body);
        notify({ ok: true, message: "Đã cập nhật menu." });
      } else {
        await menuApi.create({ ...body, menuCode: menuForm.menuCode.trim() });
        notify({ ok: true, message: "Đã tạo menu." });
      }
      setMenuOpen(false);
      loadMenus();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ cấu hình menu." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const toggleMenuVisible = async (menu: MenuDto) => {
    try {
      await menuApi.setVisible(menu.menuCode, !menu.isVisible);
      notify({ ok: true, message: menu.isVisible ? "Đã ẩn menu." : "Đã hiện menu." });
      loadMenus();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const setMenuActive = async (menu: MenuDto) => {
    try {
      await menuApi.setActive(menu.menuCode, !menu.isActive);
      notify({ ok: true, message: menu.isActive ? "Đã tắt menu." : "Đã bật menu." });
      loadMenus();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  // Chỉ hỏi xác nhận khi tắt menu.
  const toggleMenuActive = (menu: MenuDto) => {
    if (!menu.isActive) {
      void setMenuActive(menu);
      return;
    }
    setConfirm({
      title: "Tắt menu?",
      description: `Tắt menu "${menu.menuName}"?`,
      label: "Tắt",
      run: () => setMenuActive(menu),
    });
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ roleCode: "", roleName: "", description: "", permissions: [] });
    ensurePermissions();
    setRoleOpen(true);
  };

  const openEditRole = (role: RoleDto) => {
    setEditingRole(role);
    setRoleForm({
      roleCode: role.roleCode,
      roleName: role.roleName,
      description: role.description ?? "",
      permissions: role.permissions,
    });
    ensurePermissions();
    setRoleOpen(true);
  };

  const submitRole = async () => {
    if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã vai trò và tên vai trò." });
      return;
    }
    setSending(true);
    try {
      if (editingRole) {
        await roleApi.update(editingRole.roleCode, {
          roleName: roleForm.roleName.trim(),
          description: roleForm.description.trim() || undefined,
          permissions: roleForm.permissions,
        });
        notify({ ok: true, message: "Đã cập nhật vai trò." });
      } else {
        await roleApi.create({
          roleCode: roleForm.roleCode.trim(),
          roleName: roleForm.roleName.trim(),
          description: roleForm.description.trim() || undefined,
          permissions: roleForm.permissions,
        });
        notify({ ok: true, message: "Đã tạo vai trò." });
      }
      setRoleOpen(false);
      loadRoles();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ quản trị vai trò." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const toggleRoleActive = (role: RoleDto) => {
    const lock = role.isActive;
    setConfirm({
      title: lock ? "Khoá vai trò?" : "Mở vai trò?",
      description: `${lock ? "Khoá" : "Mở"} vai trò "${role.roleName}" (${role.roleCode})?`,
      label: lock ? "Khoá" : "Mở",
      run: async () => {
        await roleApi.setActive(role.roleCode, !role.isActive);
        notify({ ok: true, message: lock ? "Đã khoá vai trò." : "Đã mở vai trò." });
        loadRoles();
      },
    });
  };

  const openCreatePermission = () => {
    setEditingPermission(null);
    setPermissionForm({ permissionCode: "", permissionName: "", module: "", description: "" });
    setPermissionOpen(true);
  };

  const openEditPermission = (permission: PermissionDto) => {
    setEditingPermission(permission);
    setPermissionForm({
      permissionCode: permission.permissionCode,
      permissionName: permission.permissionName,
      module: permission.module,
      description: permission.description ?? "",
    });
    setPermissionOpen(true);
  };

  const submitPermission = async () => {
    // Mã quyền phải có dạng phân_hệ.hành_động (chỉ chữ cái, ngăn cách bằng dấu chấm).
    if (!editingPermission && !/^[a-z]+(\.[a-z]+)+$/i.test(permissionForm.permissionCode.trim())) {
      notify({ ok: false, message: "Mã quyền cần có dạng phân_hệ.hành_động (vd: report.view)." });
      return;
    }
    if (!permissionForm.permissionName.trim() || !permissionForm.module.trim()) {
      notify({ ok: false, message: "Vui lòng nhập tên quyền và phân hệ." });
      return;
    }
    setSending(true);
    try {
      if (editingPermission) {
        await permissionApi.update(editingPermission.permissionCode, {
          permissionName: permissionForm.permissionName.trim(),
          module: permissionForm.module.trim(),
          description: permissionForm.description.trim() || undefined,
        });
        notify({ ok: true, message: "Đã cập nhật quyền." });
      } else {
        await permissionApi.create({
          permissionCode: permissionForm.permissionCode.trim(),
          permissionName: permissionForm.permissionName.trim(),
          module: permissionForm.module.trim(),
          description: permissionForm.description.trim() || undefined,
        });
        notify({ ok: true, message: "Đã tạo quyền." });
      }
      setPermissionOpen(false);
      loadPermissions();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ quản trị quyền." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const togglePermissionActive = (permission: PermissionDto) => {
    const lock = permission.isActive;
    setConfirm({
      title: lock ? "Khoá quyền?" : "Mở quyền?",
      description: `${lock ? "Khoá" : "Mở"} quyền "${permission.permissionCode}"?`,
      label: lock ? "Khoá" : "Mở",
      run: async () => {
        await permissionApi.setActive(permission.permissionCode, !permission.isActive);
        notify({ ok: true, message: lock ? "Đã khoá quyền." : "Đã mở quyền." });
        loadPermissions();
      },
    });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.run();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  // Danh sách quyền để gán trong form vai trò / menu: có thể đang tải hoặc lỗi.
  const permissionPicker = (selected: string[], onChange: (codes: string[]) => void) => {
    if (loadingPermissions && !permissionsLoaded) return <Spinner label="Đang tải quyền..." />;
    if (permissionsError && !permissionsLoaded) {
      return <p className="field-error">Không tải được danh sách quyền: {permissionsError}</p>;
    }
    return <PermissionGroupEditor permissions={permissions} selected={selected} onChange={onChange} />;
  };

  const reloadCurrent = () => {
    if (tab === "roles") loadRoles();
    else if (tab === "permissions") loadPermissions();
    else if (tab === "menus") loadMenus();
  };

  if (!tabs.length) {
    return (
      <div className="page-stack">
        <PageHeader title="Quản trị hệ thống" description="Quản lý vai trò, quyền và menu tập trung tại một nơi." />
        <EmptyState title="Không có quyền" description="Bạn không có quyền quản trị hệ thống." />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản trị hệ thống"
        description="Quản lý vai trò, quyền và menu tập trung tại một nơi."
        action={
          <div className="row-actions">
            <Button icon={<ArrowClockwiseRegular />} onClick={reloadCurrent}>
              Tải lại
            </Button>
            {tab === "menus" && !menusUnavailable ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={openCreateMenu}>
                Tạo menu
              </Button>
            ) : tab === "roles" && !rolesUnavailable ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={openCreateRole}>
                Tạo vai trò
              </Button>
            ) : tab === "permissions" && !permissionsUnavailable ? (
              <Button appearance="primary" icon={<AddRegular />} onClick={openCreatePermission}>
                Tạo quyền
              </Button>
            ) : null}
          </div>
        }
      />

      <TabList selectedValue={tab} onTabSelect={(_, data) => setSelectedTab(data.value as AdminSystemTab)}>
        {tabs.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>

      {tab === "menus" ? (
        <SectionPanel title="Cấu hình menu">
          {loadingMenus ? (
            <Spinner label="Đang tải menu..." />
          ) : menusUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API menu. Trang này chỉ dành cho cấu hình menu và phân quyền." />
          ) : menus.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã menu</th>
                    <th>Tên menu</th>
                    <th>Đường dẫn</th>
                    <th>Quyền</th>
                    <th>Thứ tự</th>
                    <th>Hiện menu</th>
                    <th>Hoạt động</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {menus.map((menu) => (
                    <tr key={menu.menuCode}>
                      <td>{menu.menuCode}</td>
                      <td>{menu.menuName}</td>
                      <td>{menu.route}</td>
                      <td>{joinCodes(menu.permissions) || "--"}</td>
                      <td>{menu.displayOrder}</td>
                      <td>
                        <Switch
                          checked={menu.isVisible}
                          aria-label={`Hiện menu ${menu.menuName}`}
                          label={menu.isVisible ? "Hiện" : "Ẩn"}
                          onChange={() => toggleMenuVisible(menu)}
                        />
                      </td>
                      <td>
                        <Switch
                          checked={menu.isActive}
                          aria-label={`Hoạt động ${menu.menuName}`}
                          label={menu.isActive ? "Đang hoạt động" : "Đã tắt"}
                          onChange={() => toggleMenuActive(menu)}
                        />
                      </td>
                      <td>
                        <Button size="small" onClick={() => openEditMenu(menu)}>
                          Sửa / gán quyền
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có menu" description="Tạo menu để backend điều khiển điều hướng theo quyền." />
          )}
        </SectionPanel>
      ) : null}

      {tab === "roles" ? (
        <SectionPanel title="Cấu hình vai trò">
          {loadingRoles ? (
            <Spinner label="Đang tải vai trò..." />
          ) : rolesUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API vai trò. UI đã sẵn sàng và sẽ bật thao tác khi endpoint khả dụng." />
          ) : roles.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã vai trò</th>
                    <th>Tên vai trò</th>
                    <th>Mô tả</th>
                    <th>Quyền</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.roleCode}>
                      <td>{role.roleCode}</td>
                      <td>{role.roleName}</td>
                      <td>{role.description || "--"}</td>
                      <td>{role.permissions.length} quyền</td>
                      <td>
                        <Badge appearance="tint" color={role.isActive ? "success" : "danger"}>
                          {role.isActive ? "Đang hoạt động" : "Đã khoá"}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button size="small" onClick={() => openEditRole(role)}>
                            Sửa / gán quyền
                          </Button>
                          <Button size="small" onClick={() => toggleRoleActive(role)}>
                            {role.isActive ? "Khoá" : "Mở"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có vai trò" description="Chưa có vai trò. Tạo vai trò để gán quyền cho tài khoản." />
          )}
        </SectionPanel>
      ) : null}

      {tab === "permissions" ? (
        <SectionPanel title="Danh mục quyền">
          {loadingPermissions ? (
            <Spinner label="Đang tải quyền..." />
          ) : permissionsUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API quyền. UI đã sẵn sàng và sẽ bật thao tác khi endpoint khả dụng." />
          ) : permissions.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã quyền</th>
                    <th>Tên</th>
                    <th>Phân hệ</th>
                    <th>Mô tả</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((permission) => (
                    <tr key={permission.permissionCode}>
                      <td>{permission.permissionCode}</td>
                      <td>{permission.permissionName}</td>
                      <td>{permission.module}</td>
                      <td>{permission.description || "--"}</td>
                      <td>
                        <Badge appearance="tint" color={permission.isActive ? "success" : "danger"}>
                          {permission.isActive ? "Đang hoạt động" : "Đã khoá"}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button size="small" onClick={() => openEditPermission(permission)}>
                            Sửa
                          </Button>
                          <Button size="small" onClick={() => togglePermissionActive(permission)}>
                            {permission.isActive ? "Khoá" : "Mở"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có quyền" description="Chưa có quyền. Tạo quyền theo dạng module.action." />
          )}
        </SectionPanel>
      ) : null}

      <Dialog open={menuOpen} onOpenChange={(_, data) => setMenuOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingMenu ? "Sửa menu" : "Tạo menu"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã menu" required>
                  <Input
                    value={menuForm.menuCode}
                    disabled={Boolean(editingMenu)}
                    onChange={(_, data) => setMenuForm((value) => ({ ...value, menuCode: data.value }))}
                  />
                </Field>
                <Field label="Tên menu" required>
                  <Input value={menuForm.menuName} onChange={(_, data) => setMenuForm((value) => ({ ...value, menuName: data.value }))} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Đường dẫn" required>
                  <Input
                    placeholder="vd: /admin/employees"
                    value={menuForm.route}
                    onChange={(_, data) => setMenuForm((value) => ({ ...value, route: data.value }))}
                  />
                </Field>
                <Field label="Biểu tượng">
                  <Input value={menuForm.icon} onChange={(_, data) => setMenuForm((value) => ({ ...value, icon: data.value }))} />
                </Field>
              </div>
              <Field label="Thứ tự">
                <Input
                  type="number"
                  value={menuForm.displayOrder}
                  onChange={(_, data) => setMenuForm((value) => ({ ...value, displayOrder: data.value }))}
                />
              </Field>
              <Field label="Quyền được thấy menu này">
                {permissionPicker(menuForm.permissions, (codes) => setMenuForm((value) => ({ ...value, permissions: codes })))}
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setMenuOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitMenu} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={(_, data) => setRoleOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingRole ? "Sửa vai trò" : "Tạo vai trò"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã vai trò" required>
                  <Input
                    value={roleForm.roleCode}
                    disabled={Boolean(editingRole)}
                    onChange={(_, data) => setRoleForm((value) => ({ ...value, roleCode: data.value }))}
                  />
                </Field>
                <Field label="Tên vai trò" required>
                  <Input value={roleForm.roleName} onChange={(_, data) => setRoleForm((value) => ({ ...value, roleName: data.value }))} />
                </Field>
              </div>
              <Field label="Mô tả">
                <Textarea value={roleForm.description} onChange={(_, data) => setRoleForm((value) => ({ ...value, description: data.value }))} />
              </Field>
              <Field label="Menu & Quyền">
                {permissionPicker(roleForm.permissions, (codes) => setRoleForm((value) => ({ ...value, permissions: codes })))}
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRoleOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitRole} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={permissionOpen} onOpenChange={(_, data) => setPermissionOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingPermission ? "Sửa quyền" : "Tạo quyền"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã quyền" required hint={editingPermission ? undefined : "vd: report.view"}>
                  <Input
                    value={permissionForm.permissionCode}
                    disabled={Boolean(editingPermission)}
                    onChange={(_, data) => setPermissionForm((value) => ({ ...value, permissionCode: data.value }))}
                  />
                </Field>
                <Field label="Tên quyền" required>
                  <Input
                    value={permissionForm.permissionName}
                    onChange={(_, data) => setPermissionForm((value) => ({ ...value, permissionName: data.value }))}
                  />
                </Field>
              </div>
              <Field label="Phân hệ" required>
                <Combobox
                  freeform
                  value={permissionForm.module}
                  selectedOptions={[permissionForm.module]}
                  onChange={(event) => setPermissionForm((value) => ({ ...value, module: event.target.value }))}
                  onOptionSelect={(_, data) => setPermissionForm((value) => ({ ...value, module: data.optionValue ?? "" }))}
                >
                  {moduleOptions.map((item) => (
                    <Option key={item} value={item} text={item}>
                      {item}
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <Field label="Mô tả">
                <Textarea value={permissionForm.description} onChange={(_, data) => setPermissionForm((value) => ({ ...value, description: data.value }))} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPermissionOpen(false)}>Huỷ</Button>
              <Button appearance="primary" onClick={submitPermission} disabled={sending}>
                {sending ? <Spinner size="tiny" /> : "Lưu"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.label}
        confirming={confirming}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

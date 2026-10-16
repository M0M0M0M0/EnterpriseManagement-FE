import {
  Badge,
  Button,
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
import {
  AddRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { PermissionGroupEditor } from "../components/PermissionGroupEditor";
import { EmptyState, PageHeader, SectionPanel } from "../components/ui";
import { useNotify } from "../components/useNotify";
import { auditApi, menuApi, permissionApi, roleApi } from "../services/api";
import { ApiError, errorMessage } from "../services/http";
import type { AuditLogDto, AuditLogFilterOptionsDto, MenuDto, PermissionDto, RoleDto } from "../types/domain";

import { formatDateTime } from "../utils/format";

type AdminSystemTab = "menus" | "roles" | "permissions";

function isBackendUnavailable(error: unknown) {
  return error instanceof ApiError && [404, 501].includes(error.status);
}

function splitCodes(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCodes(value?: string[]) {
  return value?.join(", ") ?? "";
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

  useEffect(() => {
    // Lỗi tải danh sách lọc thì ẩn ô chọn tương ứng, không ảnh hưởng phần còn lại của trang.
    auditApi.getFilterOptions().then(setFilterOptions).catch(() => setFilterOptions(null));
  }, []);

  const load = (current = filters) => {
    setLoading(true);
    setUnavailable(false);
    auditApi
      .getAll({
        username: current.username || undefined,
        module: current.module || undefined,
        action: current.action || undefined,
        date: current.date || undefined,
      })
      .then(setLogs)
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

  const hasFilters = Object.values(filters).some(Boolean);
  const clearFilters = () => {
    setFilters(emptyFilters);
    load(emptyFilters);
  };

  const filterSelect = (key: "module" | "action", items: string[]) => (
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
  );

  return (
    <div className="page-stack">
      <PageHeader title="Nhật ký hệ thống" description="Xem lịch sử thao tác toàn hệ thống, chỉ đọc." />
      <SectionPanel>
        <div className="filter-grid">
          <Field label="Người dùng">
            <Input value={filters.username} onChange={(_, data) => setFilters((value) => ({ ...value, username: data.value }))} />
          </Field>
          {filterOptions?.modules.length ? <Field label="Phân hệ">{filterSelect("module", filterOptions.modules)}</Field> : null}
          {filterOptions?.actions.length ? <Field label="Hành động">{filterSelect("action", filterOptions.actions)}</Field> : null}
          <Field label="Ngày">
            <Input type="date" value={filters.date} onChange={(_, data) => setFilters((value) => ({ ...value, date: data.value }))} />
          </Field>
          <Button appearance="primary" onClick={() => load()}>
            Lọc
          </Button>
          {hasFilters ? <Button onClick={clearFilters}>Xoá lọc</Button> : null}
        </div>
      </SectionPanel>
      <SectionPanel>
        {loading ? (
          <Spinner label="Đang tải audit log..." />
        ) : unavailable ? (
          <UnavailableState description="Backend chưa cung cấp API audit log. Trang sẽ hiển thị dữ liệu khi endpoint sẵn sàng." />
        ) : logs.length ? (
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
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.username ?? "--"}</td>
                    <td>{log.module}</td>
                    <td>{log.action}</td>
                    <td>{log.target ?? "--"}</td>
                    <td>{log.ipAddress ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Chưa có audit log" description="Không có thao tác nào khớp với bộ lọc hiện tại." />
        )}
      </SectionPanel>
    </div>
  );
}

export function AdminSystemApiPage() {
  const notify = useNotify();
  const [tab, setTab] = useState<AdminSystemTab>("menus");

  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [menusUnavailable, setMenusUnavailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuDto | null>(null);
  const [menuForm, setMenuForm] = useState({
    menuCode: "",
    menuName: "",
    icon: "",
    route: "",
    displayOrder: 1,
    permissions: "",
  });

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
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
  const [loadingPermissions, setLoadingPermissions] = useState(true);
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

  // Danh sách phân hệ duy nhất từ các quyền hiện có, kèm giá trị đang sửa để không mất dữ liệu.
  const moduleOptions = Array.from(
    new Set([...permissions.map((p) => p.module), permissionForm.module].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const loadMenus = () => {
    setLoadingMenus(true);
    setMenusUnavailable(false);
    menuApi
      .getAll()
      .then((items) => setMenus(items.filter((item) => item.route !== "/internal/admin-login")))
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
    permissionApi
      .getAll()
      .then(setPermissions)
      .catch((err) => {
        if (isBackendUnavailable(err)) {
          setPermissions([]);
          setPermissionsUnavailable(true);
          return;
        }
        notify({ ok: false, message: errorMessage(err) });
      })
      .finally(() => setLoadingPermissions(false));
  };

  useEffect(() => {
    loadMenus();
    loadRoles();
    loadPermissions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateMenu = () => {
    setEditingMenu(null);
    setMenuForm({ menuCode: "", menuName: "", icon: "", route: "", displayOrder: 1, permissions: "" });
    setMenuOpen(true);
  };

  const openEditMenu = (menu: MenuDto) => {
    setEditingMenu(menu);
    setMenuForm({
      menuCode: menu.menuCode,
      menuName: menu.menuName,
      icon: menu.icon ?? "",
      route: menu.route,
      displayOrder: menu.displayOrder,
      permissions: joinCodes(menu.permissions),
    });
    setMenuOpen(true);
  };

  const submitMenu = async () => {
    if (!menuForm.menuCode.trim() || !menuForm.menuName.trim() || !menuForm.route.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã menu, tên menu và route." });
      return;
    }
    if (menuForm.route === "/internal/admin-login") {
      notify({ ok: false, message: "Không cấu hình URL đăng nhập admin ẩn trong menu." });
      return;
    }
    setSending(true);
    try {
      if (editingMenu) {
        await menuApi.update(editingMenu.menuCode, {
          menuName: menuForm.menuName,
          icon: menuForm.icon || undefined,
          route: menuForm.route,
          displayOrder: menuForm.displayOrder,
          permissions: splitCodes(menuForm.permissions),
        });
        notify({ ok: true, message: "Đã cập nhật menu." });
      } else {
        await menuApi.create({
          menuCode: menuForm.menuCode,
          menuName: menuForm.menuName,
          icon: menuForm.icon || undefined,
          route: menuForm.route,
          displayOrder: menuForm.displayOrder,
          permissions: splitCodes(menuForm.permissions),
        });
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
      loadMenus();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const toggleMenuActive = async (menu: MenuDto) => {
    try {
      await menuApi.setActive(menu.menuCode, !menu.isActive);
      loadMenus();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ roleCode: "", roleName: "", description: "", permissions: [] });
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
    setRoleOpen(true);
  };

  const submitRole = async () => {
    if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
      notify({ ok: false, message: "Vui lòng nhập mã role và tên role." });
      return;
    }
    setSending(true);
    try {
      if (editingRole) {
        await roleApi.update(editingRole.roleCode, {
          roleName: roleForm.roleName,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        });
        notify({ ok: true, message: "Đã cập nhật role." });
      } else {
        await roleApi.create({
          roleCode: roleForm.roleCode,
          roleName: roleForm.roleName,
          description: roleForm.description || undefined,
          permissions: roleForm.permissions,
        });
        notify({ ok: true, message: "Đã tạo role." });
      }
      setRoleOpen(false);
      loadRoles();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ quản trị role." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const toggleRoleActive = async (role: RoleDto) => {
    try {
      await roleApi.setActive(role.roleCode, !role.isActive);
      notify({ ok: true, message: role.isActive ? "Đã khóa role." : "Đã mở role." });
      loadRoles();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
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
    if (!permissionForm.permissionCode.match(/^[a-z]+(\.[a-z]+)+$/i)) {
      notify({ ok: false, message: "Mã quyền cần có dạng module.action." });
      return;
    }
    setSending(true);
    try {
      if (editingPermission) {
        await permissionApi.update(editingPermission.permissionCode, {
          permissionName: permissionForm.permissionName,
          module: permissionForm.module,
          description: permissionForm.description || undefined,
        });
        notify({ ok: true, message: "Đã cập nhật permission." });
      } else {
        await permissionApi.create({
          permissionCode: permissionForm.permissionCode,
          permissionName: permissionForm.permissionName,
          module: permissionForm.module,
          description: permissionForm.description || undefined,
        });
        notify({ ok: true, message: "Đã tạo permission." });
      }
      setPermissionOpen(false);
      loadPermissions();
    } catch (err) {
      notify({
        ok: false,
        message: isBackendUnavailable(err) ? "Backend chưa hỗ trợ quản trị permission." : errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  };

  const togglePermissionActive = async (permission: PermissionDto) => {
    try {
      await permissionApi.setActive(permission.permissionCode, !permission.isActive);
      notify({ ok: true, message: permission.isActive ? "Đã khóa permission." : "Đã mở permission." });
      loadPermissions();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Quản trị hệ thống"
        description="Quản lý menu, vai trò và quyền tập trung tại một nơi."
        action={
          tab === "menus" && !menusUnavailable ? (
            <Button appearance="primary" icon={<AddRegular />} onClick={openCreateMenu}>
              Tạo menu
            </Button>
          ) : tab === "roles" && !rolesUnavailable ? (
            <Button appearance="primary" icon={<AddRegular />} onClick={openCreateRole}>
              Tạo role
            </Button>
          ) : tab === "permissions" && !permissionsUnavailable ? (
            <Button appearance="primary" icon={<AddRegular />} onClick={openCreatePermission}>
              Tạo permission
            </Button>
          ) : null
        }
      />

      <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as AdminSystemTab)}>
        <Tab value="menus">Menu</Tab>
        <Tab value="roles">Vai trò</Tab>
        <Tab value="permissions">Quyền</Tab>
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
                    <th>Hiển thị</th>
                    <th>Kích hoạt</th>
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
                        <Switch checked={menu.isVisible} aria-label={`Hiển thị ${menu.menuName}`} onChange={() => toggleMenuVisible(menu)} />
                      </td>
                      <td>
                        <Switch checked={menu.isActive} aria-label={`Kích hoạt ${menu.menuName}`} onChange={() => toggleMenuActive(menu)} />
                      </td>
                      <td>
                        <Button size="small" onClick={() => openEditMenu(menu)}>
                          Sửa
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có menu" description="Tạo menu để backend điều khiển navigation theo quyền." />
          )}
        </SectionPanel>
      ) : null}

      {tab === "roles" ? (
        <SectionPanel title="Cấu hình vai trò">
          {loadingRoles ? (
            <Spinner label="Đang tải roles..." />
          ) : rolesUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API role. UI đã sẵn sàng và sẽ bật thao tác khi endpoint khả dụng." />
          ) : roles.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã role</th>
                    <th>Tên role</th>
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
                      <td>{role.permissions.length} quyền</td>
                      <td>
                        <Badge appearance="tint" color={role.isActive ? "success" : "danger"}>
                          {role.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button size="small" onClick={() => openEditRole(role)}>
                            Sửa
                          </Button>
                          <Button size="small" onClick={() => toggleRoleActive(role)}>
                            {role.isActive ? "Khóa" : "Mở"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có role" description="Tạo role để gán permission cho tài khoản." />
          )}
        </SectionPanel>
      ) : null}

      {tab === "permissions" ? (
        <SectionPanel title="Danh mục quyền">
          {loadingPermissions ? (
            <Spinner label="Đang tải permissions..." />
          ) : permissionsUnavailable ? (
            <UnavailableState description="Backend chưa cung cấp API permission. UI đã sẵn sàng và sẽ bật thao tác khi endpoint khả dụng." />
          ) : permissions.length ? (
            <div className="enterprise-table-wrap">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Mã permission</th>
                    <th>Tên</th>
                    <th>Phân hệ</th>
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
                      <td>
                        <Badge appearance="tint" color={permission.isActive ? "success" : "danger"}>
                          {permission.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button size="small" onClick={() => openEditPermission(permission)}>
                            Sửa
                          </Button>
                          <Button size="small" onClick={() => togglePermissionActive(permission)}>
                            {permission.isActive ? "Khóa" : "Mở"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có permission" description="Tạo permission theo dạng module.action." />
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
                <Field label="Biểu tượng">
                  <Input value={menuForm.icon} onChange={(_, data) => setMenuForm((value) => ({ ...value, icon: data.value }))} />
                </Field>
                <Field label="Đường dẫn" required>
                  <Input value={menuForm.route} onChange={(_, data) => setMenuForm((value) => ({ ...value, route: data.value }))} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Thứ tự">
                  <Input
                    type="number"
                    value={String(menuForm.displayOrder)}
                    onChange={(_, data) => setMenuForm((value) => ({ ...value, displayOrder: Number(data.value) }))}
                  />
                </Field>
                <Field label="Mã quyền" hint="Quyền quyết định ai thấy menu này, phân tách bằng dấu phẩy.">
                  <Input value={menuForm.permissions} onChange={(_, data) => setMenuForm((value) => ({ ...value, permissions: data.value }))} />
                </Field>
              </div>
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
            <DialogTitle>{editingRole ? "Sửa role" : "Tạo role"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã role" required>
                  <Input
                    value={roleForm.roleCode}
                    disabled={Boolean(editingRole)}
                    onChange={(_, data) => setRoleForm((value) => ({ ...value, roleCode: data.value }))}
                  />
                </Field>
                <Field label="Tên role" required>
                  <Input value={roleForm.roleName} onChange={(_, data) => setRoleForm((value) => ({ ...value, roleName: data.value }))} />
                </Field>
              </div>
              <Field label="Mô tả">
                <Textarea value={roleForm.description} onChange={(_, data) => setRoleForm((value) => ({ ...value, description: data.value }))} />
              </Field>
              <Field label="Menu và quyền">
                <PermissionGroupEditor
                  permissions={permissions}
                  selected={roleForm.permissions}
                  onChange={(codes) => setRoleForm((value) => ({ ...value, permissions: codes }))}
                />
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
            <DialogTitle>{editingPermission ? "Sửa permission" : "Tạo permission"}</DialogTitle>
            <DialogContent className="form-stack">
              <div className="form-grid">
                <Field label="Mã quyền" required>
                  <Input
                    value={permissionForm.permissionCode}
                    disabled={Boolean(editingPermission)}
                    onChange={(_, data) => setPermissionForm((value) => ({ ...value, permissionCode: data.value }))}
                  />
                </Field>
                <Field label="Tên permission" required>
                  <Input
                    value={permissionForm.permissionName}
                    onChange={(_, data) => setPermissionForm((value) => ({ ...value, permissionName: data.value }))}
                  />
                </Field>
              </div>
              <Field label="Phân hệ" required>
                {moduleOptions.length ? (
                  <Dropdown
                    value={permissionForm.module}
                    selectedOptions={[permissionForm.module]}
                    onOptionSelect={(_, data) => setPermissionForm((value) => ({ ...value, module: data.optionValue ?? "" }))}
                  >
                    {moduleOptions.map((item) => (
                      <Option key={item} value={item} text={item}>
                        {item}
                      </Option>
                    ))}
                  </Dropdown>
                ) : (
                  <Input value={permissionForm.module} onChange={(_, data) => setPermissionForm((value) => ({ ...value, module: data.value }))} />
                )}
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
    </div>
  );
}

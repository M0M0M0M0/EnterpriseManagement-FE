import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  OverlayDrawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Toaster,
} from "@fluentui/react-components";
import {
  BuildingRegular,
  CalendarRegular,
  ChartMultipleRegular,
  ClockRegular,
  DismissRegular,
  DocumentBulletListRegular,
  HistoryRegular,
  HomeRegular,
  MoneyRegular,
  NavigationRegular,
  PeopleTeamRegular,
  PersonRegular,
  SettingsRegular,
  ShieldRegular,
  SignOutRegular,
  SquareRegular,
} from "@fluentui/react-icons";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useMenuStore } from "../store/useMenuStore";
import type { UserRole } from "../types/domain";
import { NotificationBell } from "./NotificationBell";
import { ConfirmDialog, EmployeeAvatar } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  // Nhóm hiển thị trong thanh bên (chỉ có khi tài khoản có từ hai nhóm trở lên).
  group?: string;
}

// Nhóm menu theo khu vực của route, cùng thứ tự với màn Tiện ích của mobile: việc cá nhân trước, rồi quản lý, nhân sự, quản trị.
const NAV_GROUPS: { prefix: string; label: string }[] = [
  { prefix: "/employee/", label: "Cá nhân" },
  { prefix: "/manager/", label: "Quản lý" },
  { prefix: "/hr/", label: "Nhân sự" },
  { prefix: "/admin/", label: "Quản trị" },
];

function groupRank(route: string) {
  const index = NAV_GROUPS.findIndex((g) => route.startsWith(g.prefix));
  return index === -1 ? NAV_GROUPS.length : index;
}


const navByRole: Record<UserRole, NavItem[]> = {
  employee: [
    { to: "/employee/dashboard", label: "Tổng quan", icon: <HomeRegular />, end: true },
    { to: "/employee/attendance", label: "Chấm công của tôi", icon: <ClockRegular /> },
    { to: "/employee/leave", label: "Xin nghỉ phép", icon: <CalendarRegular /> },
    { to: "/employee/overtime", label: "Làm thêm giờ", icon: <ClockRegular /> },
  ],
  hr: [
    { to: "/employee/dashboard", label: "Tổng quan", icon: <HomeRegular />, end: true },
    { to: "/employee/attendance", label: "Chấm công của tôi", icon: <ClockRegular /> },
    { to: "/employee/leave", label: "Xin nghỉ phép", icon: <CalendarRegular /> },
    { to: "/employee/overtime", label: "Làm thêm giờ", icon: <ClockRegular /> },
  ],
  manager: [
    { to: "/manager/dashboard", label: "Tổng quan", icon: <HomeRegular />, end: true },
    { to: "/manager/employees", label: "Quản lý nhân viên", icon: <PeopleTeamRegular /> },
    { to: "/employee/attendance", label: "Chấm công của tôi", icon: <ClockRegular /> },
    { to: "/manager/attendance", label: "Quản lý chấm công", icon: <ClockRegular /> },
    { to: "/manager/leave", label: "Duyệt đơn từ", icon: <DocumentBulletListRegular /> },
    { to: "/manager/organization", label: "Phòng ban & chức vụ", icon: <BuildingRegular /> },
  ],
  admin: [
    { to: "/admin/employees", label: "Quản lý nhân viên", icon: <PeopleTeamRegular />, end: true },
    { to: "/admin/departments", label: "Phòng ban", icon: <BuildingRegular /> },
    { to: "/admin/positions", label: "Chức vụ", icon: <PersonRegular /> },
    { to: "/admin/audit", label: "Nhật ký hệ thống", icon: <HistoryRegular /> },
    { to: "/admin/system", label: "Quản trị hệ thống", icon: <SettingsRegular /> },
  ],
};

// Ánh xạ tên icon lưu trong DB (cột Menu.Icon, ví dụ "HomeRegular") sang component thật.
// Menu tạo mới qua màn hình Admin nếu dùng tên icon lạ sẽ tự rơi về SquareRegular.
const iconByName: Record<string, ReactNode> = {
  HomeRegular: <HomeRegular />,
  ClockRegular: <ClockRegular />,
  CalendarRegular: <CalendarRegular />,
  ChartMultipleRegular: <ChartMultipleRegular />,
  PeopleTeamRegular: <PeopleTeamRegular />,
  DocumentBulletListRegular: <DocumentBulletListRegular />,
  BuildingRegular: <BuildingRegular />,
  ShieldRegular: <ShieldRegular />,
  HistoryRegular: <HistoryRegular />,
  SettingsRegular: <SettingsRegular />,
  MoneyRegular: <MoneyRegular />,
  PersonRegular: <PersonRegular />,
};

function resolveIcon(name?: string): ReactNode {
  return (name && iconByName[name]) || <SquareRegular />;
}

const roleLabels: Record<UserRole, string> = {
  employee: "Không gian nhân viên",
  manager: "Không gian quản lý",
  hr: "Không gian nhân sự",
  admin: "Không gian quản trị",
};

function pageTitleFor(pathname: string, items: NavItem[]) {
  if (pathname.startsWith("/profile")) return "Hồ sơ của tôi";
  if (pathname.startsWith("/account-settings")) return "Cài đặt tài khoản";
  if (pathname.startsWith("/privacy")) return "Chính sách quyền riêng tư";
  if (pathname.startsWith("/notifications")) return "Thông báo";
  return items.find((item) => pathname.startsWith(item.to))?.label ?? "EMS";
}

function NavContent({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const showGroups = new Set(items.map((item) => item.group).filter(Boolean)).size >= 2;
  return (
    <>
      <div className="brand-lockup">
        <span className="brand-mark">
          <ClockRegular />
        </span>
        <div>
          <strong>EMS</strong>
          <span>Enterprise Management</span>
        </div>
      </div>
      <nav className="side-nav" aria-label="Điều hướng chính">
        {items.map((item, index) => (
          <Fragment key={item.to}>
            {showGroups && item.group && item.group !== items[index - 1]?.group ? (
              <span className="nav-group-title">{item.group}</span>
            ) : null}
            <NavLink to={item.to} end={item.end} onClick={onNavigate}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </Fragment>
        ))}
      </nav>
    </>
  );
}

export function AppShell() {
  const role = useAuthStore((state) => state.role);
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menus = useMenuStore((state) => state.menus);
  const menuStatus = useMenuStore((state) => state.status);
  const loadMenus = useMenuStore((state) => state.load);

  useEffect(() => {
    if (!session) return;
    loadMenus(session.token);
  }, [session, loadMenus]);

  const dynamicNavItems: NavItem[] | null =
    menuStatus === "loaded" && menus
      ? menus
          .filter((menu) => menu.route !== "/admin/users") // menu "Tài khoản" cũ đã gộp vào Quản lý nhân viên
          .sort((a, b) => groupRank(a.route) - groupRank(b.route) || a.displayOrder - b.displayOrder)
          .map((menu, index) => ({
            to: menu.route,
            label: menu.menuName,
            icon: resolveIcon(menu.icon),
            end: index === 0,
            group: NAV_GROUPS[groupRank(menu.route)]?.label,
          }))
      : null; // Menu chưa tải xong hoặc API lỗi -> giữ nav tĩnh theo role để không bao giờ mất điều hướng.

  if (!role || !session) return null;
  const navItems = dynamicNavItems && dynamicNavItems.length > 0 ? dynamicNavItems : navByRole[role];
  const title = pageTitleFor(location.pathname, navItems);

  const doLogout = () => {
    logout();
    useMenuStore.getState().reset();
    navigate("/login");
  };

  return (
    <div className={`app-shell role-${role}`}>
      <aside className="sidebar">
        <NavContent items={navItems} />
      </aside>
      <OverlayDrawer
        open={mobileOpen}
        onOpenChange={(_, data) => setMobileOpen(data.open)}
        position="start"
        className="mobile-drawer"
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label="Đóng menu"
                onClick={() => setMobileOpen(false)}
              />
            }
          >
            Điều hướng
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          <NavContent items={navItems} onNavigate={() => setMobileOpen(false)} />
        </DrawerBody>
      </OverlayDrawer>

      <div className="app-column">
        <header className="topbar">
          <div className="topbar-title">
            <Button
              className="mobile-menu-button"
              appearance="subtle"
              icon={<NavigationRegular />}
              aria-label="Mở menu"
              onClick={() => setMobileOpen(true)}
            />
            <div>
              <strong>{title}</strong>
              <span>{roleLabels[role]}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="subtle" className="user-trigger">
                  <EmployeeAvatar name={session.username} color="#1D4ED8" size={32} />
                  <span>{session.username}</span>
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem icon={<PersonRegular />} onClick={() => navigate("/profile")}>
                    Hồ sơ của tôi
                  </MenuItem>
                  <MenuItem icon={<SettingsRegular />} onClick={() => navigate("/account-settings")}>
                    Cài đặt tài khoản
                  </MenuItem>
                  <MenuItem icon={<ShieldRegular />} onClick={() => navigate("/privacy")}>
                    Chính sách quyền riêng tư
                  </MenuItem>
                  <MenuItem icon={<SignOutRegular />} onClick={() => setConfirmLogout(true)}>
                    Đăng xuất
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>

        {role === "employee" ? (
          <nav className="bottom-nav" aria-label="Điều hướng nhân viên">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="Đăng xuất"
        description="Bạn có chắc muốn đăng xuất khỏi ứng dụng?"
        confirmLabel="Đăng xuất"
        onConfirm={() => {
          setConfirmLogout(false);
          doLogout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
      <Toaster toasterId="app-toaster" position="top-end" />
    </div>
  );
}

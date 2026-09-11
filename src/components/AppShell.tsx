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
  NavigationRegular,
  PeopleTeamRegular,
  PersonRegular,
  SettingsRegular,
  ShieldRegular,
  SignOutRegular,
} from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import type { UserRole } from "../types/domain";
import { EmployeeAvatar } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const navByRole: Record<UserRole, NavItem[]> = {
  employee: [
    { to: "/employee/dashboard", label: "Dashboard", icon: <HomeRegular />, end: true },
    { to: "/employee/attendance", label: "Chấm công", icon: <ClockRegular /> },
    { to: "/employee/leave", label: "Xin nghỉ phép", icon: <CalendarRegular /> },
    { to: "/employee/sales", label: "Sale & KPI của tôi", icon: <ChartMultipleRegular /> },
    { to: "/employee/customers", label: "Khách hàng", icon: <PeopleTeamRegular /> },
  ],
  manager: [
    { to: "/manager/dashboard", label: "Dashboard tổng quan", icon: <HomeRegular />, end: true },
    { to: "/manager/employees", label: "Quản lý nhân viên", icon: <PeopleTeamRegular /> },
    { to: "/manager/attendance", label: "Quản lý chấm công", icon: <ClockRegular /> },
    { to: "/manager/leave", label: "Duyệt đơn xin nghỉ", icon: <DocumentBulletListRegular /> },
    { to: "/manager/sales", label: "Quản lý KPI & Sale", icon: <ChartMultipleRegular /> },
    { to: "/manager/customers", label: "Quản lý khách hàng", icon: <PeopleTeamRegular /> },
    { to: "/manager/organization", label: "Phòng ban & chức vụ", icon: <BuildingRegular /> },
  ],
  admin: [
    { to: "/admin/users", label: "User / Role / Permission", icon: <ShieldRegular />, end: true },
    { to: "/admin/employees", label: "Quản lý nhân viên", icon: <PeopleTeamRegular /> },
    { to: "/admin/organization", label: "Phòng ban & chức vụ", icon: <BuildingRegular /> },
    { to: "/admin/customers", label: "Quản lý khách hàng", icon: <PeopleTeamRegular /> },
    { to: "/admin/audit", label: "Audit Log", icon: <HistoryRegular /> },
    { to: "/admin/system", label: "System Administration", icon: <SettingsRegular /> },
  ],
};

const roleLabels: Record<UserRole, string> = {
  employee: "Không gian nhân viên",
  manager: "Không gian quản lý",
  admin: "Không gian quản trị",
};

function pageTitleFor(pathname: string, items: NavItem[]) {
  if (pathname.startsWith("/profile")) return "Hồ sơ của tôi";
  if (pathname.startsWith("/account-settings")) return "Cài đặt tài khoản";
  return items.find((item) => pathname.startsWith(item.to))?.label ?? "EMS";
}

function NavContent({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
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
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
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

  if (!role || !session) return null;
  const navItems = navByRole[role];
  const title = pageTitleFor(location.pathname, navItems);

  const doLogout = () => {
    logout();
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
                  <MenuItem icon={<SignOutRegular />} onClick={doLogout}>
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
      <Toaster toasterId="app-toaster" position="top-end" />
    </div>
  );
}

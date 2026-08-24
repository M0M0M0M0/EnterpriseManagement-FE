import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  OverlayDrawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Radio,
  RadioGroup,
  Switch,
  Toaster,
} from "@fluentui/react-components";
import {
  AlertRegular,
  ArrowResetRegular,
  BuildingRegular,
  CalendarClockRegular,
  CalendarRegular,
  ChartMultipleRegular,
  ClockRegular,
  DismissRegular,
  DocumentBulletListRegular,
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
import { useAppStore } from "../store/useAppStore";
import type { UserRole } from "../types/domain";
import { EmployeeAvatar } from "./ui";
import { useNotify } from "./useNotify";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: string;
  end?: boolean;
}

const hrNav: NavItem[] = [
  {
    to: "/hr/dashboard",
    label: "Tổng quan",
    icon: <HomeRegular />,
    permission: "dashboard.view",
    end: true,
  },
  {
    to: "/hr/attendance",
    label: "Chấm công",
    icon: <ClockRegular />,
    permission: "attendance.view",
  },
  {
    to: "/hr/employees",
    label: "Nhân viên",
    icon: <PeopleTeamRegular />,
    permission: "employee.view",
  },
  {
    to: "/hr/organization",
    label: "Phòng ban",
    icon: <BuildingRegular />,
    permission: "department.view",
  },
  {
    to: "/hr/shifts",
    label: "Ca làm",
    icon: <CalendarClockRegular />,
    permission: "attendance.view",
  },
  {
    to: "/hr/leave",
    label: "Nghỉ phép",
    icon: <DocumentBulletListRegular />,
    permission: "leave.view",
  },
  {
    to: "/sales/customers",
    label: "Khách hàng",
    icon: <PeopleTeamRegular />,
    permission: "customer.view",
  },
  {
    to: "/sales/records",
    label: "Sales",
    icon: <ChartMultipleRegular />,
    permission: "sale.view",
  },
  {
    to: "/sales/kpis",
    label: "KPI",
    icon: <ChartMultipleRegular />,
    permission: "kpi.view",
  },
  {
    to: "/payroll",
    label: "Bảng lương",
    icon: <DocumentBulletListRegular />,
    permission: "payroll.view",
  },
  {
    to: "/hr/reports",
    label: "Báo cáo",
    icon: <ChartMultipleRegular />,
    permission: "report.view",
  },
  {
    to: "/admin/users",
    label: "Tài khoản",
    icon: <ShieldRegular />,
    permission: "user.view",
  },
  {
    to: "/admin/audit",
    label: "Audit log",
    icon: <ShieldRegular />,
    permission: "audit.view",
  },
  {
    to: "/admin/system",
    label: "Hệ thống",
    icon: <SettingsRegular />,
    permission: "system.view",
  },
];

const employeeNav: NavItem[] = [
  {
    to: "/employee/home",
    label: "Trang chủ",
    icon: <HomeRegular />,
    end: true,
  },
  { to: "/employee/attendance", label: "Chấm công", icon: <ClockRegular /> },
  { to: "/employee/schedule", label: "Lịch ca", icon: <CalendarRegular /> },
  {
    to: "/employee/leave",
    label: "Nghỉ phép",
    icon: <DocumentBulletListRegular />,
  },
  { to: "/employee/profile", label: "Hồ sơ", icon: <PersonRegular /> },
];

const pageTitles: Record<string, string> = {
  "/hr/dashboard": "Tổng quan",
  "/hr/attendance": "Chấm công",
  "/hr/employees": "Nhân viên",
  "/hr/organization": "Phòng ban",
  "/hr/shifts": "Ca làm",
  "/hr/leave": "Nghỉ phép",
  "/sales/customers": "Khách hàng",
  "/sales/records": "Sales",
  "/sales/kpis": "KPI",
  "/payroll": "Bảng lương",
  "/hr/reports": "Báo cáo",
  "/admin/users": "Tài khoản",
  "/admin/audit": "Audit log",
  "/admin/system": "Hệ thống",
  "/employee/home": "Trang chủ",
  "/employee/attendance": "Chấm công",
  "/employee/schedule": "Lịch ca",
  "/employee/leave": "Nghỉ phép",
  "/employee/profile": "Hồ sơ",
};

function NavContent({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
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
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="demo-label">
        <AlertRegular />
        <span>Dữ liệu minh họa</span>
      </div>
    </>
  );
}

export function AppShell() {
  const role = useAppStore((state) => state.role);
  const currentEmployeeId = useAppStore((state) => state.currentEmployeeId);
  const employees = useAppStore((state) => state.employees);
  const demo = useAppStore((state) => state.demo);
  const logout = useAppStore((state) => state.logout);
  const login = useAppStore((state) => state.login);
  const resetDemo = useAppStore((state) => state.resetDemo);
  const setDemoLocation = useAppStore((state) => state.setDemoLocation);
  const setSimulatedDate = useAppStore((state) => state.setSimulatedDate);
  const setSimulateError = useAppStore((state) => state.setSimulateError);
  const markNotificationsRead = useAppStore(
    (state) => state.markNotificationsRead,
  );
  const hasPermission = useAppStore((state) => state.hasPermission);
  const notifications = useAppStore((state) => state.notifications);
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const navItems =
    role === "employee"
      ? employeeNav
      : hrNav.filter(
          (item) => !item.permission || hasPermission(item.permission),
        );
  const employee = employees.find((item) => item.id === currentEmployeeId);
  const displayName =
    role === "employee"
      ? (employee?.fullName ?? "Nhân viên")
      : role === "admin"
        ? "System Administrator"
        : role === "sales"
          ? "Sales Manager"
          : role === "payroll"
            ? "Payroll Officer"
            : "Trần Thu Hà";
  const unread = notifications.filter(
    (item) =>
      !item.read && (!item.employeeId || item.employeeId === currentEmployeeId),
  ).length;
  const title =
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ?? "EMS";

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  const doReset = () => {
    resetDemo();
    setDemoOpen(false);
    notify({ ok: true, message: "Đã khôi phục dữ liệu minh họa." });
    navigate("/login");
  };

  const switchRole = (nextRole: UserRole) => {
    login(nextRole);
    setDemoOpen(false);
    navigate(nextRole === "employee" ? "/employee/home" : "/hr/dashboard");
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
          <NavContent
            items={navItems}
            onNavigate={() => setMobileOpen(false)}
          />
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
              <span>
                {role === "hr" ? "Không gian HR" : "Không gian nhân viên"}
              </span>
            </div>
          </div>
          <div className="topbar-actions">
            <Button
              appearance="subtle"
              icon={<AlertRegular />}
              aria-label={`${unread} thông báo chưa đọc`}
              onClick={markNotificationsRead}
            >
              {unread > 0 ? unread : null}
            </Button>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="subtle" className="user-trigger">
                  <EmployeeAvatar
                    name={displayName}
                    color={employee?.avatarColor ?? "#1D4ED8"}
                    size={32}
                  />
                  <span>{displayName}</span>
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<SettingsRegular />}
                    onClick={() => setDemoOpen(true)}
                  >
                    Công cụ demo
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
            {employeeNav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        ) : null}
      </div>

      <Dialog
        open={demoOpen}
        onOpenChange={(_, data) => setDemoOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Công cụ demo</DialogTitle>
            <DialogContent className="form-stack">
              <Field label="Vai trò demo">
                <RadioGroup
                  value={role ?? "employee"}
                  onChange={(_, data) => switchRole(data.value as UserRole)}
                >
                  <Radio value="admin" label="Quản trị" />
                  <Radio value="hr" label="Nhân sự" />
                  <Radio value="sales" label="Sales" />
                  <Radio value="payroll" label="Payroll" />
                  <Radio value="employee" label="Nhân viên" />
                </RadioGroup>
              </Field>
              <Field label="Vị trí mô phỏng">
                <RadioGroup
                  value={demo.locationMode}
                  onChange={(_, data) =>
                    setDemoLocation(data.value as "inside" | "outside")
                  }
                >
                  <Radio value="inside" label="Trong bán kính văn phòng" />
                  <Radio value="outside" label="Ngoài bán kính văn phòng" />
                </RadioGroup>
              </Field>
              <Field
                label="Ngày mô phỏng"
                hint="Để trống để dùng ngày hiện tại"
              >
                <Input
                  type="date"
                  value={demo.simulatedDate ?? ""}
                  onChange={(_, data) =>
                    setSimulatedDate(data.value || undefined)
                  }
                />
              </Field>
              <Switch
                checked={demo.simulateError}
                onChange={(_, data) => setSimulateError(data.checked)}
                label="Mô phỏng lỗi kết nối"
              />
              <div className="danger-zone">
                <strong>Khôi phục dữ liệu</strong>
                <p>
                  Xóa mọi thay đổi trong localStorage và trở lại dữ liệu ban
                  đầu.
                </p>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDemoOpen(false)}>
                Đóng
              </Button>
              <Button
                appearance="primary"
                icon={<ArrowResetRegular />}
                onClick={doReset}
              >
                Đặt lại dữ liệu
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Toaster toasterId="app-toaster" position="top-end" />
    </div>
  );
}

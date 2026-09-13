import { Skeleton, SkeletonItem } from "@fluentui/react-components";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import {
  AccessDeniedPage,
  AccountSettingsPage,
  NotFoundPage,
  ProfilePage,
} from "./pages/CommonPages";
import { LoginPage } from "./pages/LoginPage";
import { menuApi } from "./services/api";
import { useAuthStore } from "./store/useAuthStore";
import type { UserRole } from "./types/domain";

const EmployeeDashboardPage = lazy(() =>
  import("./pages/EmployeePages").then((m) => ({ default: m.EmployeeDashboardPage })),
);
const EmployeeAttendancePage = lazy(() =>
  import("./pages/EmployeePages").then((m) => ({ default: m.EmployeeAttendancePage })),
);
const EmployeeLeavePage = lazy(() =>
  import("./pages/EmployeePages").then((m) => ({ default: m.EmployeeLeavePage })),
);
const EmployeeSalesPage = lazy(() =>
  import("./pages/EmployeePages").then((m) => ({ default: m.EmployeeSalesPage })),
);
const EmployeeCustomersPage = lazy(() =>
  import("./pages/EmployeePages").then((m) => ({ default: m.EmployeeCustomersPage })),
);

const ManagerDashboardPage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerDashboardPage })),
);
const ManagerEmployeesPage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerEmployeesPage })),
);
const ManagerAttendancePage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerAttendancePage })),
);
const ManagerLeavePage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerLeavePage })),
);
const ManagerSalesPage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerSalesPage })),
);
const ManagerCustomersPage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerCustomersPage })),
);
const ManagerOrganizationPage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerOrganizationPage })),
);

const AdminUsersPage = lazy(() =>
  import("./pages/AdminApiFeedbackPages").then((m) => ({ default: m.AdminUsersApiPage })),
);
const AdminEmployeesPage = lazy(() =>
  import("./pages/AdminPages").then((m) => ({ default: m.AdminEmployeesPage })),
);
const AdminDepartmentsPage = lazy(() =>
  import("./pages/AdminPages").then((m) => ({ default: m.AdminDepartmentsPage })),
);
const AdminPositionsPage = lazy(() =>
  import("./pages/AdminPages").then((m) => ({ default: m.AdminPositionsPage })),
);
const AdminCustomersPage = lazy(() =>
  import("./pages/AdminPages").then((m) => ({ default: m.AdminCustomersPage })),
);
const AdminPayrollPage = lazy(() =>
  import("./pages/AdminApiFeedbackPages").then((m) => ({ default: m.AdminPayrollDeferredPage })),
);
const AdminAuditLogPage = lazy(() =>
  import("./pages/AdminApiFeedbackPages").then((m) => ({ default: m.AdminAuditLogApiPage })),
);
const AdminSystemPage = lazy(() =>
  import("./pages/AdminApiFeedbackPages").then((m) => ({ default: m.AdminSystemApiPage })),
);

function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const currentRole = useAuthStore((state) => state.role);
  if (!currentRole) return <Navigate to="/login" replace />;
  if (currentRole !== role) return <Navigate to="/403" replace />;
  return children;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const currentRole = useAuthStore((state) => state.role);
  if (!currentRole) return <Navigate to="/login" replace />;
  return children;
}

// Audit Log là trang dùng chung cho toàn hệ thống, không thuộc riêng role nào: Admin luôn
// xem được, Manager xem được khi Admin cấp permission "page.admin.audit" cho role MANAGER.
// Vì vậy gate theo permission thực tế (menu trả về từ /api/menus/mine) thay vì so khớp role
// cứng như RequireRole, để không phải tạo route/menu riêng cho từng role.
function RequireMenuAccess({ route, children }: { route: string; children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const currentRole = useAuthStore((state) => state.role);
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setStatus("loading");
    menuApi
      .getMine()
      .then((menus) => {
        if (cancelled) return;
        setStatus(menus.some((menu) => menu.route === route) ? "allowed" : "denied");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [session, route]);

  if (!currentRole || !session) return <Navigate to="/login" replace />;
  if (status === "loading") return null;
  if (status === "denied") return <Navigate to="/403" replace />;
  return children;
}

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Đang tải dữ liệu">
      <Skeleton>
        <SkeletonItem size={32} />
        <SkeletonItem />
        <SkeletonItem />
        <SkeletonItem />
      </Skeleton>
    </div>
  );
}

function AppRedirect() {
  const role = useAuthStore((state) => state.role);
  if (!role) return <Navigate to="/login" replace />;
  if (role === "employee") return <Navigate to="/employee/dashboard" replace />;
  if (role === "manager") return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/admin/users" replace />;
}

function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<AccessDeniedPage />} />
        <Route path="/app" element={<AppRedirect />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/account-settings" element={<AccountSettingsPage />} />
        </Route>

        <Route
          element={
            <RequireRole role="employee">
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
          <Route path="/employee/attendance" element={<EmployeeAttendancePage />} />
          <Route path="/employee/leave" element={<EmployeeLeavePage />} />
          <Route path="/employee/sales" element={<EmployeeSalesPage />} />
          <Route path="/employee/customers" element={<EmployeeCustomersPage />} />
        </Route>

        <Route
          element={
            <RequireRole role="manager">
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
          <Route path="/manager/employees" element={<ManagerEmployeesPage />} />
          <Route path="/manager/attendance" element={<ManagerAttendancePage />} />
          <Route path="/manager/leave" element={<ManagerLeavePage />} />
          <Route path="/manager/sales" element={<ManagerSalesPage />} />
          <Route path="/manager/customers" element={<ManagerCustomersPage />} />
          <Route path="/manager/organization" element={<ManagerOrganizationPage />} />
        </Route>

        <Route
          element={
            <RequireRole role="admin">
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/employees" element={<AdminEmployeesPage />} />
          <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="/admin/positions" element={<AdminPositionsPage />} />
          <Route path="/admin/customers" element={<AdminCustomersPage />} />
          <Route path="/admin/payroll" element={<AdminPayrollPage />} />
          <Route path="/admin/system" element={<AdminSystemPage />} />
        </Route>

        <Route
          element={
            <RequireMenuAccess route="/admin/audit">
              <AppShell />
            </RequireMenuAccess>
          }
        >
          <Route path="/admin/audit" element={<AdminAuditLogPage />} />
          <Route path="/admin/audit-log" element={<Navigate to="/admin/audit" replace />} />
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;

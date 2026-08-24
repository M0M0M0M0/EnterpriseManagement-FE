import { Skeleton, SkeletonItem } from "@fluentui/react-components";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AccessDeniedPage, NotFoundPage } from "./pages/CommonPages";
import {
  HrAttendancePage,
  HrDashboardPage,
} from "./pages/HrDashboardAttendance";
import { LoginPage } from "./pages/LoginPage";
import { useAppStore } from "./store/useAppStore";
import type { UserRole } from "./types/domain";

const EmployeeHomePage = lazy(() =>
  import("./pages/EmployeePages").then((module) => ({
    default: module.EmployeeHomePage,
  })),
);
const EmployeeAttendancePage = lazy(() =>
  import("./pages/EmployeePages").then((module) => ({
    default: module.EmployeeAttendancePage,
  })),
);
const EmployeeSchedulePage = lazy(() =>
  import("./pages/EmployeePages").then((module) => ({
    default: module.EmployeeSchedulePage,
  })),
);
const EmployeeLeavePage = lazy(() =>
  import("./pages/EmployeePages").then((module) => ({
    default: module.EmployeeLeavePage,
  })),
);
const EmployeeProfilePage = lazy(() =>
  import("./pages/EmployeePages").then((module) => ({
    default: module.EmployeeProfilePage,
  })),
);
const HrEmployeesPage = lazy(() =>
  import("./pages/HrManagementPages").then((module) => ({
    default: module.HrEmployeesPage,
  })),
);
const HrEmployeeDetailPage = lazy(() =>
  import("./pages/HrManagementPages").then((module) => ({
    default: module.HrEmployeeDetailPage,
  })),
);
const HrOrganizationPage = lazy(() =>
  import("./pages/HrManagementPages").then((module) => ({
    default: module.HrOrganizationPage,
  })),
);
const HrShiftsPage = lazy(() =>
  import("./pages/HrManagementPages").then((module) => ({
    default: module.HrShiftsPage,
  })),
);
const HrLeavePage = lazy(() =>
  import("./pages/HrManagementPages").then((module) => ({
    default: module.HrLeavePage,
  })),
);
const HrReportsPage = lazy(() =>
  import("./pages/HrManagementPages").then((module) => ({
    default: module.HrReportsPage,
  })),
);
const CustomersPage = lazy(() =>
  import("./pages/EnterprisePages").then((module) => ({
    default: module.CustomersPage,
  })),
);
const SalesRecordsPage = lazy(() =>
  import("./pages/EnterprisePages").then((module) => ({
    default: module.SalesRecordsPage,
  })),
);
const KpiPage = lazy(() =>
  import("./pages/EnterprisePages").then((module) => ({
    default: module.KpiPage,
  })),
);
const PayrollPage = lazy(() =>
  import("./pages/EnterprisePages").then((module) => ({
    default: module.PayrollPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("./pages/EnterprisePages").then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const AuditLogPage = lazy(() =>
  import("./pages/EnterprisePages").then((module) => ({
    default: module.AuditLogPage,
  })),
);

function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const currentRole = useAppStore((state) => state.role);
  if (!currentRole) return <Navigate to="/login" replace />;
  if (role === "hr") {
    if (currentRole === "employee") return <Navigate to="/403" replace />;
    return children;
  }
  if (currentRole !== role) return <Navigate to="/403" replace />;
  return children;
}

function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const currentRole = useAppStore((state) => state.role);
  const hasPermission = useAppStore((state) => state.hasPermission);
  if (!currentRole) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <Navigate to="/403" replace />;
  return children;
}

function RouteLoading() {
  return (
    <div
      className="route-loading"
      role="status"
      aria-label="Đang tải dữ liệu minh họa"
    >
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
  const role = useAppStore((state) => state.role);
  if (!role) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={role === "employee" ? "/employee/home" : "/hr/dashboard"}
      replace
    />
  );
}

function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<AccessDeniedPage />} />
        <Route path="/app" element={<AppRedirect />} />

        <Route
          element={
            <RequireRole role="hr">
              <AppShell />
            </RequireRole>
          }
        >
          <Route
            path="/hr/dashboard"
            element={
              <RequirePermission permission="dashboard.view">
                <HrDashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/attendance"
            element={
              <RequirePermission permission="attendance.view">
                <HrAttendancePage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/employees"
            element={
              <RequirePermission permission="employee.view">
                <HrEmployeesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/employees/:employeeId"
            element={
              <RequirePermission permission="employee.view">
                <HrEmployeeDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/organization"
            element={
              <RequirePermission permission="department.view">
                <HrOrganizationPage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/shifts"
            element={
              <RequirePermission permission="attendance.view">
                <HrShiftsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/leave"
            element={
              <RequirePermission permission="leave.view">
                <HrLeavePage />
              </RequirePermission>
            }
          />
          <Route
            path="/hr/reports"
            element={
              <RequirePermission permission="report.view">
                <HrReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/sales/customers"
            element={
              <RequirePermission permission="customer.view">
                <CustomersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/sales/records"
            element={
              <RequirePermission permission="sale.view">
                <SalesRecordsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/sales/kpis"
            element={
              <RequirePermission permission="kpi.view">
                <KpiPage />
              </RequirePermission>
            }
          />
          <Route
            path="/payroll"
            element={
              <RequirePermission permission="payroll.view">
                <PayrollPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequirePermission permission="user.view">
                <AdminUsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <RequirePermission permission="audit.view">
                <AuditLogPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route
          element={
            <RequireRole role="employee">
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="/employee/home" element={<EmployeeHomePage />} />
          <Route
            path="/employee/attendance"
            element={<EmployeeAttendancePage />}
          />
          <Route path="/employee/schedule" element={<EmployeeSchedulePage />} />
          <Route path="/employee/leave" element={<EmployeeLeavePage />} />
          <Route path="/employee/profile" element={<EmployeeProfilePage />} />
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;

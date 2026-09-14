import { Skeleton, SkeletonItem } from "@fluentui/react-components";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import {
  AccessDeniedPage,
  AccountSettingsPage,
  NotFoundPage,
  ProfilePage,
} from "./pages/CommonPages";
import { LoginPage } from "./pages/LoginPage";
import { useAuthStore } from "./store/useAuthStore";
import { useMenuStore } from "./store/useMenuStore";

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
const ManagerOrgTreePage = lazy(() =>
  import("./pages/ManagerPages").then((m) => ({ default: m.ManagerOrgTreePage })),
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
const AdminSalesPage = lazy(() =>
  import("./pages/AdminPages").then((m) => ({ default: m.AdminSalesPage })),
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

const ManagerKpiCommissionPage = lazy(() =>
  import("./pages/KpiCommissionPages").then((m) => ({ default: m.ManagerKpiCommissionPage })),
);
const EmployeeCommissionPage = lazy(() =>
  import("./pages/KpiCommissionPages").then((m) => ({ default: m.EmployeeCommissionPage })),
);

function RequireAuth({ children }: { children: ReactNode }) {
  const currentRole = useAuthStore((state) => state.role);
  if (!currentRole) return <Navigate to="/login" replace />;
  return children;
}

// Chốt chặn hẹp, chỉ dùng riêng cho /admin/payroll (chưa có menu/permission thật) — xem
// ghi chú cạnh route bên dưới. Không dùng lại chỗ khác.
function RequirePayrollPlaceholder({ children }: { children: ReactNode }) {
  const currentRole = useAuthStore((state) => state.role);
  if (!currentRole) return <Navigate to="/login" replace />;
  if (currentRole !== "admin") return <Navigate to="/403" replace />;
  return children;
}

// Không có route/trang nào gắn cứng theo role trong code — mọi trang nghiệp vụ đều gác
// bằng permission thật (menu trả về từ /api/menus/mine, do Admin cấu hình qua màn hình
// Role/Permission/Menu). Vai trò nào cũng dùng được bất kỳ trang nào MIỄN LÀ Admin đã cấp
// đúng permission cho role đó — kể cả role tạo mới sau này, không cần sửa code ở đây.
function RequireMenuAccess({ route, children }: { route: string; children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const currentRole = useAuthStore((state) => state.role);
  const menus = useMenuStore((state) => state.menus);
  const status = useMenuStore((state) => state.status);
  const loadMenus = useMenuStore((state) => state.load);

  useEffect(() => {
    if (!session) return;
    loadMenus(session.token);
  }, [session, loadMenus]);

  if (!currentRole || !session) return <Navigate to="/login" replace />;
  if (status === "idle" || status === "loading") return null;
  // Lỗi tải menu (API lỗi, mất mạng...) thì cho qua thay vì khoá luôn người dùng ra ngoài —
  // các trang bên trong vẫn tự chịu trách nhiệm gọi API thật với permission thật ở backend.
  if (status === "loaded" && !(menus ?? []).some((menu) => menu.route === route)) {
    return <Navigate to="/403" replace />;
  }
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

// Mọi trang nghiệp vụ (đều có 1 Menu tương ứng đã seed sẵn permission "page.*") gác bằng
// RequireMenuAccess — vai trò nào có permission cho route đó thì vào được, không phân biệt
// role cố định trong code. Muốn đổi ai được dùng trang nào, Admin sửa Role/Permission/Menu,
// không cần deploy lại code.
const businessRoutes: { path: string; element: ReactNode }[] = [
  { path: "/employee/dashboard", element: <EmployeeDashboardPage /> },
  { path: "/employee/attendance", element: <EmployeeAttendancePage /> },
  { path: "/employee/leave", element: <EmployeeLeavePage /> },
  { path: "/employee/sales", element: <EmployeeSalesPage /> },
  { path: "/employee/customers", element: <EmployeeCustomersPage /> },
  { path: "/manager/dashboard", element: <ManagerDashboardPage /> },
  { path: "/manager/employees", element: <ManagerEmployeesPage /> },
  { path: "/manager/attendance", element: <ManagerAttendancePage /> },
  { path: "/manager/leave", element: <ManagerLeavePage /> },
  { path: "/manager/sales", element: <ManagerSalesPage /> },
  { path: "/manager/customers", element: <ManagerCustomersPage /> },
  { path: "/manager/organization", element: <ManagerOrganizationPage /> },
  { path: "/manager/org-tree", element: <ManagerOrgTreePage /> },
  { path: "/manager/kpi-commission", element: <ManagerKpiCommissionPage /> },
  { path: "/employee/commission", element: <EmployeeCommissionPage /> },
  { path: "/admin/users", element: <AdminUsersPage /> },
  { path: "/admin/employees", element: <AdminEmployeesPage /> },
  { path: "/admin/departments", element: <AdminDepartmentsPage /> },
  { path: "/admin/positions", element: <AdminPositionsPage /> },
  { path: "/admin/sales", element: <AdminSalesPage /> },
  { path: "/admin/customers", element: <AdminCustomersPage /> },
  { path: "/admin/system", element: <AdminSystemPage /> },
  { path: "/admin/audit", element: <AdminAuditLogPage /> },
];

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

        {businessRoutes.map(({ path, element }) => (
          <Route
            key={path}
            element={
              <RequireMenuAccess route={path}>
                <AppShell />
              </RequireMenuAccess>
            }
          >
            <Route path={path} element={element} />
          </Route>
        ))}
        <Route path="/admin/audit-log" element={<Navigate to="/admin/audit" replace />} />

        {/* Payroll chưa có menu/permission riêng (tính năng chưa xong, không có trong sidebar) —
            giữ tạm 1 chốt chặn hẹp theo role admin cho tới khi được đưa vào hệ thống
            Menu/Permission như các trang khác ở trên. */}
        <Route
          element={
            <RequirePayrollPlaceholder>
              <AppShell />
            </RequirePayrollPlaceholder>
          }
        >
          <Route path="/admin/payroll" element={<AdminPayrollPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;

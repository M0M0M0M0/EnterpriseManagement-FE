import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/auth/login") {
      const body = JSON.parse(request.postData() || "{}") as { username?: string; password?: string };
      if (body.password === "sai-mat-khau") {
        await json(route, { message: "Sai mật khẩu." }, 401);
        return;
      }
      const rolesByUser: Record<string, string[]> = {
        admin: ["ADMIN"],
        manager: ["MANAGER"],
        employee: ["EMPLOYEE"],
      };
      await json(route, {
        token: `${body.username}-token`,
        username: body.username,
        employeeCode: body.username === "admin" ? undefined : body.username?.toUpperCase(),
        roles: rolesByUser[body.username ?? ""] ?? ["EMPLOYEE"],
      });
      return;
    }

    if (path === "/api/dashboard/employee/EMPLOYEE") {
      await json(route, {
        employeeCode: "EMPLOYEE",
        employeeName: "Employee Demo",
        totalRemainingLeaveDays: 12,
        pendingLeaveRequestsCount: 1,
        pendingSalesCount: 0,
        pendingAttendanceAdjustmentsCount: 0,
      });
      return;
    }

    if (path === "/api/dashboard/manager/MANAGER") {
      await json(route, {
        managerCode: "MANAGER",
        teamSize: 6,
        pendingLeaveRequestsCount: 2,
        pendingSalesCount: 1,
        pendingAttendanceAdjustmentsCount: 1,
        teamMonthlyRevenue: 250000000,
        teamPresentTodayCount: 5,
        teamAbsentTodayCount: 1,
      });
      return;
    }

    if (path === "/api/users") {
      await json(route, [
        {
          username: "admin",
          email: "admin@ems.local",
          roles: ["ADMIN"],
          isActive: true,
        },
      ]);
      return;
    }

    if (["/api/roles", "/api/permissions", "/api/menus", "/api/audit-logs"].includes(path)) {
      await json(route, { message: "Chưa khả dụng." }, 501);
      return;
    }

    await json(route, []);
  });
}

async function reset(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function login(page: Page, url: string, username: string) {
  await page.goto(url);
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill("123456");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await reset(page);
});

test("employee và manager đăng nhập qua public login", async ({ page }) => {
  await login(page, "/login", "employee");
  await expect(page).toHaveURL(/\/employee\/dashboard$/);
  await expect(page.getByRole("heading", { name: /chào employee demo/i })).toBeVisible();

  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await login(page, "/login", "manager");
  await expect(page).toHaveURL(/\/manager\/dashboard$/);
  await expect(page.getByRole("heading", { name: /tổng quan quản lý/i })).toBeVisible();
});

test("public login chặn admin, admin login qua URL ẩn vào Users", async ({ page }) => {
  await login(page, "/login", "admin");
  await expect(page.getByText(/tài khoản quản trị sử dụng cổng đăng nhập riêng/i)).toBeVisible();

  await login(page, "/internal/admin-login", "admin");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: /quản lý user \/ role \/ permission/i })).toBeVisible();
});

test("admin sidebar có System Administration, không hiện Payroll và không lộ URL admin ẩn", async ({ page }) => {
  await login(page, "/internal/admin-login", "admin");
  const nav = page.getByRole("navigation", { name: /điều hướng chính/i });
  await expect(nav.getByRole("link", { name: /system administration/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /payroll|bảng lương/i })).toHaveCount(0);
  await expect(page.getByText("/internal/admin-login")).toHaveCount(0);
});

test("audit, system và payroll đúng trạng thái API-based", async ({ page }) => {
  await login(page, "/internal/admin-login", "admin");

  await page.getByRole("link", { name: /audit log/i }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.getByText(/backend chưa cung cấp api audit log/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /xóa|clear|reset log/i })).toHaveCount(0);

  await page.getByRole("link", { name: /system administration/i }).click();
  await expect(page).toHaveURL(/\/admin\/system$/);
  await expect(page.getByText(/backend chưa cung cấp api menu/i)).toBeVisible();
  await expect(page.getByText(/api health|reset mock data/i)).toHaveCount(0);

  await page.goto("/admin/payroll");
  await expect(page.getByRole("heading", { level: 1, name: /payroll để sau/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /tính|duyệt|trả/i })).toHaveCount(0);
});

test("màn hình 360px không tràn ngang và login không có lỗi accessibility nghiêm trọng", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
});

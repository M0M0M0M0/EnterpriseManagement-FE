import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loginAdmin(page: Page) {
  await page.getByLabel("Tên đăng nhập").fill("admin");
  await page.getByLabel("Mật khẩu").fill("admin");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin\/employees$/);
  await expect(
    page.getByRole("heading", { name: "Quản lý nhân viên" }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => reset(page));

test("admin đăng nhập bằng tài khoản thật và thấy trang quản lý nhân viên", async ({
  page,
}) => {
  await loginAdmin(page);
  await page.getByRole("link", { name: "Phòng ban & chức vụ" }).click();
  await expect(
    page.getByRole("heading", { name: "Phòng ban & chức vụ" }),
  ).toBeVisible();
});

test("đăng nhập sai mật khẩu hiển thị lỗi", async ({ page }) => {
  await page.getByLabel("Tên đăng nhập").fill("admin");
  await page.getByLabel("Mật khẩu").fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("khách chưa đăng nhập bị chặn khỏi route admin", async ({ page }) => {
  await page.goto("/admin/employees");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập" }),
  ).toBeVisible();
});

test("màn hình 360px không tràn ngang và login không có lỗi accessibility nghiêm trọng", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

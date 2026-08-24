import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function reset(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loginHr(page: Page) {
  await page.getByRole("button", { name: /^Nhân sự/ }).click();
  await expect(page).toHaveURL(/\/hr\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Tổng quan nhân sự" }),
  ).toBeVisible();
}

async function loginEmployee(page: Page) {
  await page.getByRole("button", { name: /^Nhân viên/ }).click();
  await expect(page).toHaveURL(/\/employee\/home$/);
  await expect(page.getByRole("heading", { name: /^Chào / })).toBeVisible();
}

test.beforeEach(async ({ page }) => reset(page));

test("HR đăng nhập, tạo nhân viên và thấy dữ liệu sau khi tải lại", async ({
  page,
}) => {
  await loginHr(page);
  await page.getByRole("link", { name: "Nhân viên" }).click();
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();

  await page.getByLabel("Họ và tên").fill("Nguyễn Minh Kiểm Thử");
  await page.getByLabel("Số điện thoại").fill("0909123456");
  await page.getByLabel("Email").fill("kiemthu@bussines.demo");
  await page.getByLabel("Địa chỉ").fill("Quận 1, TP. Hồ Chí Minh");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();

  await expect(page.getByText("Nguyễn Minh Kiểm Thử").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Nguyễn Minh Kiểm Thử").first()).toBeVisible();

  await page.getByRole("link", { name: "Ca làm" }).click();
  await page.getByRole("button", { name: "Gán ca" }).click();
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(page.getByText("Đã gán ca cho nhân viên.").last()).toBeVisible();
});

test("HR lọc chấm công và xuất báo cáo CSV", async ({ page }) => {
  await loginHr(page);
  await page.getByRole("link", { name: "Chấm công" }).click();
  await expect(
    page.getByRole("heading", { name: "Quản lý chấm công" }),
  ).toBeVisible();
  await page.getByLabel("Ngày").fill("2026-08-17");
  await expect(
    page.getByRole("heading", { name: "Bản ghi ngày 17/08/2026" }),
  ).toBeVisible();

  await page.getByLabel("Tìm nhân viên").fill("NV015");
  await expect(page.getByRole("grid").getByText("NV015")).toBeVisible();
  await page.getByLabel("Tìm nhân viên").clear();

  await page.getByRole("button", { name: "Duyệt" }).first().click();
  await expect(page.getByText("Đã duyệt yêu cầu.").last()).toBeVisible();

  await page.getByRole("link", { name: "Nghỉ phép" }).click();
  await page.getByRole("button", { name: "Duyệt" }).first().click();
  await expect(page.getByText("Đã duyệt yêu cầu.").last()).toBeVisible();

  await page.getByRole("link", { name: "Báo cáo" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/bao-cao-cham-cong.*\.csv/);
});

test("nhân viên gửi điều chỉnh chấm công và đơn nghỉ phép", async ({
  page,
}) => {
  await loginEmployee(page);
  await page.getByRole("link", { name: "Chấm công" }).click();
  await page.getByRole("button", { name: "Điều chỉnh" }).click();
  await page.getByLabel("Lý do").fill("Thiết bị cá nhân hết pin");
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(
    page.getByText("Đã gửi yêu cầu điều chỉnh chấm công.").last(),
  ).toBeVisible();

  await page.getByRole("link", { name: "Nghỉ phép" }).click();
  await page.getByRole("button", { name: "Tạo đơn" }).click();
  await page.getByLabel("Từ ngày").fill("2035-06-04");
  await page.getByLabel("Đến ngày").fill("2035-06-05");
  await page.getByLabel("Lý do").fill("Khám sức khỏe định kỳ");
  await page.getByRole("button", { name: "Gửi đơn" }).click();
  await expect(page.getByText("Khám sức khỏe định kỳ").first()).toBeVisible();
});

test("nhân viên check-in, tải lại vẫn giữ trạng thái và check-out", async ({
  page,
}) => {
  await loginEmployee(page);
  await page.getByRole("button", { name: /Đặng Thùy Linh/ }).click();
  await page.getByRole("menuitem", { name: "Công cụ demo" }).click();
  await page.getByLabel("Ngày mô phỏng").fill("2035-05-12");
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.getByRole("button", { name: /Check-in/ }).click();
  await expect(page.getByRole("button", { name: /Check-out/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Check-out/ })).toBeVisible();
  await page.getByRole("button", { name: /Check-out/ }).click();
  await expect(page.getByText("Đã hoàn thành ca làm hôm nay")).toBeVisible();
});

test("phân quyền chặn nhân viên khỏi route HR", async ({ page }) => {
  await loginEmployee(page);
  await page.goto("/hr/employees");
  await expect(
    page.getByRole("heading", { name: "Không có quyền truy cập" }),
  ).toBeVisible();
});

test("màn hình 360px không tràn ngang và login không có lỗi accessibility nghiêm trọng", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.getByRole("heading", { name: "Chọn không gian làm việc" }),
  ).toBeVisible();
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

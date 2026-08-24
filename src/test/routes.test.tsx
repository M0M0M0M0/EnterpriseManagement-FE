import { FluentProvider } from "@fluentui/react-components";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { appTheme } from "../app/theme";
import { createSeedData } from "../data/seed";
import { useAppStore } from "../store/useAppStore";

function renderApp(path: string) {
  return render(
    <FluentProvider theme={appTheme}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </FluentProvider>,
  );
}

describe("xác thực và phân quyền", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createSeedData(),
      role: null,
      currentEmployeeId: null,
      demo: { locationMode: "inside", simulateError: false },
    });
  });

  it("chuyển khách chưa đăng nhập về màn hình chọn vai trò", () => {
    renderApp("/hr/dashboard");
    expect(
      screen.getByRole("heading", { name: /chọn không gian làm việc/i }),
    ).toBeInTheDocument();
  });

  it("chặn nhân viên truy cập route HR", () => {
    useAppStore.setState({ role: "employee", currentEmployeeId: "emp-006" });
    renderApp("/hr/dashboard");
    expect(
      screen.getByRole("heading", { name: /không có quyền truy cập/i }),
    ).toBeInTheDocument();
  });

  it("đăng nhập HR bằng tài khoản demo", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(screen.getByRole("button", { name: /^nhân sự/i }));
    expect(
      await screen.findByRole(
        "heading",
        { name: /tổng quan nhân sự/i },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(useAppStore.getState().role).toBe("hr");
  });
});

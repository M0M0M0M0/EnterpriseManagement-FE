import { FluentProvider } from "@fluentui/react-components";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { appTheme } from "../app/theme";
import { useAuthStore } from "../store/useAuthStore";

function renderApp(path: string) {
  return render(
    <FluentProvider theme={appTheme}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </FluentProvider>,
  );
}

function json(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/auth/login") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { username?: string; password?: string };
        if (body.password === "bad") return json({ message: "Sai mật khẩu." }, 401);
        const rolesByUser: Record<string, string[]> = {
          admin: ["ADMIN"],
          manager: ["MANAGER"],
          employee: ["EMPLOYEE"],
        };
        return json({
          token: `${body.username}-token`,
          username: body.username,
          employeeCode: body.username === "admin" ? undefined : body.username?.toUpperCase(),
          roles: rolesByUser[body.username ?? ""] ?? ["EMPLOYEE"],
        });
      }
      if (url.endsWith("/api/users")) {
        return json([
          {
            username: "admin",
            email: "admin@ems.local",
            roles: ["ADMIN"],
            isActive: true,
          },
        ]);
      }
      if (url.endsWith("/api/roles") || url.endsWith("/api/permissions")) {
        return json({ message: "Chưa khả dụng." }, 501);
      }
      return json([]);
    }),
  );
}

describe("xác thực và phân quyền", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, role: null });
    mockApi();
  });

  it("chuyển khách chưa đăng nhập về màn hình đăng nhập", () => {
    renderApp("/admin/employees");
    expect(screen.getByRole("heading", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it("chặn nhân viên truy cập route Admin", () => {
    useAuthStore.setState({
      session: { token: "t", username: "employee", employeeCode: "EMPLOYEE", roles: ["EMPLOYEE"] },
      role: "employee",
    });
    renderApp("/admin/employees");
    expect(screen.getByRole("heading", { name: /không có quyền truy cập/i })).toBeInTheDocument();
  });

  it("public login chặn tài khoản admin", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.type(screen.getByLabelText(/tên đăng nhập/i), "admin");
    await user.type(screen.getByLabelText(/mật khẩu/i), "123456");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByText(/tài khoản quản trị sử dụng cổng đăng nhập riêng/i)).toBeInTheDocument();
  });

  it("admin đăng nhập qua URL ẩn và thấy Users nhưng không thấy Payroll trong sidebar", async () => {
    const user = userEvent.setup();
    renderApp("/internal/admin-login");
    await user.type(screen.getByLabelText(/tên đăng nhập/i), "admin");
    await user.type(screen.getByLabelText(/mật khẩu/i), "123456");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));
    expect(await screen.findByRole("heading", { name: /quản lý user \/ role \/ permission/i })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: /điều hướng chính/i });
    expect(within(nav).getByRole("link", { name: /system administration/i })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /bảng lương|payroll/i })).not.toBeInTheDocument();
    expect(screen.queryByText("/internal/admin-login")).not.toBeInTheDocument();
  });

  it("hiển thị trang không tìm thấy cho đường dẫn không hợp lệ", () => {
    useAuthStore.setState({
      session: { token: "t", username: "admin", roles: ["ADMIN"] },
      role: "admin",
    });
    renderApp("/duong-dan-khong-ton-tai");
    expect(screen.getByRole("heading", { name: /không tìm thấy trang/i })).toBeInTheDocument();
  });
});

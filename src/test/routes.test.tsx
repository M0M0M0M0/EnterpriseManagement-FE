import { FluentProvider } from "@fluentui/react-components";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
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

describe("xác thực và phân quyền", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, role: null });
  });

  it("chuyển khách chưa đăng nhập về màn hình đăng nhập", () => {
    renderApp("/admin/employees");
    expect(screen.getByRole("heading", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it("chặn nhân viên truy cập route Admin", () => {
    useAuthStore.setState({
      session: { token: "t", username: "nv1", employeeCode: "EMP001", roles: ["EMPLOYEE"] },
      role: "employee",
    });
    renderApp("/admin/employees");
    expect(
      screen.getByRole("heading", { name: /không có quyền truy cập/i }),
    ).toBeInTheDocument();
  });

  it("hiển thị trang không tìm thấy cho đường dẫn không hợp lệ", () => {
    useAuthStore.setState({
      session: { token: "t", username: "admin", roles: ["ADMIN"] },
      role: "admin",
    });
    renderApp("/duong-dan-khong-ton-tai");
    expect(
      screen.getByRole("heading", { name: /không tìm thấy trang/i }),
    ).toBeInTheDocument();
  });
});

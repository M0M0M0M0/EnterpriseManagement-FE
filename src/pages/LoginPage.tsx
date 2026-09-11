import { Badge, Button, Field, Input, Spinner } from "@fluentui/react-components";
import {
  CheckmarkCircleRegular,
  ClockRegular,
  PeopleTeamRegular,
  ShieldCheckmarkRegular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FieldError } from "../components/ui";
import { authApi } from "../services/api";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";

function homePathForRole(role: string | null) {
  if (role === "employee") return "/employee/dashboard";
  if (role === "manager") return "/manager/dashboard";
  if (role === "admin") return "/admin/users";
  return "/login";
}

export function LoginPage() {
  const session = useAuthStore((state) => state.session);
  const role = useAuthStore((state) => state.role);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={homePathForRole(role)} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    if (!credentials.username.trim() || !credentials.password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.login(credentials.username, credentials.password);
      setSession({
        token: result.token,
        username: result.username,
        employeeCode: result.employeeCode,
        roles: result.roles,
      });
      navigate(homePathForRole(useAuthStore.getState().role));
    } catch (err) {
      setError(errorMessage(err, "Đăng nhập thất bại. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-context" aria-labelledby="product-name">
        <div className="login-brand">
          <span className="brand-mark">
            <ClockRegular />
          </span>
          <span>EMS</span>
        </div>
        <div className="login-copy">
          <Badge appearance="tint" color="informative">
            Kết nối API thật
          </Badge>
          <h1 id="product-name">
            Quản lý nhân sự,
            <br />
            chấm công và kinh doanh.
          </h1>
          <p>Đăng nhập bằng tài khoản đã được cấp để vào không gian làm việc.</p>
        </div>
        <ul className="login-points">
          <li>
            <CheckmarkCircleRegular />
            <span>Chấm công, nghỉ phép, sale theo thời gian thực</span>
          </li>
          <li>
            <ShieldCheckmarkRegular />
            <span>Phân quyền Employee / Manager / Admin</span>
          </li>
          <li>
            <PeopleTeamRegular />
            <span>Dữ liệu đồng bộ trực tiếp từ hệ thống</span>
          </li>
        </ul>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="login-heading">
            <span className="mobile-login-mark">
              <ClockRegular />
            </span>
            <h2 id="login-title">Đăng nhập</h2>
            <p>Nhập tài khoản được cấp bởi quản trị viên hệ thống.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <Field label="Tên đăng nhập" required>
              <Input
                value={credentials.username}
                autoComplete="username"
                onChange={(_, data) =>
                  setCredentials((value) => ({ ...value, username: data.value }))
                }
              />
            </Field>
            <Field label="Mật khẩu" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(_, data) =>
                  setCredentials((value) => ({ ...value, password: data.value }))
                }
              />
            </Field>
            <FieldError message={error} />
            <Button appearance="primary" type="submit" disabled={loading}>
              {loading ? <Spinner size="tiny" /> : "Đăng nhập"}
            </Button>
          </form>

          <div className="login-note">
            <strong>Lưu ý</strong>
            <p>
              Hệ thống gọi trực tiếp API backend (EnterpriseManagement.Api). Hãy đảm
              bảo backend đang chạy tại http://localhost:5068.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

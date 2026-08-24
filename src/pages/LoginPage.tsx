import { Badge, Button, Field, Input } from "@fluentui/react-components";
import {
  ArrowRightRegular,
  CheckmarkCircleRegular,
  ClockRegular,
  PeopleTeamRegular,
  PersonRegular,
  ShieldCheckmarkRegular,
} from "@fluentui/react-icons";
import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { UserRole } from "../types/domain";
import { useNotify } from "../components/useNotify";

export function LoginPage() {
  const role = useAppStore((state) => state.role);
  const login = useAppStore((state) => state.login);
  const loginWithPassword = useAppStore((state) => state.loginWithPassword);
  const navigate = useNavigate();
  const notify = useNotify();
  const [credentials, setCredentials] = useState({
    username: "admin",
    password: "123456",
  });

  if (role)
    return (
      <Navigate
        to={role === "employee" ? "/employee/home" : "/hr/dashboard"}
        replace
      />
    );

  const enter = (selectedRole: UserRole) => {
    login(selectedRole);
    navigate(selectedRole === "employee" ? "/employee/home" : "/hr/dashboard");
  };

  const submitLogin = () => {
    const result = loginWithPassword(credentials.username, credentials.password);
    notify(result);
    if (result.ok) {
      const nextRole = useAppStore.getState().role;
      navigate(nextRole === "employee" ? "/employee/home" : "/hr/dashboard");
    }
  };

  return (
    <main className="login-page">
      <section className="login-context" aria-labelledby="product-name">
        <div className="login-brand">
          <span className="brand-mark">
            <ClockRegular />
          </span>
          <span>Bussines</span>
        </div>
        <div className="login-copy">
          <Badge appearance="tint" color="informative">
            Dữ liệu minh họa
          </Badge>
          <h1 id="product-name">
            Mỗi ca làm.
            <br />
            Một bản ghi rõ ràng.
          </h1>
          <p>Không gian chấm công và nhân sự minh họa cho đồ án sinh viên.</p>
        </div>
        <ul className="login-points">
          <li>
            <CheckmarkCircleRegular />
            <span>Chấm công theo vị trí</span>
          </li>
          <li>
            <ShieldCheckmarkRegular />
            <span>Phân quyền HR và nhân viên</span>
          </li>
          <li>
            <PeopleTeamRegular />
            <span>32 hồ sơ nhân sự minh họa</span>
          </li>
        </ul>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="login-heading">
            <span className="mobile-login-mark">
              <ClockRegular />
            </span>
            <h2 id="login-title">Chọn không gian làm việc</h2>
            <p>
              Prototype không yêu cầu mật khẩu. Chọn vai trò để bắt đầu luồng
              demo.
            </p>
          </div>

          <div className="role-options">
            <form
              className="login-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitLogin();
              }}
            >
              <Field label="Tên đăng nhập">
                <Input
                  value={credentials.username}
                  onChange={(_, data) =>
                    setCredentials((value) => ({
                      ...value,
                      username: data.value,
                    }))
                  }
                />
              </Field>
              <Field label="Mật khẩu">
                <Input
                  type="password"
                  value={credentials.password}
                  onChange={(_, data) =>
                    setCredentials((value) => ({
                      ...value,
                      password: data.value,
                    }))
                  }
                />
              </Field>
              <Button appearance="primary" type="submit">
                Đăng nhập
              </Button>
            </form>
            <button
              type="button"
              className="role-option"
              onClick={() => enter("hr")}
            >
              <span className="role-icon">
                <PeopleTeamRegular />
              </span>
              <span className="role-content">
                <strong>Nhân sự</strong>
                <small>Quản lý nhân viên, ca làm, đơn từ và báo cáo</small>
              </span>
              <ArrowRightRegular />
            </button>
            <button
              type="button"
              className="role-option"
              onClick={() => enter("employee")}
            >
              <span className="role-icon">
                <PersonRegular />
              </span>
              <span className="role-content">
                <strong>Nhân viên</strong>
                <small>Check-in, xem lịch ca và gửi đơn nghỉ phép</small>
              </span>
              <ArrowRightRegular />
            </button>
          </div>

          <div className="login-note">
            <strong>Lưu ý</strong>
            <p>
              Dữ liệu được lưu trong trình duyệt và có thể đặt lại từ menu Công
              cụ demo.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

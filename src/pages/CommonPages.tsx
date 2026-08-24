import { Button } from "@fluentui/react-components";
import {
  ArrowLeftRegular,
  LockClosedRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const role = useAppStore((state) => state.role);
  return (
    <main className="standalone-state">
      <LockClosedRegular />
      <h1>Không có quyền truy cập</h1>
      <p>Tài khoản hiện tại không được phép mở khu vực này.</p>
      <Button
        appearance="primary"
        icon={<ArrowLeftRegular />}
        onClick={() =>
          navigate(role === "hr" ? "/hr/dashboard" : "/employee/home")
        }
      >
        Về trang chính
      </Button>
    </main>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="standalone-state">
      <SearchRegular />
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn không tồn tại hoặc đã được thay đổi.</p>
      <Button
        appearance="primary"
        icon={<ArrowLeftRegular />}
        onClick={() => navigate("/app")}
      >
        Về trang chính
      </Button>
    </main>
  );
}

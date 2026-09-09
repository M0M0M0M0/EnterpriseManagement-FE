import { Badge, Button, Field, Input, Spinner } from "@fluentui/react-components";
import {
  ArrowLeftRegular,
  InfoRegular,
  LockClosedRegular,
  SaveRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EmptyState,
  PageHeader,
  SectionPanel,
} from "../components/ui";
import { useNotify } from "../components/useNotify";
import { employeeApi } from "../services/api";
import { errorMessage } from "../services/http";
import { useAuthStore } from "../store/useAuthStore";
import type { EmployeeDto, UpdateEmployeeRequest } from "../types/domain";
import { formatDate } from "../utils/format";

function homePathForRole(role: string | null) {
  if (role === "employee") return "/employee/dashboard";
  if (role === "manager") return "/manager/dashboard";
  if (role === "admin") return "/admin/employees";
  return "/login";
}

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  return (
    <main className="standalone-state">
      <LockClosedRegular />
      <h1>Không có quyền truy cập</h1>
      <p>Tài khoản hiện tại không được phép mở khu vực này.</p>
      <Button
        appearance="primary"
        icon={<ArrowLeftRegular />}
        onClick={() => navigate(homePathForRole(role))}
      >
        Về trang chính
      </Button>
    </main>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  return (
    <main className="standalone-state">
      <SearchRegular />
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn không tồn tại hoặc đã được thay đổi.</p>
      <Button
        appearance="primary"
        icon={<ArrowLeftRegular />}
        onClick={() => navigate(homePathForRole(role))}
      >
        Về trang chính
      </Button>
    </main>
  );
}

export function ProfilePage() {
  const session = useAuthStore((state) => state.session);
  const role = useAuthStore((state) => state.role);
  const notify = useNotify();
  const [employee, setEmployee] = useState<EmployeeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateEmployeeRequest>({
    phone: "",
    address: "",
    departmentCode: "",
    positionCode: "",
    managerCode: "",
  });

  useEffect(() => {
    if (!session?.employeeCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    employeeApi
      .getByCode(session.employeeCode)
      .then((data) => {
        setEmployee(data);
        setForm({
          phone: data.phone ?? "",
          address: data.address ?? "",
          departmentCode: data.departmentCode,
          positionCode: data.positionCode,
          managerCode: data.managerCode ?? "",
        });
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [session?.employeeCode]);

  const canEdit = role === "admin";

  const save = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      const updated = await employeeApi.update(employee.employeeCode, form);
      setEmployee(updated);
      setEditing(false);
      notify({ ok: true, message: "Đã cập nhật hồ sơ." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Đang tải hồ sơ..." />;

  if (!session?.employeeCode || !employee) {
    return (
      <div className="page-stack">
        <PageHeader title="Hồ sơ của tôi" />
        <EmptyState
          title="Không có hồ sơ nhân viên gắn với tài khoản"
          description={
            error ?? "Tài khoản này chưa được liên kết với một hồ sơ nhân viên."
          }
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Hồ sơ của tôi"
        description="Xem thông tin cá nhân và công việc hiện tại."
        action={
          canEdit ? (
            editing ? (
              <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={saving}>
                {saving ? <Spinner size="tiny" /> : "Lưu thay đổi"}
              </Button>
            ) : (
              <Button appearance="secondary" onClick={() => setEditing(true)}>
                Chỉnh sửa
              </Button>
            )
          ) : undefined
        }
      />
      <section className="profile-banner">
        <div className="profile-large-avatar" style={{ background: "#2563EB" }}>
          {employee.fullName
            .split(" ")
            .slice(-2)
            .map((part) => part[0])
            .join("")}
        </div>
        <div>
          <h2>{employee.fullName}</h2>
          <p>
            {employee.employeeCode} · {employee.positionName}
          </p>
          <Badge
            appearance="tint"
            color={employee.employmentStatus === "Active" ? "success" : "danger"}
          >
            {employee.employmentStatus}
          </Badge>
        </div>
      </section>

      <div className="two-column-grid">
        <SectionPanel title="Thông tin cá nhân">
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{employee.email ?? "--"}</dd>
            </div>
            <div>
              <dt>Điện thoại</dt>
              <dd>
                {editing ? (
                  <Input
                    value={form.phone ?? ""}
                    onChange={(_, data) => setForm((v) => ({ ...v, phone: data.value }))}
                  />
                ) : (
                  employee.phone ?? "--"
                )}
              </dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{employee.dateOfBirth ? formatDate(employee.dateOfBirth) : "--"}</dd>
            </div>
            <div>
              <dt>Giới tính</dt>
              <dd>{employee.gender ?? "--"}</dd>
            </div>
            <div>
              <dt>Địa chỉ</dt>
              <dd>
                {editing ? (
                  <Input
                    value={form.address ?? ""}
                    onChange={(_, data) => setForm((v) => ({ ...v, address: data.value }))}
                  />
                ) : (
                  employee.address ?? "--"
                )}
              </dd>
            </div>
          </dl>
        </SectionPanel>
        <SectionPanel title="Thông tin công việc">
          <dl className="detail-list">
            <div>
              <dt>Phòng ban</dt>
              <dd>{employee.departmentName}</dd>
            </div>
            <div>
              <dt>Chức vụ</dt>
              <dd>{employee.positionName}</dd>
            </div>
            <div>
              <dt>Quản lý trực tiếp</dt>
              <dd>{employee.managerCode ?? "--"}</dd>
            </div>
            <div>
              <dt>Ngày vào làm</dt>
              <dd>{formatDate(employee.hireDate)}</dd>
            </div>
          </dl>
        </SectionPanel>
      </div>

      {!canEdit ? (
        <SectionPanel title="Cập nhật thông tin">
          <div className="info-banner">
            <InfoRegular />
            <div>
              <strong>Cần thay đổi thông tin?</strong>
              <p>
                Backend hiện chỉ cho phép Admin chỉnh sửa hồ sơ nhân viên. Liên hệ
                Admin để cập nhật thông tin cá nhân.
              </p>
            </div>
          </div>
        </SectionPanel>
      ) : null}
    </div>
  );
}

export function AccountSettingsPage() {
  const session = useAuthStore((state) => state.session);
  if (!session) return null;
  return (
    <div className="page-stack">
      <PageHeader
        title="Cài đặt tài khoản"
        description="Xem thông tin đăng nhập hiện tại."
      />
      <SectionPanel title="Thông tin tài khoản">
        <dl className="detail-list">
          <div>
            <dt>Tên đăng nhập</dt>
            <dd>{session.username}</dd>
          </div>
          <div>
            <dt>Mã nhân viên</dt>
            <dd>{session.employeeCode ?? "--"}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>
              {session.roles.map((role) => (
                <Badge key={role} appearance="tint" color="informative" style={{ marginRight: 6 }}>
                  {role}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </SectionPanel>
      <SectionPanel title="Đổi mật khẩu">
        <div className="form-stack">
          <Field label="Mật khẩu hiện tại">
            <Input type="password" disabled />
          </Field>
          <Field label="Mật khẩu mới">
            <Input type="password" disabled />
          </Field>
          <div className="info-banner">
            <InfoRegular />
            <div>
              <strong>Tính năng chưa khả dụng</strong>
              <p>Backend chưa cung cấp API đổi mật khẩu. Chức năng sẽ được bật khi API sẵn sàng.</p>
            </div>
          </div>
          <Button appearance="primary" disabled>
            Đổi mật khẩu
          </Button>
        </div>
      </SectionPanel>
    </div>
  );
}

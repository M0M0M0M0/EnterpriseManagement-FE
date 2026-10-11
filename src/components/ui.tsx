import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  type BadgeProps,
} from "@fluentui/react-components";
import { BoxRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";
import {
  adjustmentStatusLabels,
  attendanceLabels,
  getInitials,
  requestLabels,
  returnSessionStateLabels,
  returnStatusLabels,
  sessionStatusLabels,
} from "../utils/format";

export const attendanceColors: Record<string, BadgeProps["color"]> = {
  Present: "success",
  Late: "warning",
  HalfDay: "warning",
  HalfDayAbsent: "danger",
  Absent: "danger",
  OnLeave: "informative",
  None: "subtle",
};

// Trạng thái từng buổi: Đúng giờ xanh, Đi muộn vàng, Vắng đỏ, Nghỉ phép xám
const sessionStatusColors: Record<string, BadgeProps["color"]> = {
  OnTime: "success",
  Late: "warning",
  Absent: "danger",
  OnLeave: "subtle",
  None: "subtle",
};

const adjustmentColors: Record<string, BadgeProps["color"]> = {
  Pending: "warning",
  PendingHr: "informative",
  Approved: "success",
  Rejected: "danger",
};

const returnStatusColors: Record<string, BadgeProps["color"]> = {
  PendingManager: "warning",
  PendingHr: "informative",
  Completed: "success",
  Rejected: "danger",
};

const returnSessionColors: Record<string, BadgeProps["color"]> = {
  Pending: "warning",
  AwaitingHr: "informative",
  Active: "success",
  Rejected: "danger",
};

const requestColors: Record<string, BadgeProps["color"]> = {
  Pending: "warning",
  Approved: "success",
  Confirmed: "success",
  Completed: "success",
  Rejected: "danger",
  Cancelled: "subtle",
};

export function AttendanceBadge({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={attendanceColors[status] ?? "subtle"} shape="rounded">
      {attendanceLabels[status] ?? status}
    </Badge>
  );
}

export function SessionStatusBadge({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={sessionStatusColors[status] ?? "subtle"} shape="rounded">
      {sessionStatusLabels[status] ?? status}
    </Badge>
  );
}

export function AdjustmentBadge({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={adjustmentColors[status] ?? "subtle"} shape="rounded">
      {adjustmentStatusLabels[status] ?? status}
    </Badge>
  );
}

export function ReturnStatusBadge({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={returnStatusColors[status] ?? "subtle"} shape="rounded">
      {returnStatusLabels[status] ?? status}
    </Badge>
  );
}

export function ReturnSessionBadge({ state }: { state: string }) {
  return (
    <Badge appearance="tint" color={returnSessionColors[state] ?? "subtle"} shape="rounded" size="small">
      {returnSessionStateLabels[state] ?? state}
    </Badge>
  );
}

// Hiển thị trạng thái từng buổi (sáng/chiều) kèm ghi chú HR nếu nguồn là Note.
// Chỉ vẽ khi hai buổi khác nhau; nếu giống nhau thì badge cả ngày đã đủ.
export function SessionBreakdown({
  record,
}: {
  record: {
    morningStatus?: string;
    afternoonStatus?: string;
    morningSource?: string;
    afternoonSource?: string;
    morningNote?: string;
    afternoonNote?: string;
  };
}) {
  const { morningStatus: m, afternoonStatus: a } = record;
  if (!m || !a || m === a) return null;
  const rows = [
    { label: "Sáng", status: m, source: record.morningSource, note: record.morningNote },
    { label: "Chiều", status: a, source: record.afternoonSource, note: record.afternoonNote },
  ];
  return (
    <div className="session-breakdown" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>{row.label}:</span>
          <SessionStatusBadge status={row.status} />
          {row.source === "Note" && row.note ? <small>Ghi chú HR: {row.note}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function RequestBadge({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={requestColors[status] ?? "subtle"} shape="rounded">
      {requestLabels[status] ?? status}
    </Badge>
  );
}

export function EmployeeAvatar({
  name,
  color,
  size = 36,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="employee-avatar"
      style={{ backgroundColor: color, width: size, height: size }}
      aria-label={`Ảnh đại diện ${name}`}
    >
      {getInitials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </header>
  );
}

export function SectionPanel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section-panel ${className}`}>
      {title || action ? (
        <div className="section-heading">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface MetricItem {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "brand" | "success" | "warning" | "danger";
}

export function MetricRail({ items }: { items: MetricItem[] }) {
  return (
    <section className="metric-rail" aria-label="Chỉ số tổng quan">
      {items.map((item) => (
        <div
          className={`metric-item metric-${item.tone ?? "brand"}`}
          key={item.label}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <BoxRegular aria-hidden />
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <Button appearance="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="field-error" role="alert">
      {message}
    </span>
  ) : null;
}

// Xác nhận trước các hành động khóa (nghỉ việc, đóng phòng ban/chức vụ, khóa tài khoản) —
// hành động chặn truy cập/ngừng hoạt động nên cần 1 bước xác nhận để tránh bấm nhầm. Mở
// khóa/kích hoạt lại không cần xác nhận vì không có rủi ro tương đương.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  confirming = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{description}</DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel} disabled={confirming}>
              {cancelLabel}
            </Button>
            <Button appearance="primary" onClick={onConfirm} disabled={confirming}>
              {confirming ? <Spinner size="tiny" /> : confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

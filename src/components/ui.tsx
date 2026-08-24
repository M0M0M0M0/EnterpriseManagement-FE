import { Badge, Button, type BadgeProps } from "@fluentui/react-components";
import { BoxRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";
import type { AttendanceStatus, RequestStatus } from "../types/domain";
import { attendanceLabels, getInitials, requestLabels } from "../utils/format";

const attendanceColors: Record<AttendanceStatus, BadgeProps["color"]> = {
  "on-time": "success",
  late: "warning",
  "early-leave": "warning",
  absent: "danger",
  "missing-checkout": "informative",
};

const requestColors: Record<RequestStatus, BadgeProps["color"]> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "subtle",
};

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge appearance="tint" color={attendanceColors[status]} shape="rounded">
      {attendanceLabels[status]}
    </Badge>
  );
}

export function RequestBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge appearance="tint" color={requestColors[status]} shape="rounded">
      {requestLabels[status]}
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

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Option,
  Spinner,
  Textarea,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";

// Khối báo lỗi tải dữ liệu kèm nút "Thử lại" (tương ứng ErrorView của mobile).
export function RetryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h3>Không tải được dữ liệu</h3>
      <p>{message}</p>
      <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

// Hộp nhập lý do từ chối. Lý do không bắt buộc (giống mobile): để trống thì gửi chuỗi rỗng.
export function ReasonDialog({
  open,
  title,
  subtitle,
  label = "Lý do từ chối",
  confirmLabel = "Xác nhận từ chối",
  busy = false,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  label?: string;
  confirmLabel?: string;
  busy?: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  // Mỗi lần mở lại thì xoá lý do cũ.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className="form-stack">
            {subtitle ? <p>{subtitle}</p> : null}
            <Field label={label}>
              <Textarea resize="vertical" value={reason} onChange={(_, data) => setReason(data.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} disabled={busy}>
              Huỷ
            </Button>
            <Button appearance="primary" onClick={() => onSubmit(reason.trim())} disabled={busy}>
              {busy ? <Spinner size="tiny" /> : confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// Ô lọc dạng danh sách chọn, luôn có lựa chọn "Tất cả" (value rỗng) ở đầu.
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "Tất cả",
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <Field label={label}>
      <Dropdown value={current} selectedOptions={[value]} onOptionSelect={(_, data) => onChange(data.optionValue ?? "")}>
        <Option value="">{allLabel}</Option>
        {options.map((o) => (
          <Option key={o.value} value={o.value}>
            {o.label}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

import { Badge, Button, Field, Input, Spinner } from "@fluentui/react-components";
import { ArrowDownloadRegular, ChevronLeftRegular, ChevronRightRegular, DeleteRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RetryError } from "../components/ReviewParts";
import { ConfirmDialog, EmptyState, PageHeader, SectionPanel } from "../components/ui";
import { PagedItems } from "../components/PagedItems";
import { useNotify } from "../components/useNotify";
import { useCan } from "../hooks/useCan";
import { errorMessage } from "../services/http";
import { holidayApi, timesheetApi } from "../services/overtimeApi";
import type { HolidayDto, TimesheetDto } from "../types/overtime";
import { formatDate, formatDateTime } from "../utils/format";
import { dayCountLabel, timesheetCsv } from "../utils/overtime";

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

// ---------------------------------------------------------------------------
// Bảng công tháng (route /hr/timesheet)
// ---------------------------------------------------------------------------

function previousMonth() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// team = true: trang của quản lý (route /manager/timesheet), chỉ gồm cấp dưới của mình; nút chốt/mở lại bị ẩn vì thiếu quyền timesheet.close.
export function HrTimesheetPage({ team = false }: { team?: boolean } = {}) {
  const notify = useNotify();
  // Chốt/mở lại kỳ công chỉ dành cho trưởng bộ phận nhân sự (timesheet.close); HR khác chỉ xem và xuất file.
  const canManage = useCan()("timesheet.close");
  const [period, setPeriod] = useState(previousMonth);
  const [sheet, setSheet] = useState<TimesheetDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"close" | "reopen" | null>(null);

  const now = new Date();
  const isCurrentOrFuture = period.year > now.getFullYear() || (period.year === now.getFullYear() && period.month >= now.getMonth() + 1);

  const load = useCallback(
    (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      return (team ? timesheetApi.getTeam(period.year, period.month) : timesheetApi.get(period.year, period.month))
        .then(setSheet)
        .catch((err) => {
          if (!silent) setError(errorMessage(err));
        })
        .finally(() => setLoading(false));
    },
    [period, team],
  );

  useEffect(() => {
    setSheet(null);
    void load();
  }, [load]);

  const shift = (delta: number) => {
    const d = new Date(period.year, period.month - 1 + delta, 1);
    setPeriod({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = sheet?.rows ?? [];
    return q ? all.filter((r) => r.employeeName.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q)) : all;
  }, [sheet, search]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notify({ ok: true, message: success });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setBusy(false);
      setDialog(null);
      void load(true);
    }
  };

  const exportCsv = () => {
    if (!sheet || !sheet.rows.length) {
      notify({ ok: false, message: "Không có dữ liệu để xuất." });
      return;
    }
    const blob = new Blob([timesheetCsv(sheet)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bang-cong-${sheet.year}-${String(sheet.month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Bảng công tháng"
        description="Tổng hợp công của từng nhân viên trong tháng. Chốt bảng công để khóa dữ liệu của tháng trước khi tính lương."
        action={
          <Button icon={<ArrowDownloadRegular />} onClick={exportCsv} disabled={!sheet}>
            Xuất CSV
          </Button>
        }
      />
      <SectionPanel>
        <div className="timesheet-toolbar">
          <Button appearance="subtle" icon={<ChevronLeftRegular />} aria-label="Tháng trước" onClick={() => shift(-1)} disabled={busy} />
          <strong>
            Tháng {String(period.month).padStart(2, "0")}/{period.year}
          </strong>
          <Button appearance="subtle" icon={<ChevronRightRegular />} aria-label="Tháng sau" onClick={() => shift(1)} disabled={busy} />
          {sheet ? (
            <>
              <span>Công chuẩn: {sheet.standardDays} ngày</span>
              <Badge appearance="tint" shape="rounded" color={sheet.isClosed ? "success" : "warning"}>
                {sheet.isClosed ? "Đã chốt" : "Chưa chốt"}
              </Badge>
              {sheet.isClosed ? (
                <small>
                  Chốt bởi {sheet.closedByName ?? ""} lúc {formatDateTime(sheet.closedAt)}
                </small>
              ) : null}
              {canManage ? (
                sheet.isClosed ? (
                  <Button disabled={busy} onClick={() => setDialog("reopen")}>
                    Mở lại bảng công
                  </Button>
                ) : (
                  <Button appearance="primary" disabled={busy || isCurrentOrFuture} onClick={() => setDialog("close")}>
                    {isCurrentOrFuture ? "Chỉ chốt được tháng đã kết thúc" : "Chốt bảng công"}
                  </Button>
                )
              ) : null}
            </>
          ) : null}
        </div>
      </SectionPanel>
      <div className="filter-grid">
        <Field label="Tìm kiếm">
          <Input value={search} onChange={(_, data) => setSearch(data.value)} placeholder="Tìm theo tên / mã nhân viên" />
        </Field>
      </div>
      {loading && !sheet ? (
        <Spinner label="Đang tải..." />
      ) : error && !sheet ? (
        <RetryError message={error} onRetry={() => void load()} />
      ) : rows.length ? (
        <PagedItems items={rows} resetKey={rows.length}>
{(shown) => (
<div className="enterprise-table-wrap">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ tên</th>
                <th>Phòng ban</th>
                <th>Đi làm</th>
                <th>Nghỉ phép</th>
                <th>Vắng</th>
                <th>Đi muộn (buổi)</th>
                <th>Làm thêm (giờ)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.employeeCode}>
                  <td>{r.employeeCode}</td>
                  <td>{r.employeeName}</td>
                  <td>{r.departmentName}</td>
                  <td>{dayCountLabel(r.workedDays)}</td>
                  <td>{dayCountLabel(r.leaveDays)}</td>
                  <td>{dayCountLabel(r.absentDays)}</td>
                  <td>{r.lateSessions}</td>
                  <td>{dayCountLabel(r.overtimeHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
)}
</PagedItems>
      ) : (
        <EmptyState title="Không có nhân viên" description="Không có nhân viên nào trong bảng công này." />
      )}
      <ConfirmDialog
        open={dialog === "close"}
        title="Chốt bảng công"
        description={`Sau khi chốt tháng ${period.month}/${period.year}, không ai được thêm hoặc sửa dữ liệu công của tháng này (điều chỉnh, ghi nhận, nghỉ phép, làm thêm giờ...). Bạn có thể mở lại khi cần. Chốt bảng công?`}
        confirmLabel="Chốt"
        confirming={busy}
        onConfirm={() => run(() => timesheetApi.close(period.year, period.month), "Đã chốt bảng công.")}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reopen"}
        title="Mở lại bảng công"
        description={`Mở lại tháng ${period.month}/${period.year} cho phép sửa dữ liệu công của tháng này. Mở lại?`}
        confirmLabel="Mở lại"
        confirming={busy}
        onConfirm={() => run(() => timesheetApi.reopen(period.year, period.month), "Đã mở lại bảng công.")}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ngày nghỉ lễ (route /hr/holidays)
// ---------------------------------------------------------------------------

export function HrHolidaysPage() {
  const notify = useNotify();
  const canManage = useCan()("holiday.manage");
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<HolidayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ date: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<HolidayDto | null>(null);

  const load = useCallback(
    (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      return holidayApi
        .getByYear(year)
        .then(setItems)
        .catch((err) => {
          if (!silent) setError(errorMessage(err));
        })
        .finally(() => setLoading(false));
    },
    [year],
  );

  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    try {
      await holidayApi.create(form.date, form.name.trim());
      notify({ ok: true, message: "Đã thêm ngày lễ." });
      setForm({ date: "", name: "" });
      void load(true);
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    try {
      await holidayApi.remove(removeTarget.id);
      notify({ ok: true, message: "Đã xóa ngày lễ." });
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setRemoveTarget(null);
      void load(true);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Ngày nghỉ lễ"
        description="Các ngày không phải ngày làm việc của công ty: không bị tính vắng, không tính vào ngày nghỉ phép và không xin nghỉ được."
      />
      {canManage ? (
        <SectionPanel title="Thêm ngày lễ">
          <div className="form-grid">
            <Field label="Ngày" required>
              <Input type="date" value={form.date} onChange={(_, data) => setForm((v) => ({ ...v, date: data.value }))} />
            </Field>
            <Field label="Tên ngày lễ" required>
              <Input maxLength={200} value={form.name} onChange={(_, data) => setForm((v) => ({ ...v, name: data.value }))} />
            </Field>
          </div>
          <div>
            <Button appearance="primary" disabled={saving || !form.date || !form.name.trim()} onClick={add}>
              {saving ? <Spinner size="tiny" /> : "Thêm ngày lễ"}
            </Button>
          </div>
        </SectionPanel>
      ) : null}
      <SectionPanel>
        <div className="timesheet-toolbar">
          <Button appearance="subtle" icon={<ChevronLeftRegular />} aria-label="Năm trước" onClick={() => setYear((y) => y - 1)} />
          <strong>Năm {year}</strong>
          <Button appearance="subtle" icon={<ChevronRightRegular />} aria-label="Năm sau" onClick={() => setYear((y) => y + 1)} />
        </div>
      </SectionPanel>
      {loading && !items.length ? (
        <Spinner label="Đang tải..." />
      ) : error && !items.length ? (
        <RetryError message={error} onRetry={() => void load()} />
      ) : items.length ? (
        <div className="review-list">
          {items.map((h) => {
            const date = new Date(`${h.date}T00:00:00`);
            return (
              <article key={h.id} className="review-content">
                <div>
                  <strong>{h.name}</strong>
                  <span>
                    {WEEKDAYS[date.getDay()]}, {formatDate(h.date)}
                  </span>
                </div>
                {canManage ? (
                  <div className="review-actions">
                    <Button icon={<DeleteRegular />} aria-label="Xóa" onClick={() => setRemoveTarget(h)} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Chưa có ngày lễ" description="Chưa khai báo ngày lễ nào cho năm này." />
      )}
      <ConfirmDialog
        open={!!removeTarget}
        title="Xóa ngày lễ"
        description={
          removeTarget
            ? `Xóa "${removeTarget.name}" (${formatDate(removeTarget.date)})? Ngày này sẽ trở lại là ngày làm việc bình thường.`
            : ""
        }
        confirmLabel="Xóa"
        onConfirm={remove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

import { Button, Popover, PopoverSurface, PopoverTrigger, Spinner } from "@fluentui/react-components";
import { ChevronDownRegular, ChevronLeftRegular, ChevronRightRegular, EditRegular } from "@fluentui/react-icons";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { vi } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCan } from "../hooks/useCan";
import { attendanceViewApi } from "../services/hrApi";
import { errorMessage } from "../services/http";
import type { AttendanceCalendarDayDto, SessionStatus } from "../types/attendanceHr";
import { formatTime } from "../utils/format";
import { overtimeDurationLabel } from "../utils/overtime";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const YEARS_PER_PAGE = 12;

const statusLabels: Record<string, string> = {
  OnTime: "Đúng giờ",
  Late: "Đi muộn",
  Absent: "Vắng mặt",
  OnLeave: "Nghỉ phép",
  None: "Chưa có dữ liệu",
};

// Vạch màu theo trạng thái buổi (cùng màu với app mobile).
function barClass(status: SessionStatus) {
  switch (status) {
    case "OnTime":
      return "bar-ontime";
    case "Late":
      return "bar-late";
    case "Absent":
      return "bar-absent";
    case "OnLeave":
      return "bar-leave";
    default:
      return "";
  }
}

const monthKey = (d: Date) => format(d, "yyyy-MM");
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

// Bảng chọn nhanh tháng/năm: lưới 12 tháng, bấm số năm để chọn năm rồi quay lại chọn tháng.
function MonthYearPicker({ value, onPick }: { value: Date; onPick: (month: Date) => void }) {
  const [year, setYear] = useState(value.getFullYear());
  const [pickingYear, setPickingYear] = useState(false);
  const pageStartOf = (y: number) => MIN_YEAR + Math.floor((y - MIN_YEAR) / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  const [pageStart, setPageStart] = useState(pageStartOf(value.getFullYear()));
  const now = new Date();

  const shiftPage = (pages: number) => {
    const next = pageStart + pages * YEARS_PER_PAGE;
    if (next >= MIN_YEAR && next <= MAX_YEAR) setPageStart(next);
  };

  return (
    <div className="month-picker">
      {pickingYear ? (
        <div className="month-picker-head">
          <Button appearance="subtle" icon={<ChevronLeftRegular />} disabled={pageStart <= MIN_YEAR} onClick={() => shiftPage(-1)} aria-label="Các năm trước" />
          <strong>
            {pageStart} - {Math.min(MAX_YEAR, pageStart + YEARS_PER_PAGE - 1)}
          </strong>
          <Button appearance="subtle" icon={<ChevronRightRegular />} disabled={pageStart + YEARS_PER_PAGE > MAX_YEAR} onClick={() => shiftPage(1)} aria-label="Các năm sau" />
        </div>
      ) : (
        <div className="month-picker-head">
          <Button appearance="subtle" icon={<ChevronLeftRegular />} disabled={year <= MIN_YEAR} onClick={() => setYear(year - 1)} aria-label="Năm trước" />
          <button
            type="button"
            className="month-picker-year"
            onClick={() => {
              setPageStart(pageStartOf(year));
              setPickingYear(true);
            }}
          >
            {year}
            <ChevronDownRegular />
          </button>
          <Button appearance="subtle" icon={<ChevronRightRegular />} disabled={year >= MAX_YEAR} onClick={() => setYear(year + 1)} aria-label="Năm sau" />
        </div>
      )}

      <div className="month-picker-grid">
        {pickingYear
          ? Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i)
              .filter((y) => y <= MAX_YEAR)
              .map((y) => (
                <button
                  type="button"
                  key={y}
                  className={`${y === year ? "is-selected" : ""}${y === now.getFullYear() ? " is-current" : ""}`}
                  onClick={() => {
                    setYear(y);
                    setPickingYear(false);
                  }}
                >
                  {y}
                </button>
              ))
          : Array.from({ length: 12 }, (_, m) => m).map((m) => (
              <button
                type="button"
                key={m}
                className={`${year === value.getFullYear() && m === value.getMonth() ? "is-selected" : ""}${
                  year === now.getFullYear() && m === now.getMonth() ? " is-current" : ""
                }`}
                onClick={() => onPick(new Date(year, m, 1))}
              >
                Tháng {m + 1}
              </button>
            ))}
      </div>
    </div>
  );
}

function SessionLine({ label, status, source, day, note }: {
  label: string;
  status: SessionStatus;
  source: AttendanceCalendarDayDto["morningSource"];
  day: AttendanceCalendarDayDto;
  note?: string;
}) {
  return (
    <div className="day-detail-row">
      <i className={`day-dot ${barClass(status)}`} />
      <div>
        <strong>{label}:</strong> {statusLabels[status] ?? status}
        {status === "OnLeave" && day.leaveTypeName ? ` (${day.leaveTypeName})` : ""}
        {source === "Note" && note ? <small>Ghi chú của HR: {note}</small> : null}
        {source === "ReturnConfirmed" ? <small>Đã được HR xác nhận (rút ngắn phép)</small> : null}
      </div>
    </div>
  );
}

// Lịch chấm công theo tháng: tuần bắt đầu thứ Hai, mỗi ngày hai vạch (sáng/chiều), bấm ngày để xem chi tiết.
export function AttendanceMonthCalendar({
  employeeCode,
  onRequestAdjustment,
}: {
  employeeCode: string;
  onRequestAdjustment?: (date: Date) => void;
}) {
  const [focusedMonth, setFocusedMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [cache, setCache] = useState<Record<string, Record<string, AttendanceCalendarDayDto>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const can = useCan();

  const loadMonth = useCallback(
    (month: Date, force = false) => {
      const key = monthKey(month);
      // Tháng đã có cache thì hiện ngay và tải lại nền (không Spinner).
      const cached = Boolean(cache[key]) && !force;
      if (!cached) {
        setLoading(true);
        setError("");
      }
      attendanceViewApi
        .getCalendar(employeeCode, dayKey(startOfMonth(month)), dayKey(endOfMonth(month)))
        .then((days) =>
          setCache((prev) => ({ ...prev, [key]: Object.fromEntries(days.map((d) => [d.date.slice(0, 10), d])) })),
        )
        .catch((err) => {
          if (!cached) setError(errorMessage(err, "Không tải được lịch chấm công."));
        })
        .finally(() => {
          if (!cached) setLoading(false);
        });
    },
    [employeeCode, cache],
  );

  useEffect(() => {
    loadMonth(focusedMonth);
  }, [focusedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải lại im lặng tháng đang xem (không Spinner, giữ ngày đang chọn).
  useAutoRefresh(
    () =>
      attendanceViewApi
        .getCalendar(employeeCode, dayKey(startOfMonth(focusedMonth)), dayKey(endOfMonth(focusedMonth)))
        .then((days) =>
          setCache((prev) => ({
            ...prev,
            [monthKey(focusedMonth)]: Object.fromEntries(days.map((d) => [d.date.slice(0, 10), d])),
          })),
        )
        .catch(() => undefined),
    { types: ["AttendanceChanged", "AdjustmentApplied", "AdjustmentManagerApproved", "AdjustmentRejected", "AttendanceNoteCreated", "LeaveApproved", "ReturnApproved"] },
  );

  const cells = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(focusedMonth), end: endOfMonth(focusedMonth) });
    // Tuần bắt đầu thứ Hai: getDay() 0 = Chủ nhật nên đổi sang (getDay + 6) % 7.
    const leading = (startOfMonth(focusedMonth).getDay() + 6) % 7;
    return [...Array<null>(leading).fill(null), ...days];
  }, [focusedMonth]);

  const dayData = (d: Date) => cache[monthKey(d)]?.[dayKey(d)];
  const selectedData = dayData(selected);
  const todayKey = dayKey(new Date());

  const pickMonth = (month: Date) => {
    setPickerOpen(false);
    setFocusedMonth(month);
    // Giữ ngày đang chọn nếu còn trong tháng mới, không thì cắt về ngày cuối tháng.
    const lastDay = endOfMonth(month).getDate();
    setSelected(new Date(month.getFullYear(), month.getMonth(), Math.min(selected.getDate(), lastDay)));
  };

  const changeMonth = (offset: number) => {
    const next = offset < 0 ? subMonths(focusedMonth, -offset) : addMonths(focusedMonth, offset);
    setFocusedMonth(next);
    setSelected(new Date(next.getFullYear(), next.getMonth(), Math.min(selected.getDate(), endOfMonth(next).getDate())));
  };

  const selectedIsWeekend = [0, 6].includes(selected.getDay());
  const selectedIsHoliday = !selectedIsWeekend && !!dayData(selected)?.isHoliday;
  // Chỉ cho yêu cầu chỉnh sửa với ngày làm việc không ở tương lai (so theo ngày).
  // Nút chỉ hiện với tài khoản có quyền attendance.adjustment.self (như PermissionGate bên mobile).
  const canRequest =
    !!onRequestAdjustment && !selectedIsWeekend && !selectedIsHoliday && dayKey(selected) <= todayKey && can("attendance.adjustment.self");

  // Nhảy tới một ngày bất kỳ (tương đương nút chọn ngày ở đầu màn Lịch bên mobile).
  const jumpToDate = (value: string) => {
    if (!value) return;
    const [y, m, d] = value.split("-").map(Number);
    setSelected(new Date(y, m - 1, d));
    setFocusedMonth(new Date(y, m - 1, 1));
  };

  return (
    <div className="month-attendance">
      <div className="month-attendance-header">
        <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={() => changeMonth(-1)} aria-label="Tháng trước" />
        <Popover open={pickerOpen} onOpenChange={(_, data) => setPickerOpen(data.open)} positioning="below">
          <PopoverTrigger disableButtonEnhancement>
            <button type="button" className="month-title">
              {format(focusedMonth, "'Tháng' M, yyyy", { locale: vi })}
              <ChevronDownRegular />
            </button>
          </PopoverTrigger>
          <PopoverSurface>
            {/* key để mỗi lần mở lại bảng, nó bắt đầu từ tháng đang xem */}
            <MonthYearPicker key={pickerOpen ? "open" : "closed"} value={focusedMonth} onPick={pickMonth} />
          </PopoverSurface>
        </Popover>
        <Button appearance="subtle" icon={<ChevronRightRegular />} onClick={() => changeMonth(1)} aria-label="Tháng sau" />
        <input
          type="date"
          className="month-jump"
          aria-label="Chọn ngày"
          title="Chọn ngày"
          min="2000-01-01"
          max="2100-12-31"
          value={dayKey(selected)}
          onChange={(event) => jumpToDate(event.target.value)}
        />
      </div>

      <div className="month-attendance-legend">
        <span><i className="bar-ontime" />Đúng giờ</span>
        <span><i className="bar-late" />Đi muộn</span>
        <span><i className="bar-absent" />Vắng</span>
        <span><i className="bar-leave" />Nghỉ phép</span>
      </div>

      <div className="month-attendance-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className={`weekday${w === "CN" ? " is-sunday" : ""}`}>
            {w}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} />;
          const key = dayKey(day);
          const data = dayData(day);
          const weekend = [0, 6].includes(day.getDay()) || !!data?.isHoliday;
          const merged = data && data.morning === data.afternoon;
          return (
            <button
              type="button"
              key={key}
              className={`day-cell${weekend ? " is-weekend" : ""}${key === todayKey ? " is-today" : ""}${
                key === dayKey(selected) ? " is-selected" : ""
              }`}
              onClick={() => setSelected(day)}
            >
              <span>{day.getDate()}</span>
              <div className="day-bars">
                {!data || weekend ? null : merged ? (
                  <i className={`wide ${barClass(data.morning)}`} />
                ) : (
                  <>
                    <i className={barClass(data.morning)} />
                    <i className={barClass(data.afternoon)} />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="day-detail">
        <h3>
          {format(selected, "dd/MM/yyyy")} ({format(selected, "EEEE", { locale: vi })})
        </h3>
        {error ? (
          <div className="day-detail-row">
            <span>{error}</span>
            <Button size="small" onClick={() => loadMonth(focusedMonth, true)}>Thử lại</Button>
          </div>
        ) : loading && !selectedData ? (
          <Spinner size="tiny" label="Đang tải..." />
        ) : selectedIsWeekend || selectedIsHoliday ? (
          <>
            <div className="day-detail-row">
              <i className="day-dot bar-leave" />
              <div>{selectedIsHoliday ? `NGÀY LỄ: ${selectedData?.holidayName ?? ""}` : "NGÀY NGHỈ (cuối tuần)"}</div>
            </div>
            {selectedData?.overtimeMinutes ? <div className="day-detail-times">Làm thêm giờ: <strong>{overtimeDurationLabel(selectedData.overtimeMinutes)}</strong> (đã duyệt)</div> : null}
          </>
        ) : !selectedData ? (
          <div className="day-detail-row">
            <i className="day-dot" />
            <div>Chưa có dữ liệu chấm công</div>
          </div>
        ) : (
          <>
            <SessionLine label="Buổi sáng" status={selectedData.morning} source={selectedData.morningSource} day={selectedData} note={selectedData.morningNote} />
            <SessionLine label="Buổi chiều" status={selectedData.afternoon} source={selectedData.afternoonSource} day={selectedData} note={selectedData.afternoonNote} />
            {selectedData.checkInTime ? <div className="day-detail-times">Vào: <strong>{formatTime(selectedData.checkInTime)}</strong></div> : null}
            {selectedData.checkOutTime ? <div className="day-detail-times">Ra: <strong>{formatTime(selectedData.checkOutTime)}</strong></div> : null}
            {selectedData.overtimeMinutes ? <div className="day-detail-times">Làm thêm giờ: <strong>{overtimeDurationLabel(selectedData.overtimeMinutes)}</strong> (đã duyệt)</div> : null}
          </>
        )}
        {canRequest ? (
          <Button appearance="outline" size="small" icon={<EditRegular />} onClick={() => onRequestAdjustment?.(selected)}>
            Yêu cầu chỉnh sửa
          </Button>
        ) : null}
      </div>
    </div>
  );
}

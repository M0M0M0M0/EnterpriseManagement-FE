import { Button } from "@fluentui/react-components";
import { CheckmarkCircleRegular, ClockRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { attendanceViewApi } from "../services/hrApi";
import { LOCAL_ATTENDANCE_CHANGED } from "../store/useLiveUpdates";
import type { AttendanceCalendarDayDto } from "../types/attendanceHr";
import { formatTime, isoDate } from "../utils/format";

// Dải trạng thái chấm công hôm nay của chính người dùng, đặt ở trang tổng quan của quản lý.
// Nút chấm công chỉ nằm ở "Tổng quan của tôi", không lặp lại ở đây: dải này chỉ báo trạng thái và dẫn sang đó.
export function MyTodayStrip({ employeeCode }: { employeeCode: string }) {
  const navigate = useNavigate();
  const [day, setDay] = useState<AttendanceCalendarDayDto | null>(null);

  const load = useCallback(() => {
    const today = isoDate();
    return attendanceViewApi
      .getCalendar(employeeCode, today, today)
      .then((days) => setDay(days[0] ?? null))
      .catch(() => undefined);
  }, [employeeCode]);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(load, { types: [LOCAL_ATTENDANCE_CHANGED] });

  const checkedIn = Boolean(day?.checkInTime);
  const text = !checkedIn
    ? "Hôm nay bạn chưa chấm công."
    : day?.checkOutTime
      ? `Hôm nay bạn vào ${formatTime(day.checkInTime)}, ra ${formatTime(day.checkOutTime)}.`
      : `Hôm nay bạn vào lúc ${formatTime(day?.checkInTime)}.`;

  return (
    <div className="my-today-strip" role="status">
      {checkedIn ? <CheckmarkCircleRegular className="ok" /> : <ClockRegular className="warn" />}
      <span>{text}</span>
      <Button size="small" appearance={checkedIn ? "subtle" : "primary"} onClick={() => navigate("/employee/dashboard")}>
        {checkedIn ? "Tổng quan của tôi" : "Chấm công"}
      </Button>
    </div>
  );
}

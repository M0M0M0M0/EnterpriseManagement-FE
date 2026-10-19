import { Spinner } from "@fluentui/react-components";
import { FingerprintRegular, LockClosedRegular, LocationRegular, SignOutRegular } from "@fluentui/react-icons";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useCallback, useEffect, useRef, useState } from "react";
import { emitLocal, LOCAL_ATTENDANCE_CHANGED } from "../store/useLiveUpdates";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { attendanceApi } from "../services/api";
import { attendanceViewApi } from "../services/hrApi";
import { errorMessage } from "../services/http";
import type { AttendanceCalendarDayDto } from "../types/attendanceHr";
import type { OfficeLocationDto } from "../types/domain";
import { formatTime, isoDate } from "../utils/format";
import { isPunchLocked } from "../utils/punchLock";
import { CameraCaptureDialog } from "./CameraCaptureDialog";
import { useNotify } from "./useNotify";

const GOAL_HOURS = 8;

// Số giờ đã làm hôm nay: đang làm thì tính tới bây giờ, đã ra thì tới giờ ra; trừ giờ nghỉ trưa 12:00-13:00.
function workedHours(day: AttendanceCalendarDayDto | null, now: Date) {
  if (!day?.checkInTime) return 0;
  const start = new Date(day.checkInTime);
  const end = day.checkOutTime ? new Date(day.checkOutTime) : now;
  if (end <= start) return 0;

  let minutes = (end.getTime() - start.getTime()) / 60000;
  const lunchStart = new Date(start);
  lunchStart.setHours(12, 0, 0, 0);
  const lunchEnd = new Date(start);
  lunchEnd.setHours(13, 0, 0, 0);
  const overlapStart = Math.max(start.getTime(), lunchStart.getTime());
  const overlapEnd = Math.min(end.getTime(), lunchEnd.getTime());
  if (overlapEnd > overlapStart) minutes -= (overlapEnd - overlapStart) / 60000;
  return Math.max(0, minutes) / 60;
}

// Khoảng cách (mét) giữa hai toạ độ theo công thức haversine, dùng để báo ngoài bán kính trước khi gửi.
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Lấy vị trí hiện tại; lỗi quyền/GPS đổi sang câu tiếng Việt dễ hiểu.
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt này không hỗ trợ định vị."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? "Bạn chưa cấp quyền vị trí cho trang web. Hãy bật quyền vị trí trong cài đặt trình duyệt rồi thử lại."
            : err.code === err.TIMEOUT
              ? "Không lấy được vị trí kịp lúc. Hãy bật GPS/định vị và thử lại."
              : "Không xác định được vị trí hiện tại. Hãy bật GPS/định vị và thử lại.",
        ),
      );
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function formatDuration(hours: number) {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}g ${String(total % 60).padStart(2, "0")}p`;
}

function statusOf(day: AttendanceCalendarDayDto | null) {
  if (day?.isWeekend) return { label: "Ngày nghỉ cuối tuần", tone: "muted" };
  if (!day?.checkInTime) {
    if (day && day.morning === "OnLeave" && day.afternoon === "OnLeave") return { label: "Nghỉ phép", tone: "leave" };
    return { label: "Chưa chấm công", tone: "muted" };
  }
  if (day.checkOutTime) return { label: "Đã chấm công ra", tone: "done" };
  return day.morning === "Late"
    ? { label: "Đang làm việc · đi muộn", tone: "late" }
    : { label: "Đang làm việc", tone: "working" };
}

// Thẻ chấm công đầu trang Tổng quan: trạng thái hôm nay, đồng hồ, tiến độ 8 giờ và nút chấm công vào/ra.
export function PunchHero({ employeeCode, onPunched }: { employeeCode: string; onPunched?: () => void }) {
  const notify = useNotify();
  const [day, setDay] = useState<AttendanceCalendarDayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [office, setOffice] = useState<OfficeLocationDto | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Hàm trả kết quả của hộp chụp ảnh đang mở (ảnh hoặc null khi huỷ).
  const cameraResolver = useRef<((photo: Blob | null) => void) | null>(null);

  const load = useCallback(() => {
    const today = isoDate();
    attendanceViewApi
      .getCalendar(employeeCode, today, today)
      .then((days) => setDay(days[0] ?? null))
      .catch((err) => notify({ ok: false, message: errorMessage(err) }))
      .finally(() => setLoading(false));
  }, [employeeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);

  // Vị trí công ty để hiện nơi được phép chấm công (lỗi thì bỏ qua, như mobile).
  useEffect(() => {
    attendanceApi.getOfficeLocation().then(setOffice).catch(() => undefined);
  }, []);

  // Tải lại im lặng trạng thái hôm nay (vd. HR sửa công).
  useAutoRefresh(
    () => {
      const today = isoDate();
      return attendanceViewApi
        .getCalendar(employeeCode, today, today)
        .then((days) => setDay(days[0] ?? null))
        .catch(() => undefined);
    },
    { types: ["AttendanceChanged", "AdjustmentApplied", "AdjustmentManagerApproved", "AdjustmentRejected", "AttendanceNoteCreated", "LeaveApproved", "ReturnApproved"] },
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Lần chấm công đầu tiên trong ngày là vào ca; các lần sau là ra ca (đè giờ ra cũ), khớp PunchAsync ở backend.
  const clockedIn = Boolean(day?.checkInTime);
  // Quá 18:00 thì khoá chấm công; đồng hồ đã chạy từng giây nên nút tự khoá đúng giờ.
  const locked = isPunchLocked(now);

  const askPhoto = () =>
    new Promise<Blob | null>((resolve) => {
      cameraResolver.current = resolve;
      setCameraOpen(true);
    });

  const closeCamera = (photo: Blob | null) => {
    setCameraOpen(false);
    cameraResolver.current?.(photo);
    cameraResolver.current = null;
  };

  // Các bước như mobile: lấy vị trí, báo ngoài bán kính ngay, chỉ chấm công vào mới chụp ảnh, rồi gửi backend.
  const punch = async () => {
    const wasClockedIn = clockedIn;
    setPunching(true);
    try {
      const position = await getPosition();
      const target = office ?? (await attendanceApi.getOfficeLocation());
      if (!office) setOffice(target);
      const distance = distanceMeters(position.coords.latitude, position.coords.longitude, target.latitude, target.longitude);
      if (distance > target.allowedRadiusMeters) {
        throw new Error(
          `Bạn đang cách ${target.name} khoảng ${Math.round(distance)} m, vượt quá bán kính cho phép ${Math.round(target.allowedRadiusMeters)} m.`,
        );
      }

      let photo: Blob | undefined;
      if (!wasClockedIn) {
        const taken = await askPhoto();
        if (!taken) throw new Error("Bạn chưa chụp ảnh nên chưa thể chấm công vào.");
        photo = taken;
      }

      await attendanceApi.punchWithEvidence(position.coords.latitude, position.coords.longitude, photo);
      notify({ ok: true, message: wasClockedIn ? "Chấm công ra thành công!" : "Chấm công vào thành công!" });
      load();
      emitLocal(LOCAL_ATTENDANCE_CHANGED);
      onPunched?.();
    } catch (err) {
      notify({ ok: false, message: errorMessage(err) });
    } finally {
      setPunching(false);
    }
  };

  const worked = workedHours(day, now);
  const status = statusOf(day);
  const progress = Math.min(1, worked / GOAL_HOURS);
  const ringLength = 2 * Math.PI * 34;

  return (
    <section className="punch-hero">
      <div className="punch-card">
        <span className={`punch-status is-${status.tone}`}>
          <i />
          {status.label}
        </span>

        <div className="punch-clock-row">
          <div>
            <div className="punch-clock">{format(now, "HH:mm")}</div>
            <div className="punch-date">{capitalize(format(now, "EEEE, dd 'tháng' M, yyyy", { locale: vi }))}</div>
          </div>
          <div className="punch-ring" aria-label={`Đã làm ${formatDuration(worked)} trên mục tiêu ${GOAL_HOURS} giờ`}>
            <svg viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" className="ring-track" />
              <circle
                cx="40"
                cy="40"
                r="34"
                className="ring-value"
                strokeDasharray={ringLength}
                strokeDashoffset={ringLength * (1 - progress)}
              />
            </svg>
            <div>
              <small>Mục tiêu</small>
              <strong>{GOAL_HOURS}g</strong>
            </div>
          </div>
        </div>

        <div className="punch-stats">
          <div>
            <span>Giờ vào</span>
            <strong>{formatTime(day?.checkInTime)}</strong>
          </div>
          <div>
            <span>Giờ ra</span>
            <strong>{formatTime(day?.checkOutTime)}</strong>
          </div>
          <div>
            <span>Giờ làm</span>
            <strong>{formatDuration(worked)}</strong>
          </div>
        </div>
      </div>

      <div className="punch-action">
        <div className="punch-button-wrap">
          {locked ? null : <span className="punch-pulse" />}
          {locked ? null : <span className="punch-pulse delay" />}
          <button
            type="button"
            className={`punch-button${locked ? " is-locked" : ""}`}
            disabled={punching || loading || locked}
            onClick={punch}
          >
            {punching || loading ? (
              <Spinner size="small" />
            ) : locked ? (
              <>
                <LockClosedRegular />
                <span>Đã khoá</span>
              </>
            ) : (
              <>
                {clockedIn ? <SignOutRegular /> : <FingerprintRegular />}
                <span>{clockedIn ? "Chấm công ra" : "Chấm công vào"}</span>
              </>
            )}
          </button>
        </div>
        <p>
          {locked
            ? "Đã quá 18:00 nên chấm công bị khoá. Nếu quên chấm công, hãy gửi yêu cầu điều chỉnh chấm công."
            : clockedIn
              ? "Bấm lại để cập nhật giờ ra."
              : "Bấm để vào ca làm việc hôm nay."}
        </p>
        {office ? (
          <p className="punch-office">
            <LocationRegular /> {office.name} · bán kính {Math.round(office.allowedRadiusMeters)} m
          </p>
        ) : null}
      </div>
      <CameraCaptureDialog open={cameraOpen} onCapture={closeCamera} onCancel={() => closeCamera(null)} />
    </section>
  );
}

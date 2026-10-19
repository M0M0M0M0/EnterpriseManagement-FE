import {
  AlertRegular,
  ClockAlarmRegular,
  ArrowReplyRegular,
  CheckmarkCircleRegular,
  ClockRegular,
  DismissCircleRegular,
  DocumentEditRegular,
  HourglassRegular,
  ClipboardTaskListLtrRegular,
  AirplaneRegular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMenuStore } from "../store/useMenuStore";
import type { NotificationDto } from "../types/domain";

// Màu theo loại thông báo (cùng bảng màu với mobile).
const BLUE = "#5a3fd8";
const GREEN = "#2e7d32";
const RED = "#c62828";
const ORANGE = "#e69d35";
const PURPLE = "#7e57c2";

// Icon + màu theo loại thông báo, khớp _styleOf bên mobile.
export function notificationStyle(type: string): { icon: ReactNode; color: string } {
  switch (type) {
    case "LeaveCancelSubmitted":
      return { icon: <AirplaneRegular />, color: ORANGE };
    case "LeaveCancelApproved":
      return { icon: <CheckmarkCircleRegular />, color: GREEN };
    case "LeaveCancelRejected":
      return { icon: <DismissCircleRegular />, color: RED };
    case "OvertimeSubmitted":
      return { icon: <ClockRegular />, color: BLUE };
    case "OvertimeApproved":
      return { icon: <CheckmarkCircleRegular />, color: GREEN };
    case "OvertimeRejected":
      return { icon: <DismissCircleRegular />, color: RED };
    case "LeaveSubmitted":
      return { icon: <AirplaneRegular />, color: BLUE };
    case "LeaveApproved":
    case "ReturnApproved":
      return { icon: <CheckmarkCircleRegular />, color: GREEN };
    case "LeaveRejected":
    case "ReturnRejected":
    case "AdjustmentRejected":
      return { icon: <DismissCircleRegular />, color: RED };
    case "ReturnSubmitted":
      return { icon: <ArrowReplyRegular />, color: PURPLE };
    case "ReturnAwaitingProcessing":
    case "AdjustmentAwaitingProcessing":
      return { icon: <HourglassRegular />, color: ORANGE };
    case "ReturnProcessed":
    case "AdjustmentApplied":
      return { icon: <ClipboardTaskListLtrRegular />, color: GREEN };
    case "AdjustmentSubmitted":
      return { icon: <DocumentEditRegular />, color: BLUE };
    case "AdjustmentManagerApproved":
      return { icon: <CheckmarkCircleRegular />, color: PURPLE };
    case "AttendanceNoteCreated":
      return { icon: <ClockRegular />, color: "#00897b" };
    case "CheckInReminder":
    case "CheckOutReminder":
      return { icon: <ClockAlarmRegular />, color: ORANGE };
    default:
      return { icon: <AlertRegular />, color: BLUE };
  }
}

// Mở thông báo: chỉ chuyển trang khi menu của tài khoản có route đó (như mobile). Menu chưa tải được thì vẫn cho đi.
export function useOpenNotificationRoute() {
  const navigate = useNavigate();
  const menus = useMenuStore((state) => state.menus);
  const status = useMenuStore((state) => state.status);
  return (item: NotificationDto) => {
    const route = item.route;
    if (!route) return;
    // Route có thể kèm ?tab=... để mở đúng tab; menu khớp theo phần đường dẫn.
    const path = route.split("?")[0];
    if (status === "loaded" && !(menus ?? []).some((menu) => menu.route === path)) return;
    navigate(route);
  };
}

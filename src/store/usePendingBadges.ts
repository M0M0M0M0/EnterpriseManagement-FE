import { useCallback, useEffect, useRef, useState } from "react";
import { attendanceApi, leaveRequestApi } from "../services/api";
import { adjustmentProcessingApi, leaveReturnApi } from "../services/hrApi";
import { leaveCancelApi } from "../services/leaveCancelApi";
import { overtimeApi } from "../services/overtimeApi";
import { subscribeAll } from "./useLiveUpdates";

const count = (fetch: () => Promise<unknown[]>) =>
  fetch().then(
    (items) => items.length,
    // Không có quyền hoặc lỗi mạng thoáng qua: coi như không có việc chờ.
    () => 0,
  );

// Số việc đang chờ xử lý của từng mục menu (khóa là route), hiện thành số đỏ ở thanh bên.
// Chỉ đếm mục mà tài khoản được cấp; tự đếm lại khi có thông báo mới và khi đổi trang.
export function usePendingBadges(routes: string[], refreshKey: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const requestId = useRef(0);

  const refresh = useCallback(() => {
    const has = (route: string) => routesRef.current.includes(route);
    const id = ++requestId.current;
    const jobs: Promise<[string, number]>[] = [];
    if (has("/manager/leave")) {
      // Duyệt đơn từ gồm: nghỉ phép, rút ngắn phép, hủy phép, làm thêm giờ.
      jobs.push(
        Promise.all([
          count(leaveRequestApi.getPending),
          count(leaveReturnApi.getPending),
          count(leaveCancelApi.getPending),
          count(overtimeApi.getPending),
        ]).then((c) => ["/manager/leave", c.reduce((a, b) => a + b, 0)] as [string, number]),
      );
    }
    if (has("/manager/attendance")) {
      jobs.push(count(attendanceApi.getPendingAdjustments).then((c) => ["/manager/attendance", c] as [string, number]));
    }
    if (has("/hr/adjustments")) {
      jobs.push(count(adjustmentProcessingApi.getPending).then((c) => ["/hr/adjustments", c] as [string, number]));
    }
    if (has("/hr/leave-returns")) {
      jobs.push(count(leaveReturnApi.getAwaitingProcessing).then((c) => ["/hr/leave-returns", c] as [string, number]));
    }
    void Promise.all(jobs).then((pairs) => {
      if (id !== requestId.current) return; // đã có lần đếm mới hơn
      const next = Object.fromEntries(pairs);
      setCounts((current) => {
        const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
        return [...keys].every((k) => (current[k] ?? 0) === (next[k] ?? 0)) ? current : next;
      });
    });
  }, []);

  // Đếm lại khi tập mục menu đổi hoặc người dùng chuyển trang (vừa duyệt xong rồi quay lại).
  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // Có thông báo mới (đơn mới gửi, vừa được xử lý...) thì đếm lại.
  useEffect(() => subscribeAll(() => refresh()), [refresh]);

  return counts;
}

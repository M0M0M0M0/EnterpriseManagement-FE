// Tan làm 17:00; từ 18:00 trở đi khoá chấm công (vào và ra), khớp quy tắc ở backend (EffectiveDayCalculator.PunchLockFrom).
// Chỉ để tắt nút cho người dùng khỏi bấm vô ích; backend vẫn là nơi chặn thật.
export const PUNCH_LOCK_HOUR = 18;

export function isPunchLocked(now: Date): boolean {
  return now.getHours() >= PUNCH_LOCK_HOUR;
}

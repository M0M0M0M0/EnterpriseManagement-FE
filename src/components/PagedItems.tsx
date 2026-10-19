import { Button } from "@fluentui/react-components";
import { useEffect, useState, type ReactNode } from "react";

// Hiển thị danh sách dài theo từng đợt: cho children đúng [step] phần tử đầu, kèm thanh "Đã hiển thị X / Y" và nút "Tải thêm".
// [resetKey] đổi (vd bộ lọc, từ khoá tìm kiếm) thì quay về đợt đầu. Dùng được cho cả bảng lẫn danh sách thẻ.
export function PagedItems<T>({
  items,
  step = 30,
  resetKey,
  children,
}: {
  items: T[];
  step?: number;
  resetKey?: unknown;
  children: (visible: T[]) => ReactNode;
}) {
  const [count, setCount] = useState(step);

  useEffect(() => {
    setCount(step);
  }, [resetKey, step]);

  const visible = items.slice(0, count);
  return (
    <>
      {children(visible)}
      {items.length > step ? (
        <div className="paged-bar">
          <span>
            Đã hiển thị {visible.length} / {items.length}
          </span>
          {visible.length < items.length ? (
            <Button onClick={() => setCount((c) => c + step)}>Tải thêm</Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

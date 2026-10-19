import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ui";

interface Content {
  title: string;
  description: ReactNode;
  confirmLabel: string;
}

// Hộp xác nhận dùng bằng await: `if (!(await confirm({ title, description }))) return;` rồi mới thực hiện thao tác.
// Render `dialog` ở đâu đó trong component (nó là portal nên vị trí không quan trọng).
export function useConfirm() {
  // Nội dung được giữ lại sau khi đóng để hộp không bị trắng chữ trong lúc chạy hiệu ứng đóng.
  const [content, setContent] = useState<Content>({ title: "", description: "", confirmLabel: "Xác nhận" });
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    ({ title, description, confirmLabel = "Xác nhận" }: { title: string; description: ReactNode; confirmLabel?: string }) =>
      new Promise<boolean>((resolve) => {
        // Hộp trước còn mở (hiếm) thì coi như đã hủy.
        resolver.current?.(false);
        resolver.current = resolve;
        setContent({ title, description, confirmLabel });
        setOpen(true);
      }),
    [],
  );

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  };

  const dialog = (
    <ConfirmDialog
      open={open}
      title={content.title}
      description={content.description}
      confirmLabel={content.confirmLabel}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}

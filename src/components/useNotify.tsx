import {
  Toast,
  ToastTitle,
  useToastController,
} from "@fluentui/react-components";
import type { ActionResult } from "../types/domain";

export function useNotify() {
  const { dispatchToast } = useToastController("app-toaster");

  return (result: ActionResult) =>
    dispatchToast(
      <Toast>
        <ToastTitle>{result.message}</ToastTitle>
      </Toast>,
      { intent: result.ok ? "success" : "error", timeout: 3500 },
    );
}

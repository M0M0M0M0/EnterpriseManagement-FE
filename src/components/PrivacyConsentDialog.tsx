import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { errorMessage } from "../services/http";
import { privacyApi, type PrivacyPolicyDto } from "../services/privacyApi";

// Hộp đồng ý thu thập vị trí GPS và ảnh khi chấm công. Hiện trước lần chấm công đầu tiên (và khi chính sách đổi phiên bản).
export function PrivacyConsentDialog({
  open,
  busy,
  onAgree,
  onDecline,
}: {
  open: boolean;
  busy?: boolean;
  onAgree: () => void;
  onDecline: () => void;
}) {
  const [policy, setPolicy] = useState<PrivacyPolicyDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || policy) return;
    privacyApi
      .getPolicy()
      .then(setPolicy)
      .catch((err) => setError(errorMessage(err)));
  }, [open, policy]);

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onDecline()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Đồng ý thu thập vị trí và ảnh chấm công</DialogTitle>
          <DialogContent>
            {error ? <p role="alert">{error}</p> : null}
            {!policy && !error ? <Spinner label="Đang tải..." /> : null}
            {policy?.sections.map((section) => (
              <div key={section.heading} className="privacy-text">
                <strong>{section.heading}</strong>
                <p>{section.body}</p>
              </div>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={onDecline} disabled={busy}>
              Không đồng ý
            </Button>
            <Button appearance="primary" onClick={onAgree} disabled={busy || !policy}>
              {busy ? <Spinner size="tiny" /> : "Tôi đồng ý"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

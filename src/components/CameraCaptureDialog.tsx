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
import { CameraRegular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";

// Hộp chụp ảnh khuôn mặt khi chấm công vào/ra (mobile mở camera trước). Chụp xong trả về ảnh JPEG; đóng hộp thì trả null.
export function CameraCaptureDialog({
  open,
  onCapture,
  onCancel,
}: {
  open: boolean;
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    setReady(false);
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt này không hỗ trợ chụp ảnh bằng camera.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        // Dialog vẽ trễ một nhịp nên video có thể chưa gắn vào DOM.
        const attach = () => {
          if (videoRef.current) {
            videoRef.current.srcObject = media;
            void videoRef.current.play().catch(() => undefined);
            setReady(true);
          } else if (!cancelled) {
            window.setTimeout(attach, 50);
          }
        };
        attach();
      })
      .catch(() =>
        setError("Không mở được camera. Hãy cấp quyền camera cho trang web trong cài đặt trình duyệt rồi thử lại."),
      );
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
        else setError("Không chụp được ảnh. Vui lòng thử lại.");
      },
      "image/jpeg",
      0.85,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Chụp ảnh chấm công</DialogTitle>
          <DialogContent>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : (
              <div className="camera-box">
                <video ref={videoRef} muted playsInline />
                {ready ? null : <Spinner className="camera-spinner" size="small" label="Đang mở camera..." />}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel}>Huỷ</Button>
            <Button appearance="primary" icon={<CameraRegular />} disabled={!ready || Boolean(error)} onClick={capture}>
              Chụp ảnh
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useNotificationStore, type SystemNotification } from "@/store/notificationStore";
import { cn } from "@/utils/cn";

export function SystemNotifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[90] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismiss(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationToast({ notification, onDismiss }: { notification: SystemNotification; onDismiss: () => void }) {
  const Icon = getNotificationIcon(notification.kind);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/18 bg-[#111936]/98 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.46)] backdrop-blur-md transition-[transform,opacity] duration-300 ease-out",
        notification.isClosing
          ? "translate-x-[120%] opacity-0"
          : "translate-x-0 opacity-100 animate-[toast-slide-in_300ms_ease-out]",
        getNotificationStyle(notification.kind),
      )}
      role="alert"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.08]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">{notification.title}</p>
        {notification.message ? (
          <p className="mt-0.5 whitespace-pre-line text-xs font-semibold leading-5 text-[#E2E8F0]">
            {notification.message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#94A3B8] transition-colors hover:bg-white/[0.08] hover:text-white"
        aria-label="Fechar alerta"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function getNotificationIcon(kind: SystemNotification["kind"]) {
  switch (kind) {
    case "success":
      return CheckCircle2;
    case "error":
      return XCircle;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
  }
}

function getNotificationStyle(kind: SystemNotification["kind"]) {
  switch (kind) {
    case "success":
      return "text-[#BBF7D0]";
    case "error":
      return "text-[#FBCFE8]";
    case "warning":
      return "text-[#FEF3C7]";
    case "info":
      return "text-[#CFFAFE]";
  }
}

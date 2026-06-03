import { create } from "zustand";

type NotificationKind = "info" | "warning" | "error" | "success";

export interface SystemNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  isClosing?: boolean;
}

interface NotificationStore {
  notifications: SystemNotification[];
  notify: (notification: Omit<SystemNotification, "id">) => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  notify: (notification) => {
    const id = crypto.randomUUID();

    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }].slice(-4),
    }));

    window.setTimeout(() => closeNotification(set, id), 6000);
  },
  dismiss: (id) => closeNotification(set, id),
}));

function closeNotification(
  set: (
    partial:
      | NotificationStore
      | Partial<NotificationStore>
      | ((state: NotificationStore) => NotificationStore | Partial<NotificationStore>),
    replace?: false,
  ) => void,
  id: string,
) {
  set((state) => ({
    notifications: state.notifications.map((item) => (item.id === id ? { ...item, isClosing: true } : item)),
  }));

  window.setTimeout(() => {
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  }, 280);
}

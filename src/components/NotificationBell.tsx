import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Notification } from "@/types/domain";

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    if (!user) return;
    setNotifications(await api.listNotifications(user.id));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open) {
      await Promise.all(notifications.filter((n) => !n.read_at).map((n) => api.markNotificationRead(n.id)));
      load();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
          {notifications.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">Nothing yet.</p>}
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 15).map((n) => (
              <div key={n.id} className="rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                {n.body}
                <p className="mt-0.5 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { Bell } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext.jsx";
import { WORDS } from "../lib/words.js";

export function CountBadge({ count, className = "" }) {
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// The bell: opens Messages and shows how many are new.
export function MessagesBell({ className = "" }) {
  const { unread } = useNotifications();
  const words = {
    text: WORDS.messagesTitle.text,
    say: unread > 0 ? `You get ${unread} new ${unread === 1 ? "message" : "messages"}. Touch to read.` : WORDS.messagesTitle.say
  };
  return (
    <NavLink
      to="/app/messages"
      aria-label={unread > 0 ? `${words.text}: ${unread} new` : words.text}
      data-say={words.say}
      className={({ isActive }) =>
        `relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition ${
          isActive ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white text-ink hover:border-primary/40"
        } ${className}`
      }
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && <CountBadge count={unread} className="absolute -right-1.5 -top-1.5" />}
    </NavLink>
  );
}

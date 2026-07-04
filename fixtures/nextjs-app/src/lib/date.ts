import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

/** Format a date for display, e.g. "Mar 4, 2026". */
export function formatDate(date: Date | string, format = "MMM D, YYYY"): string {
  return dayjs(date).format(format);
}

/** Human relative time, e.g. "3 hours ago". */
export function formatRelativeTime(date: Date | string): string {
  return dayjs(date).fromNow();
}

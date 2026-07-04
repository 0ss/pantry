import dayjs from "dayjs";

/** Format a date (someone else's version). */
export function formatDate(date: Date | string, fmt = "YYYY-MM-DD"): string {
  return dayjs(date).format(fmt);
}

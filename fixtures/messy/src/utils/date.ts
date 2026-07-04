import moment from "moment";

/** Format a date (the original one). */
export function formatDate(date: Date | string): string {
  return moment(date).format("MMM D, YYYY");
}

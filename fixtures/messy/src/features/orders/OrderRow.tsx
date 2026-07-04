import { v4 as uuidv4 } from "uuid";
import { formatDate } from "../../helpers/dates";

interface Order {
  total: number;
  placedAt: string;
}

export function OrderRow({ order }: { order: Order }) {
  return (
    <tr data-row-id={uuidv4()}>
      <td>{formatDate(order.placedAt)}</td>
      <td>${order.total.toFixed(2)}</td>
    </tr>
  );
}

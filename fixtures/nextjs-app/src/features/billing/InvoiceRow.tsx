import { formatDate } from "@/lib/date";

interface Invoice {
  id: string;
  amountCents: number;
  issuedAt: string;
}

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr>
      <td>{invoice.id}</td>
      <td>${(invoice.amountCents / 100).toFixed(2)}</td>
      <td>{formatDate(invoice.issuedAt)}</td>
    </tr>
  );
}

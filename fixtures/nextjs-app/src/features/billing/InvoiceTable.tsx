import { formatDate } from "@/lib/date";
import { InvoiceRow } from "./InvoiceRow";

interface Invoice {
  id: string;
  amountCents: number;
  issuedAt: string;
}

export function InvoiceTable({ invoices, periodEnd }: { invoices: Invoice[]; periodEnd: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">Billing period ends {formatDate(periodEnd)}</p>
      <table className="mt-2 w-full">
        <tbody>
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

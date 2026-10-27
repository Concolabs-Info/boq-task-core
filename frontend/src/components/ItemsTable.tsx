import type { BoqItem } from "@/lib/types";

import { EmptyState } from "./ui";

export function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function ItemsTable({ items }: { items: BoqItem[] }) {
  if (!items.length) return <EmptyState title="No items yet">Items appear when observations can be quantified.</EmptyState>;
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.unit, (totals.get(item.unit) ?? 0) + item.quantity);
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Description</th>
          <th className="w-32">Storey</th>
          <th>Basis</th>
          <th className="num w-28">Quantity</th>
          <th className="w-16">Unit</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="font-medium text-zinc-800">{item.description}</td>
            <td className="text-zinc-600">{item.storey ?? "-"}</td>
            <td className="mono text-xs text-zinc-600">{item.basis}</td>
            <td className="num font-medium">{formatQuantity(item.quantity)}</td>
            <td className="text-zinc-600">{item.unit}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        {[...totals].map(([unit, total]) => (
          <tr key={unit} className="bg-zinc-50">
            <td colSpan={3} className="h-9 px-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
              Total
            </td>
            <td className="num h-9 px-3 font-semibold">{formatQuantity(total)}</td>
            <td className="h-9 px-3 text-zinc-600">{unit}</td>
          </tr>
        ))}
      </tfoot>
    </table>
  );
}

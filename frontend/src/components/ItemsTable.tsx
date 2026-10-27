import type { BoqItem } from "@/lib/types";

export function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function ItemsTable({ items }: { items: BoqItem[] }) {
  if (!items.length) return <p className="text-sm text-slate-500">No items yet.</p>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Storey</th>
          <th className="text-right">Quantity</th>
          <th>Unit</th>
          <th>Basis</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.description}</td>
            <td>{item.storey ?? "-"}</td>
            <td className="text-right tabular-nums">{formatQuantity(item.quantity)}</td>
            <td>{item.unit}</td>
            <td className="font-mono text-xs text-slate-600">{item.basis}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

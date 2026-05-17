import { useAdminOverview } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function OverviewTab() {
  const { data, isLoading } = useAdminOverview();
  if (isLoading || !data) return <div className="text-muted-foreground">Loading...</div>;

  const stats = [
    { label: "Products", value: data.productCount },
    { label: "Articles", value: data.articleCount },
    { label: "Drafts", value: data.draftArticleCount },
    { label: "Orders", value: data.orderCount },
    { label: "Pending orders", value: data.pendingOrderCount },
    { label: "Revenue", value: formatINR(data.revenueTotal) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-medium mb-3">Recent orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">#{o.id} · {o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.status} · {o.items.length} items</div>
                  </div>
                  <div className="font-medium">{formatINR(o.total)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-medium mb-3">Low stock</h2>
          {data.lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All products are well stocked.</p>
          ) : (
            <ul className="divide-y">
              {data.lowStockProducts.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs">{p.totalStock} in stock</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

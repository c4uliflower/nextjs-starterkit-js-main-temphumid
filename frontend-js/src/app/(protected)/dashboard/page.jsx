"use client";
import { Users, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageBox } from "@/components/custom/MessageBox";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
const revenueData = [
  { month: "Jan", revenue: 4200, expenses: 2800 },
  { month: "Feb", revenue: 5800, expenses: 3200 },
  { month: "Mar", revenue: 5100, expenses: 2900 },
  { month: "Apr", revenue: 7200, expenses: 3800 },
  { month: "May", revenue: 6800, expenses: 3400 },
  { month: "Jun", revenue: 8500, expenses: 4100 },
  { month: "Jul", revenue: 7900, expenses: 3700 },
  { month: "Aug", revenue: 9200, expenses: 4300 },
  { month: "Sep", revenue: 8100, expenses: 3900 },
  { month: "Oct", revenue: 10400, expenses: 4800 },
  { month: "Nov", revenue: 9600, expenses: 4500 },
  { month: "Dec", revenue: 11200, expenses: 5100 },
];
const recentOrders = [
  {
    id: "#ORD-7291",
    customer: "Sarah Johnson",
    amount: "$249.00",
    status: "Completed",
  },
  {
    id: "#ORD-7290",
    customer: "Mike Peters",
    amount: "$132.50",
    status: "Processing",
  },
  {
    id: "#ORD-7289",
    customer: "Emma Wilson",
    amount: "$89.99",
    status: "Completed",
  },
  {
    id: "#ORD-7288",
    customer: "James Brown",
    amount: "$432.00",
    status: "Pending",
  },
  {
    id: "#ORD-7287",
    customer: "Lisa Anderson",
    amount: "$67.25",
    status: "Completed",
  },
];
const statusColor = {
  Completed: "bg-success/10 text-success",
  Processing: "bg-info/10 text-info",
  Pending: "bg-warning/10 text-warning",
};

export default function Dashboard() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back! Here's an overview of your project.
        </p>
      </div>

      {/* Welcome message */}
      <MessageBox variant="info" dismissible>
        This is a demo dashboard for the <strong>Mazer-Shadcn UI Template</strong>. All data shown
        here is static sample data for demonstration purposes.
      </MessageBox>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          value="12,842"
          label="Total Users"
          icon={Users}
          variant="primary"
          filterHref="/users"
        />
        <DashboardCard
          value="$48,295"
          label="Revenue"
          icon={DollarSign}
          variant="success"
          filterHref="/charts/bar"
        />
        <DashboardCard
          value="1,432"
          label="Orders"
          icon={ShoppingCart}
          variant="warning"
          filterHref="/tables"
        />
        <DashboardCard
          value="24.5%"
          label="Growth"
          icon={TrendingUp}
          variant="destructive"
          filterHref="/charts/line"
        />
      </div>

      {/* Revenue Overview Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Monthly revenue vs expenses for the past year.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                <YAxis className="text-xs fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-card-foreground)",
                  }}
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--color-chart-1)"
                  radius={[4, 4, 0, 0]}
                  name="Revenue"
                />
                <Bar
                  dataKey="expenses"
                  fill="var(--color-chart-5)"
                  radius={[4, 4, 0, 0]}
                  name="Expenses"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest transactions from your store.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Order ID</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{order.id}</td>
                    <td className="py-3">{order.customer}</td>
                    <td className="py-3">{order.amount}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[order.status]}`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

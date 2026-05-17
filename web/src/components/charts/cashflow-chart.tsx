"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  annee: number;
  cash_flow_net: number;
  cumul_cash_flow: number;
};

export function CashflowChart({ rows }: { rows: Row[] }) {
  const data = rows.map((r) => ({
    annee: `An ${r.annee}`,
    "Cash-flow net": Math.round(r.cash_flow_net),
    "Cumul cash-flow": Math.round(r.cumul_cash_flow),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="annee"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={
              ((v: number) =>
                `${v.toLocaleString("fr-BE")} EUR`) as unknown as undefined
            }
            cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          />
          <Bar dataKey="Cash-flow net" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry["Cash-flow net"] < 0
                    ? "var(--destructive)"
                    : "var(--chart-1)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

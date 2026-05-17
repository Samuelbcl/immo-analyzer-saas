"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  annee: number;
  interets_annuels: number;
  capital_rembourse_annuel: number;
  capital_restant_du: number;
};

export function AmortizationChart({ rows }: { rows: Row[] }) {
  const data = rows.map((r) => ({
    annee: `An ${r.annee}`,
    "Capital restant dû": Math.round(r.capital_restant_du),
    "Capital remboursé (cumul)": Math.round(
      rows
        .slice(0, r.annee)
        .reduce((s, x) => s + x.capital_rembourse_annuel, 0),
    ),
    "Intérêts payés (cumul)": Math.round(
      rows.slice(0, r.annee).reduce((s, x) => s + x.interets_annuels, 0),
    ),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="capRest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="capRemb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="ints" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Area
            type="monotone"
            dataKey="Capital restant dû"
            stroke="var(--chart-1)"
            fill="url(#capRest)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Capital remboursé (cumul)"
            stroke="var(--chart-3)"
            fill="url(#capRemb)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Intérêts payés (cumul)"
            stroke="var(--destructive)"
            fill="url(#ints)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Props = {
  prix: number;
  frais: number;
  travaux: number;
  interets: number;
};

const COLORS = [
  "var(--chart-1)", // primary indigo
  "var(--chart-2)", // cyan
  "var(--chart-4)", // orange
  "var(--destructive)", // rouge
];

export function CostBreakdownChart({
  prix,
  frais,
  travaux,
  interets,
}: Props) {
  const data = [
    { name: "Prix d'achat", value: Math.round(prix) },
    { name: "Frais acquisition", value: Math.round(frais) },
    { name: "Travaux", value: Math.round(travaux) },
    { name: "Intérêts banque", value: Math.round(interets) },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full h-72 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={
              ((v: number) =>
                `${v.toLocaleString("fr-BE")} EUR (${((v / total) * 100).toFixed(1)}%)`) as unknown as undefined
            }
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-4">
        <div className="text-xs text-muted-foreground">Coût total</div>
        <div className="text-xl font-bold tabular-nums">
          {total.toLocaleString("fr-BE")}
        </div>
        <div className="text-xs text-muted-foreground">EUR</div>
      </div>
    </div>
  );
}

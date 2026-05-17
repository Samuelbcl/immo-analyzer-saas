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
  /** Mensualité totale (capital + intérêts du mois 1) */
  mensualite: number;
  /** Intérêts du mois 1 */
  interets_mois_1: number;
};

export function MonthlyBreakdownChart({
  mensualite,
  interets_mois_1,
}: Props) {
  const capital = Math.max(0, mensualite - interets_mois_1);
  const data = [
    { name: "Capital remboursé", value: Math.round(capital) },
    { name: "Intérêts banque", value: Math.round(interets_mois_1) },
  ];

  const COLORS = ["var(--chart-1)", "var(--destructive)"];

  return (
    <div className="w-full h-64 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
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
                `${v.toLocaleString("fr-BE")} EUR/mois`) as unknown as undefined
            }
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import {
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";

export function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "var(--chart-3)" // vert
      : score >= 40
        ? "var(--chart-4)" // orange
        : "var(--destructive)"; // rouge

  const data = [{ name: "score", value: score, fill: color }];

  return (
    <div className="relative w-full aspect-square">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="78%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <RadialBar
            background={{ fill: "var(--secondary)" }}
            dataKey="value"
            cornerRadius={12}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-3xl sm:text-4xl font-bold tabular-nums leading-none">
          {score}
        </div>
        <div className="text-[10px] sm:text-xs text-current/70 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";

interface ServerDistributionChartProps {
  loading?: boolean;
}

// Mock data for server distribution by location
const generateServerDistributionData = () => {
  const locations = ["Data Center 1", "Data Center 2", "Cloud AWS", "Cloud Azure", "Edge Nodes"];
  return locations.map((location) => ({
    name: location,
    production: Math.floor(Math.random() * 40) + 20,
    development: Math.floor(Math.random() * 20) + 5,
    backup: Math.floor(Math.random() * 15) + 3,
  }));
};

export function ServerDistributionChart({ loading }: ServerDistributionChartProps) {
  const [data] = React.useState(generateServerDistributionData);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg font-semibold">Server Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`tooltip-${index}`} className="text-xs text-slate-600 dark:text-slate-300">
              <span style={{ color: entry.color }}>●</span> {entry.name}: {entry.value}
            </p>
          ))}
          <p className="text-xs font-semibold text-slate-900 dark:text-white mt-2 pt-2 border-t border-slate-200">
            Total: {total} servers
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-500" />
          <CardTitle className="text-lg font-semibold">Server Distribution</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Servers by location and environment</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#e2e8f0" }}
              angle={-15}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              iconType="square"
              iconSize={10}
            />
            <Bar
              dataKey="production"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name="Production"
            />
            <Bar
              dataKey="development"
              fill="#A855F7"
              radius={[4, 4, 0, 0]}
              name="Development"
            />
            <Bar
              dataKey="backup"
              fill="#64748B"
              radius={[4, 4, 0, 0]}
              name="Backup"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

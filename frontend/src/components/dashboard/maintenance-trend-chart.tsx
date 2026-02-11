"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface MaintenanceTrendChartProps {
  loading?: boolean;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

// Mock data for maintenance trends (7 days)
const generateMaintenanceTrendData = () => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day) => ({
    name: day,
    completed: Math.floor(Math.random() * 15) + 5,
    scheduled: Math.floor(Math.random() * 10) + 3,
    overdue: Math.floor(Math.random() * 5),
  }));
};

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${index}`} className="text-xs text-slate-600 dark:text-slate-300">
            <span style={{ color: entry.color }}>●</span> {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function MaintenanceTrendChart({ loading }: MaintenanceTrendChartProps) {
  const [data] = React.useState(generateMaintenanceTrendData);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg font-semibold">Maintenance Trends</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg font-semibold">Maintenance Trends</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Weekly maintenance activity overview</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#22C55E"
              strokeWidth={2}
              dot={{ fill: "#22C55E", r: 4 }}
              activeDot={{ r: 6 }}
              name="Completed"
            />
            <Line
              type="monotone"
              dataKey="scheduled"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: "#3B82F6", r: 4 }}
              activeDot={{ r: 6 }}
              name="Scheduled"
            />
            <Line
              type="monotone"
              dataKey="overdue"
              stroke="#EF4444"
              strokeWidth={2}
              dot={{ fill: "#EF4444", r: 4 }}
              activeDot={{ r: 6 }}
              name="Overdue"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

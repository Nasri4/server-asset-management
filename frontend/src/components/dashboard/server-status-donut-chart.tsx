"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

interface ServerStatusDonutChartProps {
  data: Record<string, number>;
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Active: "#22C55E", // Soft Green
  Maintenance: "#F59E0B", // Amber
  Degraded: "#64748B", // Slate
  Issue: "#F43F5E", // Rose
  Warning: "#FBBF24", // Yellow
  Down: "#EF4444", // Red
  Unknown: "#9CA3AF", // Gray
};

export function ServerStatusDonutChart({ data, loading }: ServerStatusDonutChartProps) {
  const chartData = React.useMemo(() => {
    return Object.entries(data)
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS[name] || STATUS_COLORS.Unknown,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const total = React.useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg font-semibold">Server Status Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg font-semibold">Server Status Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-slate-900 mb-1">No Data Available</h3>
            <p className="text-xs text-slate-500">Server status data will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{data.name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {data.value} servers ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap gap-3 justify-center mt-4">
        {payload.map((entry: any, index: number) => {
          const percentage = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : 0;
          return (
            <div key={`legend-${index}`} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                {entry.value} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-lg font-semibold">Server Status Distribution</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Overview of all server statuses</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
        
        {total > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Servers</span>
              <span className="text-lg font-bold text-slate-900">{total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

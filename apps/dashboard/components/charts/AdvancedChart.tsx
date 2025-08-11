'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartData {
  date: string;
  value: number;
}

interface AdvancedChartProps {
  data: ChartData[];
  title: string;
  yAxisLabel: string;
  showVolume?: boolean;
  className?: string;
}

export function AdvancedChart({
  data,
  title,
  yAxisLabel,
  showVolume = false,
  className,
}: AdvancedChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>(data);
  const [_isLoading, _setIsLoading] = useState(false);

  const _calculateMovingAverage = useCallback((data: ChartData[], period: number) => {
    return data.map((point, index) => {
      if (index < period - 1) return point;
      const sum = data
        .slice(index - period + 1, index + 1)
        .reduce((acc, curr) => acc + curr.value, 0);
      return {
        ...point,
        ma: sum / period,
      };
    });
  }, []);

  useEffect(() => {
    setChartData(data);
  }, [data]);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-background/95 p-3 rounded-lg shadow-lg border border-border">
        <p className="text-sm font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm">
            {entry.dataKey === 'value' ? 'Value' : 'Moving Average'}: {entry.value.toFixed(2)}
          </p>
        ))}
      </div>
    );
  };

  if (_isLoading) {
    return (
      <Card className={cn('w-full h-full min-h-[400px]', className)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[300px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full h-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 8 }}
              />
              {showVolume && (
                <Line
                  type="monotone"
                  dataKey="ma"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 8 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

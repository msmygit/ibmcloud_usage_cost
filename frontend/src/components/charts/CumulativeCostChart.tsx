import React, { useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ExportButton } from '../ui/ExportButton';
import { useChartExport } from '../../hooks/useExport';
import { formatCurrency } from '../../utils/formatters';
import type { ChartDataPoint, AreaChartConfig } from '../../types/chart.types';

interface CumulativeCostChartProps {
  data: ChartDataPoint[];
  config?: Partial<AreaChartConfig>;
  showExport?: boolean;
  className?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function CumulativeCostChart({
  data,
  config = {},
  showExport = true,
  className,
}: CumulativeCostChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { exportAsPNG } = useChartExport();

  const {
    title = 'Cumulative Cost Over Time',
    dataKeys = ['value'],
    xAxisKey = 'name',
    showLegend = true,
    showGrid = true,
    stacked = true,
    fillOpacity = 0.6,
    height = 400,
  } = config;

  const handleExport = async (format: 'png' | 'pdf' | 'csv' | 'excel' | 'jpeg' | 'json') => {
    if (!chartRef.current) return;

    if (format === 'png' || format === 'jpeg') {
      await exportAsPNG(chartRef.current, {
        filename: `cumulative-cost-${Date.now()}.${format}`,
        width: 1920,
        height: 1080,
      });
    } else if (format === 'csv') {
      const csv = [
        [xAxisKey, ...dataKeys].join(','),
        ...data.map((row) =>
          [row[xAxisKey], ...dataKeys.map((key) => row[key])].join(',')
        ),
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cumulative-cost-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatTooltipValue = (value: any) => {
    return formatCurrency(value as number, 'USD');
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {showExport && (
          <ExportButton
            onExport={handleExport}
            formats={['png', 'csv']}
          />
        )}
      </div>

      <div ref={chartRef} className="bg-card p-4 rounded-lg border border-border">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
            <XAxis
              dataKey={xAxisKey}
              className="fill-muted-foreground"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              className="fill-muted-foreground"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                color: 'hsl(var(--foreground))',
              }}
            />
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId={stacked ? 'stack' : undefined}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={fillOpacity}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Made with Bob

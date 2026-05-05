import React, { useRef } from 'react';
import {
  LineChart,
  Line,
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
import type { ChartDataPoint, LineChartConfig } from '../../types/chart.types';

interface CostTrendChartProps {
  data: ChartDataPoint[];
  config?: Partial<LineChartConfig>;
  showExport?: boolean;
  className?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function CostTrendChart({
  data,
  config = {},
  showExport = true,
  className,
}: CostTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { exportAsPNG } = useChartExport();

  const {
    title = 'Cost Trend Over Time',
    dataKeys = ['value'],
    xAxisKey = 'name',
    showLegend = true,
    showGrid = true,
    showDots = true,
    strokeWidth = 2,
    curved = true,
    height = 400,
  } = config;

  const handleExport = async (format: 'png' | 'pdf' | 'csv' | 'excel' | 'jpeg' | 'json') => {
    if (!chartRef.current) return;

    if (format === 'png' || format === 'jpeg') {
      await exportAsPNG(chartRef.current, {
        filename: `cost-trend-${Date.now()}.${format}`,
        width: 1920,
        height: 1080,
      });
    } else if (format === 'pdf') {
      // PDF export would use a library like jsPDF with the chart image
      await exportAsPNG(chartRef.current, {
        filename: `cost-trend-${Date.now()}.png`,
        width: 1920,
        height: 1080,
      });
      // TODO: Implement PDF generation with jsPDF
    } else if (format === 'csv') {
      // Export data as CSV
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
      a.download = `cost-trend-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value, 'USD');
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {showExport && (
          <ExportButton
            onExport={handleExport}
            formats={['png', 'pdf', 'csv']}
          />
        )}
      </div>

      <div ref={chartRef} className="bg-white p-4 rounded-lg border border-gray-200">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis
              dataKey={xAxisKey}
              stroke="#6B7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#6B7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            {showLegend && <Legend />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type={curved ? 'monotone' : 'linear'}
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={strokeWidth}
                dot={showDots}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Made with Bob

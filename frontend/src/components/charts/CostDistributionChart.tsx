import { useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ExportButton } from '../ui/ExportButton';
import { useChartExport } from '../../hooks/useExport';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import type { PieChartDataPoint, PieChartConfig } from '../../types/chart.types';

interface CostDistributionChartProps {
  data: PieChartDataPoint[];
  config?: Partial<PieChartConfig>;
  showExport?: boolean;
  className?: string;
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // orange
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange-600
];

export function CostDistributionChart({
  data,
  config = {},
  showExport = true,
  className,
}: CostDistributionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { exportAsPNG } = useChartExport();
  const [chartType, setChartType] = useState<'pie' | 'bar'>('bar');

  const {
    title = 'Cost Distribution',
    showLabels = true,
    showLegend = true,
    innerRadius = 0,
    outerRadius = 80,
    height = 400,
  } = config;

  const handleExport = async (format: 'png' | 'pdf' | 'csv' | 'excel' | 'jpeg' | 'json') => {
    if (!chartRef.current) return;

    if (format === 'png' || format === 'jpeg') {
      await exportAsPNG(chartRef.current, {
        filename: `cost-distribution-${Date.now()}.${format}`,
        width: 1920,
        height: 1080,
      });
    } else if (format === 'csv') {
      const csv = [
        ['Name', 'Value', 'Percentage'].join(','),
        ...data.map((row) =>
          [row.name, row.value, row.percentage || ''].join(',')
        ),
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost-distribution-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    // Handle null/undefined percent values
    if (!showLabels || percent == null || percent < 0.05) return null; // Don't show labels for < 5%
    
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {formatPercentage(percent * 100)}
      </text>
    );
  };

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
        <p className="font-semibold text-foreground">{data.name || 'Unknown'}</p>
        <p className="text-sm text-foreground">
          {formatCurrency(data.value, 'USD')}
        </p>
        {data.percentage != null && (
          <p className="text-xs text-muted-foreground">
            {formatPercentage(data.percentage)}
          </p>
        )}
      </div>
    );
  };

  // Custom legend component that respects theme
  const renderCustomLegend = () => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {data.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
            />
            <span className="text-sm text-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    );
  };

  // Custom tick component for theme-aware axis labels
  const CustomAxisTick = ({ x, y, payload, angle = 0, textAnchor = 'middle' }: any) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor={textAnchor}
          fill="currentColor"
          className="text-xs fill-muted-foreground"
          transform={angle ? `rotate(${angle})` : undefined}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor={`${title}-chart-type`} className="text-sm font-medium text-foreground">
              Chart type
            </label>
            <select
              id={`${title}-chart-type`}
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'pie' | 'bar')}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="bar">Bar Chart</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>
          {showExport && (
            <ExportButton
              onExport={handleExport}
              formats={['png', 'csv']}
            />
          )}
        </div>
      </div>

      <div ref={chartRef} className="bg-card p-4 rounded-lg border border-border">
        <ResponsiveContainer width="100%" height={height}>
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={renderTooltip} />
            </PieChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 8, right: 24, left: 24, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={90}
                tick={(props) => <CustomAxisTick {...props} angle={-35} textAnchor="end" />}
              />
              <YAxis
                tick={(props) => <CustomAxisTick {...props} />}
                tickFormatter={(value) => formatCurrency(Number(value), 'USD')}
              />
              <Tooltip content={renderTooltip} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`bar-cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {showLegend && renderCustomLegend()}
    </div>
  );
}

// Made with Bob

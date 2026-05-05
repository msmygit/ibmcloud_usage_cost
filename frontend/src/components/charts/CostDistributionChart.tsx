import { useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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
    if (!showLabels || percent < 0.05) return null; // Don't show labels for < 5%
    
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
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {formatCurrency(data.value, 'USD')}
        </p>
        {data.percentage !== undefined && (
          <p className="text-xs text-gray-500">
            {formatPercentage(data.percentage)}
          </p>
        )}
      </div>
    );
  };

  const renderLegendFormatter = (value: string) => (
    <span className="text-sm text-gray-700">{value}</span>
  );

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor={`${title}-chart-type`} className="text-sm font-medium text-gray-700">
              Chart type
            </label>
            <select
              id={`${title}-chart-type`}
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'pie' | 'bar')}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      <div ref={chartRef} className="bg-white p-4 rounded-lg border border-gray-200">
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
              {showLegend && (
                <Legend
                  formatter={renderLegendFormatter}
                  wrapperStyle={{ paddingTop: '16px' }}
                />
              )}
            </PieChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 8, right: 24, left: 24, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={90}
                tick={{ fontSize: 12, fill: '#4b5563' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#4b5563' }}
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
    </div>
  );
}

// Made with Bob

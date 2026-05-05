import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface CostCardProps {
  title: string;
  value: number;
  currency?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
}

export function CostCard({
  title,
  value,
  currency = 'USD',
  trend,
  icon,
  className,
}: CostCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      case 'neutral':
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    
    switch (trend.direction) {
      case 'up':
        return 'text-red-600 bg-red-50';
      case 'down':
        return 'text-green-600 bg-green-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(value, currency)}
          </p>
          
          {trend && (
            <div className="mt-2 flex items-center">
              <span
                className={clsx(
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                  getTrendColor()
                )}
              >
                {getTrendIcon()}
                <span className="ml-1">
                  {formatPercentage(Math.abs(trend.value))}
                </span>
              </span>
              <span className="ml-2 text-xs text-gray-500">vs last period</span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="ml-4 flex-shrink-0">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-50 rounded-lg">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob

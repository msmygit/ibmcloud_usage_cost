import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { clsx } from 'clsx';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  maxMonths?: number;
  className?: string;
}

const presets = [
  { label: 'Last 7 days', getValue: () => ({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })},
  { label: 'Last 30 days', getValue: () => ({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })},
  { label: 'Last month', getValue: () => ({
    startDate: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
  })},
  { label: 'Last 3 months', getValue: () => ({
    startDate: format(startOfMonth(subMonths(new Date(), 3)), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })},
  { label: 'Last 6 months', getValue: () => ({
    startDate: format(startOfMonth(subMonths(new Date(), 6)), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })},
  { label: 'Last 12 months', getValue: () => ({
    startDate: format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  })},
];

export function DateRangePicker({
  value,
  onChange,
  maxMonths = 12,
  className,
}: DateRangePickerProps) {
  const [isCustom, setIsCustom] = useState(false);

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    onChange(range);
    setIsCustom(false);
  };

  const handleCustomChange = (field: 'startDate' | 'endDate', newValue: string) => {
    onChange({
      ...value,
      [field]: newValue,
    });
  };

  const handleClear = () => {
    onChange({
      startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    setIsCustom(false);
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset)}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              !isCustom &&
              value.startDate === preset.getValue().startDate &&
              value.endDate === preset.getValue().endDate
                ? 'bg-blue-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            isCustom
              ? 'bg-blue-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          Custom Range
        </button>
      </div>

      {/* Custom Date Inputs */}
      {isCustom && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="start-date"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Start Date
            </label>
            <div className="relative">
              <input
                id="start-date"
                type="date"
                value={value.startDate}
                onChange={(e) => handleCustomChange('startDate', e.target.value)}
                max={value.endDate}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Calendar className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label
              htmlFor="end-date"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              End Date
            </label>
            <div className="relative">
              <input
                id="end-date"
                type="date"
                value={value.endDate}
                onChange={(e) => handleCustomChange('endDate', e.target.value)}
                min={value.startDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Calendar className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <button
              onClick={handleClear}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Selected Range Display */}
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">Selected range:</span>{' '}
        {format(new Date(value.startDate), 'MMM dd, yyyy')} -{' '}
        {format(new Date(value.endDate), 'MMM dd, yyyy')}
      </div>
    </div>
  );
}

// Made with Bob

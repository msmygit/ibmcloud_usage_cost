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
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              !isCustom && 
              value.startDate === preset.getValue().startDate &&
              value.endDate === preset.getValue().endDate
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            isCustom
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          Custom Range
        </button>
      </div>

      {/* Custom Date Inputs */}
      {isCustom && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label
              htmlFor="start-date"
              className="block text-sm font-medium text-gray-700 mb-1"
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label
              htmlFor="end-date"
              className="block text-sm font-medium text-gray-700 mb-1"
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <button
              onClick={handleClear}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Selected Range Display */}
      <div className="text-sm text-gray-600">
        <span className="font-medium">Selected range:</span>{' '}
        {format(new Date(value.startDate), 'MMM dd, yyyy')} -{' '}
        {format(new Date(value.endDate), 'MMM dd, yyyy')}
      </div>
    </div>
  );
}

// Made with Bob

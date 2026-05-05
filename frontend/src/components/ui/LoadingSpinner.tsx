import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

export function LoadingSpinner({
  size = 'md',
  message,
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center', className)}>
      <Loader2
        className={clsx(
          sizeClasses[size],
          'animate-spin text-blue-600'
        )}
      />
      {message && (
        <p className="mt-3 text-sm text-gray-600 animate-pulse">{message}</p>
      )}
    </div>
  );
}

// Full page loading spinner
export function LoadingPage({ message }: { message?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" message={message || 'Loading...'} />
    </div>
  );
}

// Inline loading spinner for buttons
export function ButtonSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

// Made with Bob

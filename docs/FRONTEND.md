# IBM Cloud Cost Tracking System - Frontend Documentation

**Version:** 1.0  
**Last Updated:** 2026-05-04

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Core Services](#core-services)
6. [State Management](#state-management)
7. [Type System](#type-system)
8. [Utilities](#utilities)
9. [Component Guidelines](#component-guidelines)
10. [Export Functionality](#export-functionality)
11. [Real-time Updates](#real-time-updates)
12. [Performance Optimizations](#performance-optimizations)
13. [Accessibility](#accessibility)
14. [Development Guide](#development-guide)

---

## Overview

The frontend is a modern React application built with TypeScript, providing an interactive interface for viewing IBM Cloud cost data, generating reports, and exporting visualizations.

### Key Features

- **Interactive Dashboards**: Real-time cost visualization with multiple chart types
- **Report Generation**: Create custom spending reports with filters
- **Real-time Progress**: WebSocket-based progress updates during report generation
- **Multi-format Export**: Export charts and data as PNG, JPEG, PDF, CSV, and Excel
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Type Safety**: Full TypeScript coverage for robust development

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Application                    │
├─────────────────────────────────────────────────────────┤
│  Pages (Dashboard, ReportGenerator, ReportViewer, etc.) │
├─────────────────────────────────────────────────────────┤
│  Components (Charts, Tables, Forms, Layout)             │
├─────────────────────────────────────────────────────────┤
│  Hooks (useReports, useWebSocket, useExport)            │
├─────────────────────────────────────────────────────────┤
│  Services (API, WebSocket, Export)                      │
├─────────────────────────────────────────────────────────┤
│  Utilities (Formatters, Validators, Chart Helpers)      │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Interaction** → Component triggers action
2. **Hook Layer** → React Query/Custom hooks manage state
3. **Service Layer** → API/WebSocket services communicate with backend
4. **State Update** → React Query cache updates
5. **UI Re-render** → Components reflect new state

---

## Technology Stack

### Core Technologies

- **React 18**: UI library with concurrent features
- **TypeScript 5.3**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework

### State Management

- **React Query (@tanstack/react-query)**: Server state management
- **Zustand**: Global client state (if needed)
- **React Hooks**: Local component state

### Data Visualization

- **Recharts**: Composable charting library
- **html2canvas**: Chart-to-image conversion
- **jsPDF**: PDF generation
- **xlsx**: Excel export

### Communication

- **Axios**: HTTP client for REST API
- **Socket.io Client**: WebSocket for real-time updates

### Utilities

- **date-fns**: Date manipulation and formatting
- **zod**: Runtime type validation
- **clsx + tailwind-merge**: Conditional class names

---

## Project Structure

```
frontend/
├── src/
│   ├── types/              # TypeScript type definitions
│   │   ├── api.types.ts
│   │   ├── report.types.ts
│   │   ├── chart.types.ts
│   │   └── websocket.types.ts
│   │
│   ├── services/           # Core services
│   │   ├── api.service.ts
│   │   ├── websocket.service.ts
│   │   └── export.service.ts
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── useReports.ts
│   │   ├── useWebSocket.ts
│   │   └── useExport.ts
│   │
│   ├── utils/              # Utility functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── chart-helpers.ts
│   │
│   ├── components/         # React components
│   │   ├── charts/         # Chart components
│   │   ├── tables/         # Data table components
│   │   ├── export/         # Export UI components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # Reusable UI components
│   │
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx
│   │   ├── ReportGenerator.tsx
│   │   ├── ReportViewer.tsx
│   │   └── UserSpending.tsx
│   │
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
│
├── public/                 # Static assets
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Core Services

### API Service (`services/api.service.ts`)

Axios-based HTTP client for backend communication.

**Features:**
- Request/response interceptors
- Automatic error handling
- Rate limit header parsing
- Type-safe API methods

**Usage:**
```typescript
import { apiService } from '@/services/api.service';

// Generate report
const response = await apiService.generateUserSpendingReport({
  accountId: 'account-id',
  period: 'month',
  includeForecasts: true,
});

// Get report
const report = await apiService.getReport(reportId);
```

### WebSocket Service (`services/websocket.service.ts`)

Socket.io client for real-time updates.

**Features:**
- Automatic reconnection
- Room-based subscriptions
- Event-driven architecture
- Connection state management

**Usage:**
```typescript
import { websocketService } from '@/services/websocket.service';

// Connect
websocketService.connect();

// Subscribe to events
const unsubscribe = websocketService.on('report:progress', (data) => {
  console.log('Progress:', data.progress);
});

// Join room
websocketService.joinRoom({ room: 'report:123' });
```

### Export Service (`services/export.service.ts`)

Multi-format export functionality.

**Features:**
- Chart export (PNG, JPEG)
- Data export (CSV, JSON, Excel)
- Report export (PDF with charts)
- Batch export support

**Usage:**
```typescript
import { exportService } from '@/services/export.service';

// Export chart as PNG
await exportService.exportChartAsPNG(chartElement, {
  width: 1920,
  height: 1080,
  filename: 'cost-chart.png',
});

// Export data as CSV
exportService.exportAsCSV(data, 'report-data.csv');
```

---

## State Management

### React Query Hooks

#### `useReports` Hook

Manages report operations with React Query.

```typescript
import { useGenerateUserSpendingReport, useReport } from '@/hooks/useReports';

// Generate report
const { mutate, isPending } = useGenerateUserSpendingReport();
mutate({
  accountId: 'account-id',
  period: 'month',
});

// Fetch report
const { data: report, isLoading } = useReport(reportId);
```

#### `useWebSocket` Hook

Manages WebSocket connections and real-time updates.

```typescript
import { useReportProgress } from '@/hooks/useWebSocket';

const { progress, isComplete, error, cancelReport } = useReportProgress(reportId);

// Display progress
console.log(`Progress: ${progress?.progress}%`);
console.log(`Step: ${progress?.currentStep}`);
```

#### `useExport` Hook

Handles export operations with loading states.

```typescript
import { useChartExport, useDataExport } from '@/hooks/useExport';

const { exportAsPNG, isExporting } = useChartExport();

await exportAsPNG(chartElement, {
  filename: 'chart.png',
  width: 1920,
  height: 1080,
});
```

---

## Type System

### Type Definitions

All types are defined in `src/types/` and mirror backend types for consistency.

**Key Type Files:**
- `api.types.ts`: API request/response types
- `report.types.ts`: Report data structures
- `chart.types.ts`: Chart configuration types
- `websocket.types.ts`: WebSocket event types

**Example:**
```typescript
import type { UserSpendingReport } from '@/types/report.types';
import type { GenerateUserSpendingRequest } from '@/types/api.types';

const request: GenerateUserSpendingRequest = {
  accountId: 'account-id',
  period: 'month',
  includeForecasts: true,
};
```

---

## Utilities

### Formatters (`utils/formatters.ts`)

Format data for display.

```typescript
import { formatCurrency, formatDate, formatPercentage } from '@/utils/formatters';

formatCurrency(1234.56, 'USD'); // "$1,234.56"
formatDate(new Date(), 'MMM dd, yyyy'); // "May 04, 2026"
formatPercentage(45.67); // "45.7%"
```

### Validators (`utils/validators.ts`)

Validate user input.

```typescript
import { isValidEmail, isValidDateRange } from '@/utils/validators';

isValidEmail('user@example.com'); // true
isValidDateRange({ startDate: '2026-01-01', endDate: '2026-12-31' }); // { valid: true }
```

### Chart Helpers (`utils/chart-helpers.ts`)

Transform data for charts.

```typescript
import { transformUserSpendingForPieChart } from '@/utils/chart-helpers';

const pieData = transformUserSpendingForPieChart(report);
```

---

## Component Guidelines

### Component Structure

```typescript
import React from 'react';
import type { ComponentProps } from './types';

interface Props extends ComponentProps {
  // Component-specific props
}

export function ComponentName({ prop1, prop2 }: Props) {
  // Hooks
  const [state, setState] = useState();
  
  // Effects
  useEffect(() => {
    // Side effects
  }, []);
  
  // Handlers
  const handleClick = () => {
    // Handle event
  };
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Naming Conventions

- **Components**: PascalCase (`UserSpendingChart`)
- **Hooks**: camelCase with `use` prefix (`useReportData`)
- **Utilities**: camelCase (`formatCurrency`)
- **Types**: PascalCase (`UserSpendingReport`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

---

## Export Functionality

### Supported Formats

1. **PNG**: High-resolution chart images (1920x1080 default)
2. **JPEG**: Compressed chart images
3. **PDF**: Full reports with multiple charts
4. **CSV**: Tabular data export
5. **Excel**: Multi-sheet workbooks
6. **JSON**: Raw data export

### Export Workflow

1. User clicks export button
2. Select format and options
3. Service generates export
4. Browser downloads file

---

## Real-time Updates

### WebSocket Events

- `server:ready`: Server connection established
- `report:progress`: Report generation progress
- `report:complete`: Report generation complete
- `report:error`: Report generation error

### Progress Display

```typescript
const { progress } = useReportProgress(reportId);

<ProgressBar 
  value={progress?.progress || 0}
  label={progress?.currentStep}
  estimatedTime={progress?.estimatedTimeRemaining}
/>
```

---

## Performance Optimizations

### Implemented Optimizations

1. **Code Splitting**: Lazy load routes and heavy components
2. **React Query Caching**: Minimize API calls
3. **Memoization**: Use `useMemo` and `useCallback` for expensive operations
4. **Virtual Scrolling**: For large data tables
5. **Debounced Search**: Reduce API calls during typing
6. **Image Optimization**: Lazy load images

### Best Practices

- Use React.memo for pure components
- Implement pagination for large datasets
- Optimize chart rendering with data sampling
- Use Web Workers for heavy computations

---

## Accessibility

### ARIA Labels

All interactive elements have proper ARIA labels.

### Keyboard Navigation

- Tab navigation through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals

### Screen Reader Support

- Semantic HTML elements
- Alt text for images
- Live regions for dynamic content

---

## Development Guide

### Setup

```bash
cd frontend
pnpm install
```

### Development Server

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Type Checking

```bash
pnpm tsc --noEmit
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Testing

```bash
pnpm test
pnpm test:coverage
```

### Environment Variables

Create `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

## Next Steps

1. **Implement Chart Components**: Create reusable chart components with Recharts
2. **Build Page Components**: Implement Dashboard, ReportGenerator, ReportViewer
3. **Create Layout Components**: Header, Sidebar, Footer
4. **Add Tests**: Component tests with Vitest and Testing Library
5. **Implement Authentication**: Add login/logout functionality
6. **Add Error Boundaries**: Graceful error handling
7. **Optimize Bundle Size**: Analyze and reduce bundle size
8. **Add Analytics**: Track user interactions

---

**Made with Bob**
# IBM Cloud Cost Analytics Application

A full-stack application for analyzing and visualizing IBM Cloud costs with real-time data, interactive dashboards, and comprehensive reporting capabilities.

## Features

### Core Functionality

- **Account Management**: Automatically fetch and manage multiple IBM Cloud accounts
- **Dashboard**: Real-time cost overview with key metrics (Total Cost, Resource Groups, Active Users)
- **User Spending Analysis**: Detailed breakdown of costs by user with interactive charts
- **Resource Group Costs**: Visualize spending across different resource groups
- **Date Range Selection**: Flexible date range picker with presets (last 7/30 days, last month, 3/6/12 months, custom)
- **Export Capabilities**: Download charts as images (PNG/JPEG) and data as CSV/Excel/JSON
- **Report Generation**: Create comprehensive cost reports with WebSocket progress tracking

### Technical Highlights

- **IBM Cloud API Integration**: Strict conformance to official IBM Cloud APIs
  - [Resource Controller API](https://cloud.ibm.com/apidocs/resource-controller/resource-controller#list-resource-instances)
  - [Usage Reports API](https://cloud.ibm.com/apidocs/metering-reporting#get-resource-group-usage)
- **Real-time Updates**: WebSocket support for live progress tracking
- **Caching**: Multi-layer caching (memory + file) for optimal performance
- **Type Safety**: Full TypeScript implementation across frontend and backend
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: v8 or higher (recommended) or npm
- **IBM Cloud Account**: With appropriate permissions
- **IBM Cloud API Key**: Required for authentication

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ibmcloud_usage_cost
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Backend

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your IBM Cloud credentials:

```env
# REQUIRED: IBM Cloud API Key
IBM_CLOUD_API_KEY=your_ibm_cloud_api_key_here

# OPTIONAL: Default account ID (pre-selects this account in the UI)
IBM_CLOUD_ACCOUNT_ID=your_account_id_here

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

#### Getting Your IBM Cloud API Key

1. Go to [IBM Cloud IAM API Keys](https://cloud.ibm.com/iam/apikeys)
2. Click "Create an IBM Cloud API key"
3. Give it a descriptive name (e.g., "Cost Analytics App")
4. Copy the API key immediately (you won't be able to see it again)
5. Paste it into your `.env` file

### 4. Configure Frontend (Optional)

Create a `.env` file in the `frontend` directory if you need to customize the API URL:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 5. Start the Application

#### Development Mode

Start both backend and frontend in development mode:

```bash
# From the root directory
pnpm dev
```

Or start them separately:

```bash
# Terminal 1 - Backend
cd backend
pnpm dev

# Terminal 2 - Frontend
cd frontend
pnpm dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

#### Production Mode

```bash
# Build both frontend and backend
pnpm build

# Start production server
pnpm start
```

## Application Structure

```
ibmcloud_usage_cost/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── api/            # API routes and controllers
│   │   ├── clients/        # IBM Cloud API clients
│   │   ├── config/         # Configuration management
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   └── tests/              # Backend tests
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API and export services
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   └── public/             # Static assets
└── docs/                   # Documentation
```

## Usage Guide

### Dashboard

The landing page displays:
- **Total Cost**: Aggregate cost for the selected date range
- **Total Resource Groups**: Number of resource groups in the account
- **Active Users**: Count of unique users who created resources
- **Cost Trend Chart**: Monthly cost progression
- **Top Services Chart**: Distribution of costs by service

### User Spending Page

Analyze costs by individual users:
- View total spending per user
- See resource and service counts
- Filter users by email
- Export data as CSV, Excel, or JSON
- Download charts as images

### Resource Group Costs Page

Visualize spending across resource groups:
- Total cost per resource group
- Resource and service counts
- Monthly cost trends
- Top 5 resource groups by cost
- Export capabilities for charts and data

### Date Range Selection

All pages support flexible date range selection:
- **Presets**: Last 7 days (default), 30 days, last month, 3/6/12 months
- **Custom Range**: Select any start and end date
- Date range applies globally across all views

### Account Selection

- Accounts are automatically discovered using your API key
- Select different accounts from the dropdown in the header
- If `IBM_CLOUD_ACCOUNT_ID` is set in `.env`, that account is pre-selected
- Manual account entry is available if auto-discovery fails

## API Endpoints

### Accounts
- `GET /api/accounts` - List accessible accounts
- `GET /api/accounts/test` - Test IBM Cloud connection

### Resources
- `GET /api/resources` - Get resource instances

### Usage
- `GET /api/usage` - Get usage data for date range

### Reports
- `POST /api/reports/user-spending` - Generate user spending report
- `POST /api/reports/team-spending` - Generate team spending report
- `GET /api/reports/:id` - Get report by ID
- `DELETE /api/reports/:id` - Cancel report generation

### Cache
- `GET /api/cache/stats` - Get cache statistics
- `DELETE /api/cache` - Clear cache
- `POST /api/cache/warm` - Warm cache for account

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IBM_CLOUD_API_KEY` | **Yes** | - | IBM Cloud API key for authentication |
| `IBM_CLOUD_ACCOUNT_ID` | No | - | Default account ID to pre-select |
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3000` | Server port |
| `HOST` | No | `localhost` | Server host |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origins |
| `CACHE_ENABLED` | No | `true` | Enable caching |
| `CACHE_TTL_RESOURCES` | No | `3600` | Resource cache TTL (seconds) |
| `CACHE_TTL_USAGE` | No | `1800` | Usage cache TTL (seconds) |
| `LOG_LEVEL` | No | `info` | Logging level |
| `WEBSOCKET_ENABLED` | No | `true` | Enable WebSocket support |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://localhost:3000` | Backend API URL |

## Error Handling

### Missing API Key

If `IBM_CLOUD_API_KEY` is not configured, the application will display a clear error screen with:
- Explanation of the issue
- Step-by-step instructions to obtain an API key
- Configuration guidance
- Link to IBM Cloud IAM console

### API Errors

The application handles various API errors gracefully:
- Network errors
- Authentication failures
- Rate limiting
- Invalid account IDs
- Missing permissions

## Performance Optimization

### Caching Strategy

The application implements a multi-layer caching system:
1. **Memory Cache**: Fast in-memory storage for frequently accessed data
2. **File Cache**: Persistent storage for larger datasets
3. **Configurable TTLs**: Different cache durations for different data types

### Rate Limiting

Built-in rate limiting protects against API abuse:
- Default: 100 requests per 15 minutes
- Configurable via environment variables

## Development

### Running Tests

```bash
# Backend tests
cd backend
pnpm test

# Frontend tests
cd frontend
pnpm test
```

### Linting

```bash
# Lint all code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

### Type Checking

```bash
# Check TypeScript types
pnpm type-check
```

## Troubleshooting

### Backend won't start

1. Verify `IBM_CLOUD_API_KEY` is set in `backend/.env`
2. Check that the API key is valid (at least 40 characters)
3. Ensure Node.js version is 18 or higher
4. Check port 3000 is not already in use

### Frontend can't connect to backend

1. Verify backend is running on port 3000
2. Check `VITE_API_BASE_URL` in `frontend/.env`
3. Ensure CORS is properly configured in `backend/.env`

### No accounts showing up

1. Verify your API key has proper permissions
2. Check that you have access to at least one IBM Cloud account
3. Try setting `IBM_CLOUD_ACCOUNT_ID` manually in `backend/.env`

### Charts not exporting

1. Ensure you have a modern browser (Chrome, Firefox, Safari, Edge)
2. Check browser console for errors
3. Try a different export format

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or contributions, please open an issue on the GitHub repository.

## Acknowledgments

- Built with [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Express](https://expressjs.com/)
- Charts powered by [Recharts](https://recharts.org/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
- IBM Cloud integration via official SDKs
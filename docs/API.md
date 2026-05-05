# IBM Cloud Cost Tracking System - API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:3000` (development)  
**Last Updated:** 2026-05-04

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Error Handling](#error-handling)
5. [WebSocket Events](#websocket-events)
6. [API Endpoints](#api-endpoints)
   - [Health & Status](#health--status)
   - [Resources](#resources)
   - [Usage](#usage)
   - [Reports](#reports)
   - [Cache Management](#cache-management)

---

## Overview

The IBM Cloud Cost Tracking System API provides endpoints for:
- Collecting IBM Cloud resource data
- Retrieving usage and cost information
- Generating spending reports with forecasts
- Managing cache for optimal performance
- Real-time progress updates via WebSocket

### Key Features

- **RESTful Design**: Standard HTTP methods and status codes
- **Real-time Updates**: WebSocket support for report generation progress
- **Caching**: Multi-layer caching for improved performance
- **Rate Limiting**: Per-endpoint rate limits to prevent abuse
- **Validation**: Request validation using Zod schemas
- **Error Handling**: Consistent error response format

---

## Authentication

Currently, the API uses IBM Cloud API keys configured via environment variables. Future versions will support per-request authentication.

### Environment Variables

```bash
IBM_CLOUD_API_KEY=your_api_key_here
IBM_CLOUD_ACCOUNT_ID=your_account_id_here
```

---

## Rate Limiting

Rate limits are applied per IP address and vary by endpoint:

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Report Generation | 10 requests | 1 minute |
| Report Retrieval | 100 requests | 1 minute |
| Report Download | 50 requests | 1 minute |
| Resources | 50 requests | 1 minute |
| Usage | 50 requests | 1 minute |
| Cache Management | 20 requests | 1 minute |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1704067200
```

When rate limit is exceeded:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `REPORT_NOT_FOUND` | 404 | Report ID not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `REPORT_GENERATION_FAILED` | 500 | Report generation error |
| `IBM_CLOUD_ERROR` | 502 | IBM Cloud API error |

---

## WebSocket Events

Connect to WebSocket server at: `ws://localhost:3000/socket.io`

### Client Events

#### Join Room
```javascript
socket.emit('client:join-room', {
  room: 'report:uuid',
  userId: 'optional-user-id'
});
```

#### Leave Room
```javascript
socket.emit('client:leave-room', {
  room: 'report:uuid'
});
```

#### Cancel Report
```javascript
socket.emit('client:cancel-report', {
  reportId: 'uuid',
  reason: 'User cancelled'
});
```

### Server Events

#### Server Ready
```javascript
socket.on('server:ready', (data) => {
  // { timestamp, message, version }
});
```

#### Report Progress
```javascript
socket.on('report:progress', (data) => {
  // {
  //   reportId, status, progress, currentStep,
  //   estimatedTimeRemaining, timestamp
  // }
});
```

#### Report Complete
```javascript
socket.on('report:complete', (data) => {
  // {
  //   reportId, status: 'completed', message,
  //   timestamp, duration, reportUrl
  // }
});
```

#### Report Error
```javascript
socket.on('report:error', (data) => {
  // {
  //   reportId, status: 'failed',
  //   error: { code, message }, timestamp
  // }
});
```

---

## API Endpoints

### Health & Status

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-04T12:00:00.000Z",
  "uptime": 3600,
  "environment": "development",
  "websocketEnabled": true
}
```

#### GET /

API information.

**Response:**
```json
{
  "name": "IBM Cloud Cost Tracking System API",
  "version": "1.0.0",
  "status": "ready",
  "endpoints": {
    "health": "/health",
    "resources": "/api/resources",
    "usage": "/api/usage",
    "reports": "/api/reports",
    "cache": "/api/cache"
  }
}
```

---

### Resources

#### GET /api/resources

List all resources for an account.

**Query Parameters:**
- `accountId` (required): IBM Cloud account ID
- `resourceGroupId` (optional): Filter by resource group
- `refresh` (optional): Force refresh from IBM Cloud (default: false)
- `limit` (optional): Results per page (default: 50, max: 1000)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
GET /api/resources?accountId=abc123&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": {
    "resources": [
      {
        "id": "crn:v1:...",
        "guid": "uuid",
        "name": "my-resource",
        "regionId": "us-south",
        "resourceGroupId": "group-id",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "createdBy": "user@example.com",
        "state": "active"
      }
    ],
    "count": 100,
    "cachedAt": "2026-05-04T12:00:00.000Z"
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2026-05-04T12:00:00.000Z"
  }
}
```

---

### Usage

#### GET /api/usage

Get usage data for an account and time period.

**Query Parameters:**
- `accountId` (required): IBM Cloud account ID
- `month` (optional): Single month in YYYY-MM format
- `startMonth` (optional): Start month (requires endMonth)
- `endMonth` (optional): End month (requires startMonth)

**Example Request:**
```bash
GET /api/usage?accountId=abc123&startMonth=2026-01&endMonth=2026-03
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountId": "abc123",
    "startMonth": "2026-01",
    "endMonth": "2026-03",
    "months": [
      {
        "billingMonth": "2026-01",
        "totalCost": 1234.56,
        "currency": "USD",
        "resources": [...]
      }
    ],
    "totalCost": 3703.68,
    "currency": "USD"
  }
}
```

---

### Reports

#### POST /api/reports/user-spending

Generate a user spending report.

**Request Body:**
```json
{
  "accountId": "abc123",
  "period": "quarter",
  "dateRange": {
    "startDate": "2026-01-01",
    "endDate": "2026-03-31"
  },
  "filters": {
    "userEmails": ["user@example.com"],
    "serviceNames": ["cloud-object-storage"],
    "minCost": 10.0
  },
  "includeForecasts": true,
  "forecastMonths": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "uuid",
    "status": "processing",
    "estimatedTime": 30,
    "websocketRoom": "report:uuid"
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2026-05-04T12:00:00.000Z"
  }
}
```

#### POST /api/reports/team-spending

Generate a team spending report.

**Request Body:**
```json
{
  "accountId": "abc123",
  "teamName": "Engineering",
  "period": "year",
  "includeForecasts": true
}
```

**Response:** Same as user-spending

#### GET /api/reports/:reportId

Get a generated report by ID.

**Example Request:**
```bash
GET /api/reports/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report": {
      "type": "user-spending",
      "reportId": "uuid",
      "generatedAt": "2026-05-04T12:00:00.000Z",
      "accountId": "abc123",
      "period": "quarter",
      "users": [...],
      "topSpenders": [...],
      "summary": {
        "totalCost": 12345.67,
        "totalUsers": 25,
        "totalResources": 150,
        "averageCostPerUser": 493.83,
        "currency": "USD"
      },
      "costBreakdown": {...},
      "monthlyTrend": [...]
    },
    "status": "completed",
    "cachedAt": "2026-05-04T12:00:00.000Z"
  }
}
```

#### GET /api/reports/:reportId/download

Download a report in specified format.

**Query Parameters:**
- `format` (optional): json | csv (default: json)

**Example Request:**
```bash
GET /api/reports/uuid/download?format=csv
```

**Response:** File download with appropriate Content-Type header

---

### Cache Management

#### GET /api/cache/stats

Get cache statistics.

**Response:**
```json
{
  "stats": {
    "memory": {
      "hits": 1250,
      "misses": 150,
      "hitRate": 89.29,
      "size": 5242880,
      "keys": 42
    },
    "file": {
      "hits": 320,
      "misses": 80,
      "hitRate": 80.0,
      "size": 10485760,
      "files": 15
    },
    "overall": {
      "totalHits": 1570,
      "totalMisses": 230,
      "overallHitRate": 87.22
    }
  },
  "timestamp": "2026-05-04T12:00:00.000Z"
}
```

#### POST /api/cache/clear

Clear cache entries.

**Request Body (optional):**
```json
{
  "pattern": "resources:*"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 15,
  "timestamp": "2026-05-04T12:00:00.000Z"
}
```

---

## Request Examples

### cURL

```bash
# Generate user spending report
curl -X POST http://localhost:3000/api/reports/user-spending \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "abc123",
    "period": "month",
    "includeForecasts": true
  }'

# Get report
curl http://localhost:3000/api/reports/550e8400-e29b-41d4-a716-446655440000

# Download report as CSV
curl -O http://localhost:3000/api/reports/uuid/download?format=csv
```

### JavaScript (Fetch)

```javascript
// Generate report
const response = await fetch('http://localhost:3000/api/reports/user-spending', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'abc123',
    period: 'quarter',
    includeForecasts: true
  })
});

const { data } = await response.json();
console.log('Report ID:', data.reportId);

// Connect to WebSocket for progress
const socket = io('http://localhost:3000');
socket.emit('client:join-room', { room: `report:${data.reportId}` });

socket.on('report:progress', (progress) => {
  console.log(`Progress: ${progress.progress}% - ${progress.currentStep}`);
});

socket.on('report:complete', (result) => {
  console.log('Report complete!', result.reportUrl);
});
```

---

## Performance Considerations

- **Caching**: Reports are cached for 30 minutes
- **Pagination**: Use limit/offset for large result sets
- **Concurrent Requests**: System supports 10+ concurrent report generations
- **Timeouts**: Requests timeout after 60 seconds
- **WebSocket**: Use for long-running operations to avoid HTTP timeouts

---

## Support

For issues or questions:
- GitHub Issues: [repository-url]
- Documentation: [docs-url]
- Email: support@example.com

---

**Made with Bob**
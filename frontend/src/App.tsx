import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { ReportGenerator } from './pages/ReportGenerator';
import { ReportViewer } from './pages/ReportViewer';
import { UserSpending } from './pages/UserSpending';
import { ResourceGroupCosts } from './pages/ResourceGroupCosts';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AccountProvider } from './contexts/AccountContext';
import { websocketService } from './services/websocket.service';

// Create a client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    },
    mutations: {
      retry: 1,
    },
  },
});

// WebSocket initialization component
function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize WebSocket connection
    websocketService.connect();

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
    };
  }, []);

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AccountProvider>
          <WebSocketProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="reports">
                    <Route index element={<ReportViewer />} />
                    <Route path="generate" element={<ReportGenerator />} />
                    <Route path=":reportId" element={<ReportViewer />} />
                  </Route>
                  <Route path="user-spending" element={<UserSpending />} />
                  <Route path="resource-groups" element={<ResourceGroupCosts />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </WebSocketProvider>
        </AccountProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

// Made with Bob

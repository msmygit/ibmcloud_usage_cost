import React from 'react';
import { AlertCircle, Key, ExternalLink } from 'lucide-react';

interface ApiKeyErrorProps {
  message?: string;
}

export function ApiKeyError({ message }: ApiKeyErrorProps) {
  const defaultMessage = 'IBM Cloud API Key is not configured. The application cannot function without proper authentication.';

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-background rounded-lg shadow-lg border border-red-200 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-red-900">
                Configuration Error
              </h1>
              <p className="mt-1 text-sm text-red-700">
                Required IBM Cloud credentials are missing
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              {message || defaultMessage}
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center">
              <Key className="h-5 w-5 mr-2 text-blue-600" />
              How to Fix This
            </h2>

            <ol className="space-y-4 text-sm text-foreground">
              <li className="flex">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold mr-3">
                  1
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">
                    Create an IBM Cloud API Key
                  </p>
                  <p className="text-gray-600">
                    Go to the IBM Cloud console and create a new API key with appropriate permissions.
                  </p>
                  <a
                    href="https://cloud.ibm.com/iam/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Open IBM Cloud IAM
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </a>
                </div>
              </li>

              <li className="flex">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold mr-3">
                  2
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">
                    Configure the Backend
                  </p>
                  <p className="text-gray-600 mb-2">
                    Add your API key to the backend <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">.env</code> file:
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
                    <div className="text-green-400"># Required</div>
                    <div>IBM_CLOUD_API_KEY=your_api_key_here</div>
                    <div className="mt-2 text-green-400"># Optional - pre-select account</div>
                    <div>IBM_CLOUD_ACCOUNT_ID=your_account_id</div>
                  </div>
                </div>
              </li>

              <li className="flex">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold mr-3">
                  3
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">
                    Restart the Backend Server
                  </p>
                  <p className="text-gray-600">
                    After updating the <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">.env</code> file, restart the backend server for changes to take effect.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Additional Help */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-blue-800">
              For detailed setup instructions, refer to the project's README.md file or contact your system administrator.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}

// Made with Bob

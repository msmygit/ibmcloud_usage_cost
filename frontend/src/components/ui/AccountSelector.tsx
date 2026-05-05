import React, { useMemo, useState } from 'react';
import { useAccount } from '../../contexts/AccountContext';
import { LoadingSpinner } from './LoadingSpinner';

const ACCOUNT_ID_PATTERN = /^[a-zA-Z0-9:-]+$/;

export const AccountSelector: React.FC = () => {
  const { selectedAccount, setSelectedAccount, accounts, isLoading, error } = useAccount();
  const [manualMode, setManualMode] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualError, setManualError] = useState('');

  const trimmedManualAccountId = useMemo(() => manualAccountId.trim(), [manualAccountId]);

  const validateManualAccountId = (accountId: string): string | null => {
    if (!accountId) {
      return 'Account ID is required';
    }

    if (!ACCOUNT_ID_PATTERN.test(accountId)) {
      return 'Use only letters, numbers, colon, and hyphen';
    }

    return null;
  };

  const handleSetManualAccount = () => {
    const validationError = validateManualAccountId(trimmedManualAccountId);

    if (validationError) {
      setManualError(validationError);
      return;
    }

    setSelectedAccount({
      id: trimmedManualAccountId,
      name: trimmedManualAccountId,
      resourceGroupCount: 0,
    });
    setManualError('');
    setManualMode(false);
    setManualAccountId('');
  };

  const handleManualModeToggle = () => {
    setManualMode(true);
    setManualError('');
    setManualAccountId(selectedAccount?.resourceGroupCount === 0 ? selectedAccount.id : '');
  };

  const handleCancelManualMode = () => {
    setManualMode(false);
    setManualAccountId('');
    setManualError('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-muted-foreground">Loading accounts...</span>
      </div>
    );
  }

  if (manualMode) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1">
          <label htmlFor="manual-account-id" className="text-sm font-medium text-foreground">
            Account ID:
          </label>
          <input
            id="manual-account-id"
            type="text"
            value={manualAccountId}
            onChange={(e) => {
              setManualAccountId(e.target.value);
              if (manualError) {
                setManualError('');
              }
            }}
            placeholder="Enter IBM Cloud Account ID"
            className="block rounded-md border border-border px-3 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-background text-foreground"
          />
          {manualError && <span className="text-xs text-destructive">{manualError}</span>}
        </div>
        <div className="flex items-center gap-2 pt-0 sm:pt-6">
          <button
            type="button"
            onClick={handleSetManualAccount}
            disabled={!trimmedManualAccountId}
            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-muted"
          >
            Set
          </button>
          <button
            type="button"
            onClick={handleCancelManualMode}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (error || accounts.length === 0) {
    const errorMessage = error
      ? (error as any)?.message || 'Failed to load accounts'
      : 'No accounts found';
    
    const showRetry = error && !(error as any)?.message?.includes('IBM_CLOUD_ACCOUNT_ID');
    
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {errorMessage}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showRetry && (
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-sm text-blue-600 underline hover:text-blue-500"
              >
                Retry
              </button>
              <span className="text-sm text-muted-foreground">|</span>
            </>
          )}
          <button
            type="button"
            onClick={handleManualModeToggle}
            className="text-sm text-blue-600 underline hover:text-blue-500"
          >
            Enter account ID manually
          </button>
        </div>
        {error && (error as any)?.suggestion && (
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as any).suggestion}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="account-selector" className="text-sm font-medium text-foreground">
        Account:
      </label>
      <select
        id="account-selector"
        value={selectedAccount?.id || ''}
        onChange={(e) => {
          const account = accounts.find(a => a.id === e.target.value);
          setSelectedAccount(account || null);
        }}
        className="block rounded-md border border-border bg-background px-3 py-1 shadow-sm text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} ({account.resourceGroupCount} resource groups)
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleManualModeToggle}
        className="text-sm text-muted-foreground hover:text-foreground"
        title="Enter account ID manually"
      >
        ✏️
      </button>
    </div>
  );
};

// Made with Bob

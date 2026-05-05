import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api.service';
import { ApiKeyError } from '../components/ui/ApiKeyError';
import { Account } from '../types/api.types';

interface AccountContextType {
  selectedAccount: Account | null;
  setSelectedAccount: (account: Account | null) => void;
  accounts: Account[];
  isLoading: boolean;
  error: Error | null;
  accountSource: 'api' | 'environment' | 'manual' | null;
  accountWarning: string | null;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [manualAccounts, setManualAccounts] = useState<Account[]>([]);

  // Fetch accounts on mount
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiService.getAccounts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const autoDiscoveredAccounts = data?.accounts || [];
  const accounts = [...autoDiscoveredAccounts, ...manualAccounts];
  const accountSource = (data as any)?.source || null;
  const accountWarning = (data as any)?.warning || null;

  // Auto-select first account if none selected
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      const firstAccount = accounts[0];
      if (firstAccount) {
        setSelectedAccount(firstAccount);
      }
    }
  }, [accounts, selectedAccount]);

  const setSelectedAccountEnhanced = (account: Account | null) => {
    if (account && !accounts.find((existingAccount) => existingAccount.id === account.id)) {
      setManualAccounts((previousAccounts) => [...previousAccounts, account]);
    }

    setSelectedAccount(account);
  };

  // Check for API key configuration error
  const isApiKeyError = error && (
    (error as any)?.message?.includes('IBM_CLOUD_API_KEY') ||
    (error as any)?.message?.includes('API key') ||
    (error as any)?.message?.includes('credentials not configured')
  );

  // Show API key error screen if configuration is missing
  if (isApiKeyError) {
    return <ApiKeyError message={(error as any)?.message} />;
  }

  return (
    <AccountContext.Provider
      value={{
        selectedAccount,
        setSelectedAccount: setSelectedAccountEnhanced,
        accounts,
        isLoading,
        error: error as Error | null,
        accountSource,
        accountWarning,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
};

// Made with Bob

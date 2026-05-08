/**
 * Active Resources Page
 * Lists all active IBM Cloud resources grouped by creator
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Package, User, AlertCircle, ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAccount } from '../contexts/AccountContext';
import { formatDate } from '../utils/formatters';

interface CreatorProfile {
  iamId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface Resource {
  id: string;
  guid: string;
  name: string;
  crn: string;
  state: string;
  regionId?: string;
  resourceGroupId?: string;
  resourcePlanId?: string;
  targetCrn?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
  creatorProfile?: CreatorProfile;
  resourceId?: string; // The actual resource type (e.g., "is.floating-ip")
}

interface CreatorGroup {
  creatorKey: string;
  creatorProfile: CreatorProfile | null;
  resourceCount: number;
  resources: Resource[];
}

interface ActiveResourcesResponse {
  accountId: string;
  state: string;
  totalResources: number;
  creatorCount: number;
  creatorGroups: CreatorGroup[];
}

export function ActiveResources() {
  const { selectedAccount } = useAccount();
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
  const [detailedResources, setDetailedResources] = useState<Map<string, any>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Fetch active resources grouped by creator
  const { data, isLoading, error } = useQuery<ActiveResourcesResponse>({
    queryKey: ['active-resources-by-creator', selectedAccount?.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/resources/by-creator?accountId=${selectedAccount!.id}&state=active`
      );
      if (!response.ok) throw new Error('Failed to fetch active resources');
      const result = await response.json();
      
      // Debug: Log first resource to see what fields are available
      if (result.creatorGroups?.[0]?.resources?.[0]) {
        console.log('First resource data:', result.creatorGroups[0].resources[0]);
      }
      
      return result;
    },
    enabled: !!selectedAccount,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation to fetch detailed resource information
  const fetchDetailsMutation = useMutation({
    mutationFn: async (resourceIds: string[]) => {
      const response = await fetch('/api/resources/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceIds }),
      });
      if (!response.ok) throw new Error('Failed to fetch resource details');
      return response.json();
    },
  });

  const toggleCreator = async (creatorKey: string, resources: Resource[]) => {
    const isCurrentlyExpanded = expandedCreators.has(creatorKey);
    
    setExpandedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorKey)) {
        next.delete(creatorKey);
      } else {
        next.add(creatorKey);
      }
      return next;
    });

    // If expanding and we don't have details yet, fetch them
    if (!isCurrentlyExpanded && resources.length > 0) {
      const resourceIds = resources.map(r => r.id);
      const hasDetails = resourceIds.every(id => detailedResources.has(id));
      
      if (!hasDetails) {
        setLoadingDetails(prev => new Set(prev).add(creatorKey));
        
        try {
          const result = await fetchDetailsMutation.mutateAsync(resourceIds);
          
          // Store the detailed information
          setDetailedResources(prev => {
            const next = new Map(prev);
            result.results.forEach((r: any) => {
              if (r.details) {
                next.set(r.resourceId, r.details);
              }
            });
            return next;
          });
        } catch (error) {
          console.error('Failed to fetch resource details:', error);
        } finally {
          setLoadingDetails(prev => {
            const next = new Set(prev);
            next.delete(creatorKey);
            return next;
          });
        }
      }
    }
  };

  const expandAll = () => {
    if (data?.creatorGroups) {
      setExpandedCreators(new Set(data.creatorGroups.map((g) => g.creatorKey)));
    }
  };

  const collapseAll = () => {
    setExpandedCreators(new Set());
  };

  if (!selectedAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Active Resources</h1>
          <p className="mt-2 text-sm text-muted-foreground">View all active resources grouped by creator</p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <div className="max-w-md mx-auto text-center">
            <Package className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Select an Account</h2>
            <p className="text-sm text-muted-foreground">
              Please select an IBM Cloud account from the dropdown in the header to view active resources.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Active Resources</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          All active IBM Cloud resources grouped by creator
        </p>
      </div>

      {/* Account Info */}
      <div className="bg-muted border border-border rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-primary font-medium">Current Account</p>
            <p className="text-sm text-foreground font-mono">{selectedAccount.id}</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" message="Loading active resources..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Failed to load active resources</p>
            <p className="text-red-700 text-sm mt-1">
              {(error as any)?.message || 'An error occurred'}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && data && (
        <>
          {/* Summary */}
          <div className="bg-card rounded-lg shadow-lg border-2 border-primary/20 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Active Resources</p>
                <p className="text-3xl font-bold text-blue-600">{data.totalResources}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Unique Creators</p>
                <p className="text-3xl font-bold text-green-600">{data.creatorCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Resource State</p>
                <p className="text-3xl font-bold text-purple-600 capitalize">{data.state}</p>
              </div>
            </div>
            
            {/* Important Note */}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Resource names shown may be incomplete due to IBM Cloud API limitations.
                To find the actual resource name, copy the CRN and search using:
                <code className="ml-1 px-1 py-0.5 bg-yellow-100 rounded text-xs font-mono">
                  ibmcloud resource search "crn:\"{'<paste-crn-here>'}\""
                </code>
              </p>
            </div>
          </div>

          {/* Expand/Collapse Controls */}
          {data.creatorGroups.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Collapse All
              </button>
            </div>
          )}

          {/* Creator Groups */}
          <div className="space-y-4">
            {data.creatorGroups.length === 0 ? (
              <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active resources found</p>
              </div>
            ) : (
              data.creatorGroups.map((group) => {
                const isExpanded = expandedCreators.has(group.creatorKey);
                const displayName = group.creatorProfile?.email || 
                                   group.creatorProfile?.iamId || 
                                   group.creatorKey;

                return (
                  <div
                    key={group.creatorKey}
                    className="bg-card rounded-lg shadow-lg border border-border overflow-hidden"
                  >
                    {/* Creator Header */}
                    <button
                      onClick={() => toggleCreator(group.creatorKey, group.resources)}
                      className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      disabled={loadingDetails.has(group.creatorKey)}
                    >
                      <div className="flex items-center gap-4">
                        <User className="h-6 w-6 text-blue-600 flex-shrink-0" />
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {group.creatorProfile?.firstName && group.creatorProfile?.lastName
                                ? `${group.creatorProfile.firstName} ${group.creatorProfile.lastName}`
                                : displayName}
                            </h3>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {group.resourceCount} {group.resourceCount === 1 ? 'resource' : 'resources'}
                            </span>
                          </div>
                          {group.creatorProfile?.email && (
                            <p className="text-sm text-muted-foreground font-mono mt-1">
                              {group.creatorProfile.email}
                            </p>
                          )}
                          {group.creatorProfile?.iamId && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              IAM ID: {group.creatorProfile.iamId}
                            </p>
                          )}
                        </div>
                      </div>
                      {loadingDetails.has(group.creatorKey) ? (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      ) : isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* Resources List */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        <div className="p-6 space-y-4">
                          {/* Sort resources by creation date (newest first) */}
                          {[...group.resources]
                            .sort((a, b) => {
                              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                              return dateB - dateA; // Newest first
                            })
                            .map((resource) => {
                            const details = detailedResources.get(resource.id);
                            
                            return (
                            <div
                              key={resource.id}
                              className="bg-muted/50 rounded-lg p-4 border border-border"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  {/* Header with name, state, and creation date */}
                                  <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Package className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                      <h4 className="font-semibold text-foreground truncate">
                                        {resource.name}
                                      </h4>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                                        resource.state === 'active'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {resource.state}
                                      </span>
                                    </div>
                                    <div className="text-sm font-medium text-blue-600 flex-shrink-0">
                                      Created: {resource.createdAt ? formatDate(resource.createdAt) : 'N/A'}
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                    {(details?.resource_id || resource.resourceId || details?.resource_type || details?.type) && (
                                      <div>
                                        <span className="text-muted-foreground">Type:</span>
                                        <span className="ml-2 text-foreground font-mono text-xs">
                                          {details?.resource_id || resource.resourceId || details?.resource_type || details?.type}
                                        </span>
                                      </div>
                                    )}
                                    {resource.regionId && (
                                      <div>
                                        <span className="text-muted-foreground">Region:</span>
                                        <span className="ml-2 text-foreground">{resource.regionId}</span>
                                      </div>
                                    )}
                                    <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                                      <span className="text-muted-foreground font-medium">Created:</span>
                                      <span className="ml-2 text-foreground font-semibold">
                                        {resource.createdAt ? formatDate(resource.createdAt) : 'Date not available'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">ID:</span>
                                      <span className="ml-2 font-mono text-xs text-foreground">{resource.id}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">GUID:</span>
                                      <span className="ml-2 font-mono text-xs text-foreground">{resource.guid}</span>
                                    </div>
                                    {resource.resourceGroupId && (
                                      <div>
                                        <span className="text-muted-foreground">Resource Group ID:</span>
                                        <span className="ml-2 font-mono text-xs text-foreground">{resource.resourceGroupId}</span>
                                      </div>
                                    )}
                                    {resource.resourcePlanId && (
                                      <div>
                                        <span className="text-muted-foreground">Plan ID:</span>
                                        <span className="ml-2 font-mono text-xs text-foreground">{resource.resourcePlanId}</span>
                                      </div>
                                    )}
                                    {resource.createdBy && (
                                      <div className="col-span-2">
                                        <span className="text-muted-foreground">Created By:</span>
                                        <span className="ml-2 font-mono text-xs text-foreground">{resource.createdBy}</span>
                                      </div>
                                    )}
                                    {resource.updatedAt && (
                                      <div className="col-span-2">
                                        <span className="text-muted-foreground">Last Updated:</span>
                                        <span className="ml-2 text-foreground">{formatDate(resource.updatedAt)}</span>
                                      </div>
                                    )}
                                    {resource.tags && resource.tags.length > 0 && (
                                      <div className="col-span-2">
                                        <span className="text-muted-foreground">Tags:</span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {resource.tags.map((tag, idx) => (
                                            <span key={idx} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {resource.crn && (
                                    <div className="mt-2">
                                      <span className="text-xs text-muted-foreground">CRN:</span>
                                      <p className="font-mono text-xs text-foreground break-all mt-1">
                                        {resource.crn}
                                      </p>
                                    </div>
                                  )}

                                  {resource.targetCrn && (
                                    <div className="mt-2">
                                      <span className="text-xs text-muted-foreground">Target CRN:</span>
                                      <p className="font-mono text-xs text-foreground break-all mt-1">
                                        {resource.targetCrn}
                                      </p>
                                    </div>
                                  )}

                                  {resource.extensions && Object.keys(resource.extensions).length > 0 && (
                                    <div className="mt-2">
                                      <span className="text-xs text-muted-foreground">Extensions:</span>
                                      <pre className="font-mono text-xs text-foreground bg-muted p-2 rounded mt-1 overflow-x-auto">
                                        {JSON.stringify(resource.extensions, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>

                                <a
                                  href={`https://cloud.ibm.com/resources/${resource.guid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View in IBM Cloud Console"
                                >
                                  <ExternalLink className="h-5 w-5" />
                                </a>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Made with Bob

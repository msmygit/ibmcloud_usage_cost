import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Package, Layers, DollarSign, User, Search } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import type {
  HierarchicalCostBreakdown,
  ResourceGroupAggregation,
  CreatorAggregation,
  TypeAggregation,
  SubTypeAggregation,
  ResourceCostDetail,
} from '../../types/api.types';

interface HierarchicalCostTreeProps {
  data: HierarchicalCostBreakdown;
  timeframe: string;
}

export function HierarchicalCostTree({ data, timeframe }: HierarchicalCostTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter resource groups based on search query
  const filteredResourceGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return data.resourceGroups;
    }

    const query = searchQuery.toLowerCase();
    return data.resourceGroups
      .map((rg) => {
        // Filter creators within this resource group
        const filteredCreators = rg.creators
          .map((creator) => {
            // Filter types within this creator
            const filteredTypes = creator.types
              .map((type) => {
                // Filter subTypes within this type
                const filteredSubTypes = type.subTypes
                  .map((subType) => {
                    // Filter resources within this subType
                    const filteredResources = subType.resources.filter(
                      (resource) =>
                        resource.resourceName.toLowerCase().includes(query) ||
                        resource.resourceId.toLowerCase().includes(query) ||
                        resource.resourceType.toLowerCase().includes(query) ||
                        (resource.region && resource.region.toLowerCase().includes(query)) ||
                        (resource.creatorEmail && resource.creatorEmail.toLowerCase().includes(query))
                    );

                    if (filteredResources.length > 0) {
                      return {
                        ...subType,
                        resources: filteredResources,
                        resourceCount: filteredResources.length,
                        cost: filteredResources.reduce((sum, r) => sum + r.cost, 0),
                      };
                    }
                    return null;
                  })
                  .filter((st): st is NonNullable<typeof st> => st !== null);

                if (filteredSubTypes.length > 0) {
                  return {
                    ...type,
                    subTypes: filteredSubTypes,
                    resourceCount: filteredSubTypes.reduce((sum, st) => sum + st.resourceCount, 0),
                    cost: filteredSubTypes.reduce((sum, st) => sum + st.cost, 0),
                  };
                }
                return null;
              })
              .filter((t): t is NonNullable<typeof t> => t !== null);

            if (filteredTypes.length > 0) {
              return {
                ...creator,
                types: filteredTypes,
                resourceCount: filteredTypes.reduce((sum, t) => sum + t.resourceCount, 0),
                cost: filteredTypes.reduce((sum, t) => sum + t.cost, 0),
              };
            }
            return null;
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (filteredCreators.length > 0) {
          return {
            ...rg,
            creators: filteredCreators,
            resourceCount: filteredCreators.reduce((sum, c) => sum + c.resourceCount, 0),
            cost: filteredCreators.reduce((sum, c) => sum + c.cost, 0),
          };
        }
        return null;
      })
      .filter((rg): rg is NonNullable<typeof rg> => rg !== null);
  }, [data.resourceGroups, searchQuery]);

  const filteredTotalCost = useMemo(() => {
    return filteredResourceGroups.reduce((sum, rg) => sum + rg.cost, 0);
  }, [filteredResourceGroups]);

  const filteredTotalResources = useMemo(() => {
    return filteredResourceGroups.reduce((sum, rg) => sum + rg.resourceCount, 0);
  }, [filteredResourceGroups]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-foreground flex items-center">
          <Layers className="h-6 w-6 text-purple-600 mr-2" />
          Hierarchical Cost Breakdown ({timeframe})
        </h3>
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-bold text-foreground">{formatCurrency(data.totalCost)}</span>
          {' • '}
          {formatNumber(data.totalResourceCount, 0)} resources
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by resource name, ID, type, region, or creator..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtered Results Summary */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2">
          Showing {filteredResourceGroups.length} resource group(s), {filteredTotalResources} resource(s), {formatCurrency(filteredTotalCost)} total
        </div>
      )}

      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
        {filteredResourceGroups.length > 0 ? (
          filteredResourceGroups.map((resourceGroup) => (
            <ResourceGroupNode key={resourceGroup.resourceGroupId} resourceGroup={resourceGroup} />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No resources found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceGroupNode({ resourceGroup }: { resourceGroup: ResourceGroupAggregation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-5 w-5 text-blue-600 flex-shrink-0" />
          ) : (
            <Folder className="h-5 w-5 text-blue-600 flex-shrink-0" />
          )}
          <div className="flex-1 text-left">
            <div className="font-semibold text-foreground">{resourceGroup.resourceGroupName}</div>
            <div className="text-xs text-muted-foreground font-mono">{resourceGroup.resourceGroupId}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Resources</div>
            <div className="font-semibold text-foreground">{formatNumber(resourceGroup.resourceCount, 0)}</div>
          </div>
          <div className="text-right min-w-[120px]">
            <div className="text-sm text-muted-foreground">Cost</div>
            <div className="font-bold text-blue-600">{formatCurrency(resourceGroup.cost)}</div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          <div className="ml-8 space-y-2">
            {resourceGroup.creators.map((creator) => (
              <CreatorNode key={creator.creatorEmail} creator={creator} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreatorNode({ creator }: { creator: CreatorAggregation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine if we should show a sub-label for IBMid or ServiceId
  const isIBMid = creator.creatorEmail.startsWith('IBMid-');
  const isServiceId = creator.creatorEmail.startsWith('iam-ServiceId-');
  const showSubLabel = isIBMid || isServiceId;
  
  // Get the sub-label text to display beneath the creator ID
  const getSubLabelText = () => {
    // For IBMid, show the actual email if available
    if (isIBMid && creator.creatorDisplayEmail && creator.creatorDisplayEmail !== creator.creatorEmail) {
      return creator.creatorDisplayEmail;
    }
    
    // For ServiceId, show the email or 'unknown'
    if (isServiceId) {
      if (creator.creatorDisplayEmail && creator.creatorDisplayEmail !== creator.creatorEmail && creator.creatorDisplayEmail !== 'unknown') {
        return creator.creatorDisplayEmail;
      }
      return 'unknown';
    }
    
    return null;
  };

  const subLabelText = getSubLabelText();

  return (
    <div className="border border-border rounded-lg bg-card/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-medium text-foreground text-sm">{creator.creatorEmail}</div>
            {showSubLabel && subLabelText && (
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                {subLabelText}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Resources</div>
            <div className="font-medium text-foreground text-sm">{formatNumber(creator.resourceCount, 0)}</div>
          </div>
          <div className="text-right min-w-[120px]">
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="font-semibold text-blue-500 text-sm">{formatCurrency(creator.cost)}</div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-2 space-y-2">
          <div className="ml-6 space-y-2">
            {creator.types.map((type) => (
              <TypeNode key={type.type} type={type} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TypeNode({ type }: { type: TypeAggregation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-card/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <Package className="h-4 w-4 text-green-600 flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-medium text-foreground text-sm">{type.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Resources</div>
            <div className="font-medium text-foreground text-sm">{formatNumber(type.resourceCount, 0)}</div>
          </div>
          <div className="text-right min-w-[120px]">
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="font-semibold text-green-600 text-sm">{formatCurrency(type.cost)}</div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-2 space-y-2">
          <div className="ml-6 space-y-2">
            {type.subTypes.map((subType) => (
              <SubTypeNode key={subType.subType} subType={subType} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubTypeNode({ subType }: { subType: SubTypeAggregation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-card/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <Layers className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
          <div className="flex-1 text-left">
            <div className="font-medium text-foreground text-sm">{subType.subType}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Resources</div>
            <div className="font-medium text-foreground text-sm">{formatNumber(subType.resourceCount, 0)}</div>
          </div>
          <div className="text-right min-w-[120px]">
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="font-semibold text-purple-600 text-sm">{formatCurrency(subType.cost)}</div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-2">
          <div className="ml-5 space-y-1">
            {subType.resources.map((resource) => (
              <ResourceNode key={resource.resourceId} resource={resource} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceNode({ resource }: { resource: ResourceCostDetail }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border border-border rounded bg-background/50">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-muted/10 transition-colors rounded text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <DollarSign className="h-3 w-3 text-orange-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground text-xs truncate">{resource.resourceName}</div>
          </div>
        </div>
        <div className="text-right min-w-[120px] ml-2">
          <div className="font-semibold text-orange-600 text-xs">{formatCurrency(resource.cost)}</div>
        </div>
      </button>

      {showDetails && (
        <div className="px-3 pb-2 pt-1 border-t border-border bg-muted/10">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">ID:</span>
              <span className="ml-1 font-mono text-foreground">{resource.resourceId}</span>
            </div>
            {resource.creatorEmail && (
              <div>
                <span className="text-muted-foreground">Creator:</span>
                <span className="ml-1 font-mono text-foreground">{resource.creatorEmail}</span>
              </div>
            )}
            {resource.region && (
              <div>
                <span className="text-muted-foreground">Region:</span>
                <span className="ml-1 text-foreground">{resource.region}</span>
              </div>
            )}
            {resource.createdAt && (
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-1 text-foreground">{new Date(resource.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Made with Bob

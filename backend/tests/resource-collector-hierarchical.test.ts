import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceCollectorService } from '../src/services/resource-collector.service';
import type { ResourceInstance, UsageResourceRecord } from '../src/types/ibm-cloud.types';

describe('ResourceCollectorService - Hierarchical Cost Breakdown', () => {
  let service: ResourceCollectorService;

  beforeEach(() => {
    // Mock client - not needed for these tests
    const mockClient = {} as any;
    service = new ResourceCollectorService(mockClient);
  });

  describe('createHierarchicalCostBreakdown', () => {
    it('should create hierarchical breakdown with proper cost aggregation', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
          createdBy: 'user1@example.com',
        },
        {
          id: 'res-2',
          guid: 'guid-2',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 2',
          type: 'service_instance',
          subType: 'standard',
          resourceGroupId: 'rg-1',
          createdBy: 'user1@example.com',
        },
        {
          id: 'res-3',
          guid: 'guid-3',
          crn: 'crn:v1:bluemix:public:service2:::',
          name: 'Resource 3',
          type: 'cf_application',
          subType: 'default',
          resourceGroupId: 'rg-2',
          createdBy: 'user2@example.com',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [
        {
          resource_id: 'res-1',
          resource_instance_id: 'guid-1',
          billable_cost: 100,
          non_billable_cost: 10,
          currency: 'USD',
        },
        {
          resource_id: 'res-2',
          resource_instance_id: 'guid-2',
          billable_cost: 200,
          non_billable_cost: 20,
          currency: 'USD',
        },
        {
          resource_id: 'res-3',
          resource_instance_id: 'guid-3',
          billable_cost: 300,
          non_billable_cost: 30,
          currency: 'USD',
        },
      ];

      const resourceGroupNames = new Map([
        ['rg-1', 'Resource Group 1'],
        ['rg-2', 'Resource Group 2'],
      ]);

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(
        resources,
        usageRecords,
        resourceGroupNames,
      );

      // Assert
      expect(breakdown).toBeDefined();
      expect(breakdown.totalCost).toBe(660); // 110 + 220 + 330
      expect(breakdown.totalResourceCount).toBe(3);
      expect(breakdown.currency).toBe('USD');
      expect(breakdown.resourceGroups).toHaveLength(2);
    });

    it('should properly aggregate costs at sub-type level', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
        },
        {
          id: 'res-2',
          guid: 'guid-2',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 2',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [
        {
          resource_id: 'res-1',
          billable_cost: 50,
          non_billable_cost: 5,
          currency: 'USD',
        },
        {
          resource_id: 'res-2',
          billable_cost: 75,
          non_billable_cost: 7.5,
          currency: 'USD',
        },
      ];

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(resources, usageRecords);

      // Assert
      const resourceGroup = breakdown.resourceGroups[0];
      expect(resourceGroup).toBeDefined();
      
      // Navigate through creator level (new hierarchy)
      const creator = resourceGroup.creators[0];
      expect(creator).toBeDefined();
      
      const type = creator.types[0];
      expect(type.type).toBe('service_instance');
      expect(type.cost).toBe(137.5); // 55 + 82.5
      
      const subType = type.subTypes[0];
      expect(subType.subType).toBe('lite');
      expect(subType.cost).toBe(137.5);
      expect(subType.resourceCount).toBe(2);
      expect(subType.resources).toHaveLength(2);
    });

    it('should properly aggregate costs at type level from multiple sub-types', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
        },
        {
          id: 'res-2',
          guid: 'guid-2',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 2',
          type: 'service_instance',
          subType: 'standard',
          resourceGroupId: 'rg-1',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [
        {
          resource_id: 'res-1',
          billable_cost: 100,
          currency: 'USD',
        },
        {
          resource_id: 'res-2',
          billable_cost: 200,
          currency: 'USD',
        },
      ];

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(resources, usageRecords);

      // Assert
      const resourceGroup = breakdown.resourceGroups[0];
      const creator = resourceGroup.creators[0];
      const type = creator.types[0];
      
      expect(type.type).toBe('service_instance');
      expect(type.cost).toBe(300); // Rolled up from both sub-types
      expect(type.resourceCount).toBe(2);
      expect(type.subTypes).toHaveLength(2);
      
      // Verify sub-type costs sum to type cost
      const subTypeCostSum = type.subTypes.reduce((sum: number, st) => sum + st.cost, 0);
      expect(subTypeCostSum).toBe(type.cost);
    });

    it('should properly aggregate costs at resource group level', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
        },
        {
          id: 'res-2',
          guid: 'guid-2',
          crn: 'crn:v1:bluemix:public:service2:::',
          name: 'Resource 2',
          type: 'cf_application',
          subType: 'default',
          resourceGroupId: 'rg-1',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [
        {
          resource_id: 'res-1',
          billable_cost: 150,
          currency: 'USD',
        },
        {
          resource_id: 'res-2',
          billable_cost: 250,
          currency: 'USD',
        },
      ];

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(resources, usageRecords);

      // Assert
      const resourceGroup = breakdown.resourceGroups[0];
      
      expect(resourceGroup.cost).toBe(400); // Rolled up from both types
      expect(resourceGroup.resourceCount).toBe(2);
      
      // With new hierarchy, types are under creators
      const creator = resourceGroup.creators[0];
      expect(creator.types).toHaveLength(2);
      
      // Verify type costs sum to creator cost
      const typeCostSum = creator.types.reduce((sum: number, t) => sum + t.cost, 0);
      expect(typeCostSum).toBe(creator.cost);
      
      // Verify creator costs sum to resource group cost
      const creatorCostSum = resourceGroup.creators.reduce((sum: number, c) => sum + c.cost, 0);
      expect(creatorCostSum).toBe(resourceGroup.cost);
    });

    it('should maintain creator email relationship across all aggregation tiers', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
          createdBy: 'user1@example.com',
        },
        {
          id: 'res-2',
          guid: 'guid-2',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 2',
          type: 'service_instance',
          subType: 'standard',
          resourceGroupId: 'rg-1',
          createdBy: 'user2@example.com',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [
        {
          resource_id: 'res-1',
          billable_cost: 100,
          currency: 'USD',
        },
        {
          resource_id: 'res-2',
          billable_cost: 200,
          currency: 'USD',
        },
      ];

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(resources, usageRecords);

      // Assert
      const resourceGroup = breakdown.resourceGroups[0];
      expect(resourceGroup.creators).toHaveLength(2);
      
      const creator1 = resourceGroup.creators.find(c => c.creatorEmail === 'user1@example.com');
      const creator2 = resourceGroup.creators.find(c => c.creatorEmail === 'user2@example.com');
      
      expect(creator1).toBeDefined();
      expect(creator1!.cost).toBe(100);
      expect(creator1!.resourceCount).toBe(1);
      
      expect(creator2).toBeDefined();
      expect(creator2!.cost).toBe(200);
      expect(creator2!.resourceCount).toBe(1);
      
      // Verify creator costs sum to resource group cost
      const creatorCostSum = resourceGroup.creators.reduce((sum: number, c) => sum + c.cost, 0);
      expect(creatorCostSum).toBe(resourceGroup.cost);
    });

    it('should handle resources without usage records', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'service_instance',
          subType: 'lite',
          resourceGroupId: 'rg-1',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [];

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(resources, usageRecords);

      // Assert
      expect(breakdown.totalCost).toBe(0);
      expect(breakdown.totalResourceCount).toBe(1);
      expect(breakdown.resourceGroups).toHaveLength(1);
      
      const resourceGroup = breakdown.resourceGroups[0];
      expect(resourceGroup.cost).toBe(0);
      expect(resourceGroup.resourceCount).toBe(1);
    });

    it('should sort resource groups, types, and sub-types by cost descending', () => {
      // Arrange
      const resources: ResourceInstance[] = [
        {
          id: 'res-1',
          guid: 'guid-1',
          crn: 'crn:v1:bluemix:public:service1:::',
          name: 'Resource 1',
          type: 'type-a',
          subType: 'subtype-1',
          resourceGroupId: 'rg-1',
        },
        {
          id: 'res-2',
          guid: 'guid-2',
          crn: 'crn:v1:bluemix:public:service2:::',
          name: 'Resource 2',
          type: 'type-b',
          subType: 'subtype-2',
          resourceGroupId: 'rg-2',
        },
      ];

      const usageRecords: UsageResourceRecord[] = [
        {
          resource_id: 'res-1',
          billable_cost: 100,
          currency: 'USD',
        },
        {
          resource_id: 'res-2',
          billable_cost: 300,
          currency: 'USD',
        },
      ];

      // Act
      const breakdown = service.createHierarchicalCostBreakdown(resources, usageRecords);

      // Assert - Resource groups sorted by cost descending
      expect(breakdown.resourceGroups[0].cost).toBeGreaterThan(breakdown.resourceGroups[1].cost);
      expect(breakdown.resourceGroups[0].resourceGroupId).toBe('rg-2');
      expect(breakdown.resourceGroups[1].resourceGroupId).toBe('rg-1');
    });
  });
});

// Made with Bob

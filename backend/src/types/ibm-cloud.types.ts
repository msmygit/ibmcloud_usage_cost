export interface IBMCloudToken {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenType: string;
  readonly expiration: number;
  readonly expiresAt: Date;
}

export interface IBMCloudServiceResponse<T> {
  readonly result: T;
  readonly status: number;
  readonly headers?: Record<string, string>;
}

export interface IBMCloudPagination {
  readonly nextUrl?: string | null;
  readonly start?: string | null;
  readonly offset?: number;
  readonly limit?: number;
  readonly count?: number;
}

export interface ResourceInstance {
  readonly id: string;
  readonly guid: string;
  readonly crn: string;
  readonly name: string;
  readonly regionId?: string;
  readonly resourceGroupId?: string;
  readonly resourcePlanId?: string;
  readonly targetCrn?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly createdBy?: string;
  readonly state?: string;
  readonly type?: string;
  readonly subType?: string;
  readonly tags?: string[];
  readonly extensions?: Record<string, unknown>;
  readonly creatorProfile?: {
    readonly iamId?: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
}

export interface ResourceInstancesList {
  readonly resources: ResourceInstance[];
  readonly next_url?: string;
}

export interface ResourceGroup {
  readonly id: string;
  readonly crn: string;
  readonly account_id: string;
  readonly name: string;
  readonly state?: string;
  readonly default?: boolean;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface ResourceGroupsList {
  readonly resources: ResourceGroup[];
}

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly resourceGroupCount: number;
}

export interface UsageAccountSummary {
  readonly account_id: string;
  readonly month: string;
  readonly billing_country_code?: string;
  readonly billing_currency_code?: string;
  readonly pricing_country?: string;
  readonly currency_code?: string;
  readonly currency_rate?: number;
  readonly resources: AccountResource[];
}

export interface AccountResource {
  readonly resource_id: string;
  readonly resource_name?: string;
  readonly billable_cost: number;
  readonly billable_rated_cost: number;
  readonly non_billable_cost: number;
  readonly non_billable_rated_cost: number;
  readonly plans?: ResourcePlan[];
  readonly discounts?: Discount[];
}

export interface Discount {
  readonly ref: string;
  readonly name: string;
  readonly display_name?: string;
  readonly discount: number;
}

export interface ResourcePlan {
  readonly plan_id: string;
  readonly plan_name?: string;
  readonly pricing_region?: string;
  readonly billable: boolean;
  readonly cost: number;
  readonly rated_cost: number;
  readonly usage?: PlanUsage[];
}

export interface PlanUsage {
  readonly metric: string;
  readonly unit: string;
  readonly quantity: number;
  readonly rateable_quantity: number;
  readonly cost: number;
  readonly rated_cost: number;
  readonly price?: number[];
}

export interface UsageResourceRecord {
  readonly resource_id?: string;
  readonly resource_instance_id?: string;
  readonly resource_name?: string;
  readonly billable_cost?: number;
  readonly non_billable_cost?: number;
  readonly billable_charges?: number; // Legacy field name for backward compatibility
  readonly non_billable_charges?: number; // Legacy field name for backward compatibility
  readonly currency?: string;
  readonly plan_name?: string;
  readonly pricing_region?: string;
  readonly resource_group_name?: string;
  readonly service_name?: string;
  readonly usage?: Array<Record<string, unknown>>;
}

export interface ResourceUsageList {
  readonly resources: UsageResourceRecord[];
  readonly count: number;
  readonly limit?: number;
  readonly offset?: number;
}

// Made with Bob

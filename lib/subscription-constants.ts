export type PlanType = 'free' | 'pro' | 'enterprise';

export const PLANS: Record<PlanType, PlanType> = {
    free: 'free',
    pro: 'pro',
    enterprise: 'enterprise',
};

export interface PlanLimits {
    maxBooks: number;
    maxSegments: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
    free: {
        maxBooks: 2,
        maxSegments: 100,
    },
    pro: {
        maxBooks: 10,
        maxSegments: 1000,
    },
    enterprise: {
        maxBooks: Infinity,
        maxSegments: Infinity,
    },
};

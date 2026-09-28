import { PLANS, PlanType } from './subscription-constants';

export const getUserPlan = async (): Promise<PlanType> => {
    // Default plan without authentication
    return PLANS.free;
};

import { auth } from '@clerk/nextjs/server';
import { PLANS, PlanType } from './subscription-constants';

export const getUserPlan = async (): Promise<PlanType> => {
    const { userId } = await auth();

    if (!userId) {
        return PLANS.free;
    }

    // Defaulting to free plan for now. Future implementation: Fetch from DB / Stripe.
    return PLANS.free;
};

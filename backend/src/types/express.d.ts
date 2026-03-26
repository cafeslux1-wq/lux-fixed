import 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId?:    string;
      branchId?:    string;
      requestId:    string;
      user?:        { sub: string; role: string; permissions: string[]; tenantId: string; branchId: string };
      customer?:    { sub: string; tenantId: string };
      idempotencyKey?: string;
      subscriptionLimits?: {
        maxBranches:    number;
        maxStaff:       number;
        maxOrdersDaily: number;
        planName:       string;
        isPastDue?:     boolean;
      };
    }
  }
}

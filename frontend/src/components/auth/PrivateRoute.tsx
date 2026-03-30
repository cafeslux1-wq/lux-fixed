import React from 'react';
import { useApp } from '../../lib/store';
import { StaffGate } from './StaffGate';

const SCOPE_RANK: Record<string, number> = { public: 0, staff: 1, admin: 2 };

interface PrivateRouteProps {
  scope: 'staff' | 'admin';
  children: React.ReactNode;
}

export function PrivateRoute({ scope, children }: PrivateRouteProps) {
  const { state } = useApp();
  const current  = SCOPE_RANK[state.auth.scope] ?? 0;
  const required = SCOPE_RANK[scope] ?? 1;
  if (current >= required) return <>{children}</>;
  return <StaffGate requiredScope={scope} />;
}

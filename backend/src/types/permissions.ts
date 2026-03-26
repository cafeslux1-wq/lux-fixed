/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — Granular RBAC Permission System
 *  Every action in the platform maps to a specific permission.
 *  Roles are just named collections of permissions.
 * ══════════════════════════════════════════════════════════
 */

// ── All system permissions ────────────────────────────────────────────────
export const PERMISSIONS = {

  // Orders
  ORDER_CREATE:           'order:create',
  ORDER_VIEW:             'order:view',
  ORDER_VIEW_ALL:         'order:view_all',
  ORDER_VOID:             'order:void',
  ORDER_REFUND:           'order:refund',
  ORDER_EXPORT:           'order:export',

  // KDS / Kitchen
  KDS_VIEW:               'kds:view',
  KDS_UPDATE_STATUS:      'kds:update_status',

  // Staff
  STAFF_VIEW:             'staff:view',
  STAFF_CREATE:           'staff:create',
  STAFF_EDIT:             'staff:edit',
  STAFF_TERMINATE:        'staff:terminate',
  STAFF_VIEW_SALARY:      'staff:view_salary',

  // Customers
  CUSTOMER_VIEW:          'customer:view',
  CUSTOMER_CREATE:        'customer:create',
  CUSTOMER_EDIT:          'customer:edit',
  CUSTOMER_ADJUST_WALLET: 'customer:adjust_wallet',
  CUSTOMER_EXPORT:        'customer:export',
  NFC_ASSIGN:             'customer:nfc_assign',

  // Menu
  MENU_VIEW:              'menu:view',
  MENU_CREATE:            'menu:create',
  MENU_EDIT:              'menu:edit',
  MENU_DELETE:            'menu:delete',
  MENU_TOGGLE:            'menu:toggle',
  MENU_PRICE_CHANGE:      'menu:price_change',
  RECIPE_EDIT:            'menu:recipe_edit',

  // Inventory
  INVENTORY_VIEW:         'inventory:view',
  INVENTORY_ADJUST:       'inventory:adjust',
  INVENTORY_RESTOCK:      'inventory:restock',
  INVENTORY_WASTE:        'inventory:waste',
  SUPPLIER_MANAGE:        'inventory:supplier_manage',
  PO_CREATE:              'inventory:po_create',
  PO_RECEIVE:             'inventory:po_receive',

  // Analytics
  ANALYTICS_VIEW:         'analytics:view',
  ANALYTICS_PROFIT:       'analytics:profit',      // sensitive — owner/manager only
  ANALYTICS_STAFF_PERF:   'analytics:staff_performance',
  ANALYTICS_EXPORT:       'analytics:export',
  BRANCH_COMPARE:         'analytics:branch_compare',

  // HR
  HR_VIEW:                'hr:view',
  CONTRACT_CREATE:        'hr:contract_create',
  CONTRACT_SIGN:          'hr:contract_sign',
  PAYROLL_VIEW:           'hr:payroll_view',
  PAYROLL_RUN:            'hr:payroll_run',
  PAYROLL_PAY:            'hr:payroll_pay',
  SCHEDULE_MANAGE:        'hr:schedule_manage',
  SALFIYA_SUBMIT:         'hr:salfiya_submit',
  SALFIYA_APPROVE:        'hr:salfiya_approve',
  SALFIYA_AUTHORIZE:      'hr:salfiya_authorize', // owner only
  SALFIYA_PAY:            'hr:salfiya_pay',

  // Courier
  COURIER_VIEW:           'courier:view',
  COURIER_CREATE:         'courier:create',
  COURIER_ASSIGN:         'courier:assign',
  COURIER_STATUS:         'courier:update_status',

  // Shift / Financial
  SHIFT_OPEN:             'shift:open',
  SHIFT_CLOSE:            'shift:close',
  SHIFT_OVERRIDE:         'shift:override',        // owner only

  // System
  SETTINGS_VIEW:          'system:settings_view',
  SETTINGS_EDIT:          'system:settings_edit',
  AUDIT_LOG_VIEW:         'system:audit_view',
  TENANT_MANAGE:          'system:tenant_manage',  // superadmin

} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ── Role → Permissions mapping ────────────────────────────────────────────
export type StaffRole = 'owner' | 'manager' | 'cashier' | 'barista' | 'waiter' | 'cook' | 'driver' | 'patissier';

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {

  owner: Object.values(PERMISSIONS) as Permission[], // owns everything

  manager: [
    PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_VIEW_ALL,
    PERMISSIONS.ORDER_VOID, PERMISSIONS.ORDER_EXPORT,
    PERMISSIONS.KDS_VIEW, PERMISSIONS.KDS_UPDATE_STATUS,
    PERMISSIONS.STAFF_VIEW, PERMISSIONS.STAFF_CREATE, PERMISSIONS.STAFF_EDIT,
    PERMISSIONS.STAFF_VIEW_SALARY,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE, PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_ADJUST_WALLET, PERMISSIONS.CUSTOMER_EXPORT,
    PERMISSIONS.NFC_ASSIGN,
    PERMISSIONS.MENU_VIEW, PERMISSIONS.MENU_CREATE, PERMISSIONS.MENU_EDIT,
    PERMISSIONS.MENU_TOGGLE, PERMISSIONS.MENU_PRICE_CHANGE, PERMISSIONS.RECIPE_EDIT,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ADJUST, PERMISSIONS.INVENTORY_RESTOCK,
    PERMISSIONS.INVENTORY_WASTE, PERMISSIONS.SUPPLIER_MANAGE,
    PERMISSIONS.PO_CREATE, PERMISSIONS.PO_RECEIVE,
    PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_PROFIT,
    PERMISSIONS.ANALYTICS_STAFF_PERF, PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.HR_VIEW, PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_RUN, PERMISSIONS.PAYROLL_PAY,
    PERMISSIONS.SCHEDULE_MANAGE,
    PERMISSIONS.SALFIYA_APPROVE, PERMISSIONS.SALFIYA_PAY,
    PERMISSIONS.COURIER_VIEW, PERMISSIONS.COURIER_CREATE, PERMISSIONS.COURIER_ASSIGN,
    PERMISSIONS.COURIER_STATUS,
    PERMISSIONS.SHIFT_OPEN, PERMISSIONS.SHIFT_CLOSE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],

  cashier: [
    PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.KDS_VIEW,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.NFC_ASSIGN,
    PERMISSIONS.MENU_VIEW, PERMISSIONS.MENU_TOGGLE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.COURIER_VIEW, PERMISSIONS.COURIER_CREATE, PERMISSIONS.COURIER_ASSIGN,
    PERMISSIONS.SHIFT_OPEN, PERMISSIONS.SHIFT_CLOSE,
    PERMISSIONS.SALFIYA_SUBMIT, PERMISSIONS.SALFIYA_PAY,
  ],

  barista: [
    PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.KDS_VIEW, PERMISSIONS.KDS_UPDATE_STATUS,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALFIYA_SUBMIT,
  ],

  waiter: [
    PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.KDS_VIEW,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.SALFIYA_SUBMIT,
  ],

  cook: [
    PERMISSIONS.KDS_VIEW, PERMISSIONS.KDS_UPDATE_STATUS,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALFIYA_SUBMIT,
  ],

  patissier: [
    PERMISSIONS.KDS_VIEW, PERMISSIONS.KDS_UPDATE_STATUS,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALFIYA_SUBMIT,
  ],

  driver: [
    PERMISSIONS.COURIER_VIEW,
    PERMISSIONS.COURIER_STATUS,
    PERMISSIONS.SALFIYA_SUBMIT,
  ],
};

// ── Helper: does role have permission? ────────────────────────────────────
export function roleHasPermission(role: StaffRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

// ── Helper: get all permissions for a role ────────────────────────────────
export function getPermissionsForRole(role: StaffRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

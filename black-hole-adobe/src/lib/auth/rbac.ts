/**
 * Role-Based Access Control (RBAC)
 *
 * Manages roles, permissions, and resource-level access control for
 * enterprise security compliance (SOC 2 Type II).
 */

// -----------------------------------------------------------------------
// Role & Permission Definitions
// -----------------------------------------------------------------------

export type Role =
  | 'super_admin'
  | 'admin'
  | 'migration_manager'
  | 'reviewer'
  | 'viewer'
  | 'customer';

export type Permission =
  | 'manage_users'
  | 'manage_roles'
  | 'manage_system'
  | 'manage_migrations'
  | 'create_migration'
  | 'run_migration'
  | 'cancel_migration'
  | 'delete_migration'
  | 'manage_connectors'
  | 'view_migrations'
  | 'view_reports'
  | 'view_assessments'
  | 'review_code_changes'
  | 'approve_changes'
  | 'reject_changes'
  | 'export_data'
  | 'view_audit_log'
  | 'manage_security'
  | 'view_portal';

export type ResourceType =
  | 'migration'
  | 'assessment'
  | 'connector'
  | 'report'
  | 'user'
  | 'audit_log'
  | 'portal'
  | 'settings';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: [
    'manage_users',
    'manage_roles',
    'manage_system',
    'manage_migrations',
    'create_migration',
    'run_migration',
    'cancel_migration',
    'delete_migration',
    'manage_connectors',
    'view_migrations',
    'view_reports',
    'view_assessments',
    'review_code_changes',
    'approve_changes',
    'reject_changes',
    'export_data',
    'view_audit_log',
    'manage_security',
    'view_portal',
  ],
  admin: [
    'manage_users',
    'manage_migrations',
    'create_migration',
    'run_migration',
    'cancel_migration',
    'manage_connectors',
    'view_migrations',
    'view_reports',
    'view_assessments',
    'review_code_changes',
    'approve_changes',
    'reject_changes',
    'export_data',
    'view_audit_log',
    'view_portal',
  ],
  migration_manager: [
    'create_migration',
    'run_migration',
    'cancel_migration',
    'manage_connectors',
    'view_migrations',
    'view_reports',
    'view_assessments',
    'export_data',
  ],
  reviewer: [
    'review_code_changes',
    'approve_changes',
    'reject_changes',
    'view_migrations',
    'view_reports',
    'view_assessments',
  ],
  viewer: [
    'view_migrations',
    'view_reports',
    'view_assessments',
  ],
  customer: [
    'view_portal',
  ],
} as const;

/**
 * Maps resource types and actions to required permissions.
 */
const RESOURCE_ACTION_MAP: Record<ResourceType, Partial<Record<Action, Permission>>> = {
  migration: {
    create: 'create_migration',
    read: 'view_migrations',
    update: 'manage_migrations',
    delete: 'delete_migration',
    execute: 'run_migration',
  },
  assessment: {
    read: 'view_assessments',
    create: 'create_migration',
  },
  connector: {
    create: 'manage_connectors',
    read: 'view_migrations',
    update: 'manage_connectors',
    delete: 'manage_connectors',
  },
  report: {
    read: 'view_reports',
    create: 'export_data',
  },
  user: {
    create: 'manage_users',
    read: 'manage_users',
    update: 'manage_users',
    delete: 'manage_users',
  },
  audit_log: {
    read: 'view_audit_log',
    create: 'view_audit_log',
  },
  portal: {
    read: 'view_portal',
  },
  settings: {
    read: 'manage_system',
    update: 'manage_system',
  },
};

// -----------------------------------------------------------------------
// User-Role Assignment Store
// -----------------------------------------------------------------------

interface UserRoleEntry {
  userId: string;
  role: Role;
  organizationId: string;
  assignedAt: string;
  assignedBy: string | null;
}

// -----------------------------------------------------------------------
// RBACManager
// -----------------------------------------------------------------------

export class RBACManager {
  private userRoles = new Map<string, UserRoleEntry>();

  /**
   * Assign a role to a user.
   */
  assignRole(
    userId: string,
    role: Role,
    organizationId: string = 'default',
    assignedBy: string | null = null,
  ): void {
    if (!ROLE_PERMISSIONS[role]) {
      throw new Error(`Invalid role: ${role}`);
    }

    this.userRoles.set(userId, {
      userId,
      role,
      organizationId,
      assignedAt: new Date().toISOString(),
      assignedBy,
    });
  }

  /**
   * Get the role entry for a user.
   */
  getUserRole(userId: string): UserRoleEntry | undefined {
    return this.userRoles.get(userId);
  }

  /**
   * Get all permissions granted to a user through their role.
   */
  getUserPermissions(userId: string): Permission[] {
    const entry = this.userRoles.get(userId);
    if (!entry) return [];
    return [...ROLE_PERMISSIONS[entry.role]];
  }

  /**
   * Check if a user has a specific permission.
   */
  hasPermission(userId: string, permission: Permission): boolean {
    const entry = this.userRoles.get(userId);
    if (!entry) return false;
    return ROLE_PERMISSIONS[entry.role].includes(permission);
  }

  /**
   * Check resource-level access.
   *
   * Enforces organization scoping: customers and non-super-admin users
   * can only access resources belonging to their own organization.
   */
  checkAccess(
    userId: string,
    resource: ResourceType,
    action: Action,
    resourceOrgId?: string,
  ): boolean {
    const entry = this.userRoles.get(userId);
    if (!entry) return false;

    // Look up the required permission for this resource+action
    const requiredPermission = RESOURCE_ACTION_MAP[resource]?.[action];
    if (!requiredPermission) return false;

    // Check if the user's role grants this permission
    if (!ROLE_PERMISSIONS[entry.role].includes(requiredPermission)) {
      return false;
    }

    // Organization scoping: non-super-admins can only access their org
    if (resourceOrgId && entry.role !== 'super_admin') {
      if (entry.organizationId !== resourceOrgId) {
        return false;
      }
    }

    return true;
  }

  /**
   * Remove a user's role assignment.
   */
  removeRole(userId: string): boolean {
    return this.userRoles.delete(userId);
  }

  /**
   * List all users with a specific role.
   */
  getUsersByRole(role: Role): UserRoleEntry[] {
    const results: UserRoleEntry[] = [];
    for (const entry of this.userRoles.values()) {
      if (entry.role === role) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Get all valid roles.
   */
  getAllRoles(): Role[] {
    return Object.keys(ROLE_PERMISSIONS) as Role[];
  }

  /**
   * Get permissions for a specific role without needing a user context.
   */
  getRolePermissions(role: Role): Permission[] {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) throw new Error(`Invalid role: ${role}`);
    return [...perms];
  }
}

// Singleton instance
let _rbacInstance: RBACManager | null = null;

export function getRBACManager(): RBACManager {
  if (!_rbacInstance) {
    _rbacInstance = new RBACManager();
  }
  return _rbacInstance;
}

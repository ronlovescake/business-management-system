import type { UseFormReturnType } from '@mantine/form';

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  name: string;
  displayName: string;
  path: string;
  category: string;
  icon: string | null;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: Module[];
}

export interface UserPermission {
  id: string;
  userId: string;
  moduleId: string;
  canAccess: boolean;
  module: Module;
}

export interface CreateUserFormValues {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface EditUserFormValues {
  name: string;
  role: UserRole;
  isActive: boolean;
  password: string;
}

export type UserPermissionsMap = Record<string, string[]>;
export type LoadingMap = Record<string, boolean>;

export type CreateUserForm = UseFormReturnType<CreateUserFormValues>;
export type EditUserForm = UseFormReturnType<EditUserFormValues>;

import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import type {
  CreateUserFormValues,
  EditUserFormValues,
  User,
  UserModule,
  UserPermission,
  UserRole,
} from '../types';

const getAllDescendantIds = (module: UserModule): string[] => {
  const ids: string[] = [];

  if (!module.children?.length) {
    return ids;
  }

  module.children.forEach((child) => {
    ids.push(child.id);
    ids.push(...getAllDescendantIds(child));
  });

  return ids;
};

export function useUserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [modules, setModules] = useState<UserModule[]>([]);
  const [userPermissions, setUserPermissions] = useState<
    Record<string, string[]>
  >({});
  const [originalPermissions, setOriginalPermissions] = useState<
    Record<string, string[]>
  >({});
  const [loadingPermissions, setLoadingPermissions] = useState<
    Record<string, boolean>
  >({});
  const [savingPermissions, setSavingPermissions] = useState<
    Record<string, boolean>
  >({});
  const [expandedSections, setExpandedSections] = useState<
    Record<string, Set<string>>
  >({});

  const createForm = useForm<CreateUserFormValues>({
    initialValues: {
      email: '',
      name: '',
      password: '',
      role: 'USER',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      name: (value) => (value.trim().length < 1 ? 'Name is required' : null),
      password: (value) =>
        value.length < 6 ? 'Password must be at least 6 characters' : null,
    },
  });

  const editForm = useForm<EditUserFormValues>({
    initialValues: {
      name: '',
      role: 'USER',
      isActive: true,
      password: '',
    },
    validate: {
      name: (value) => (value.trim().length < 1 ? 'Name is required' : null),
      password: (value) =>
        value && value.length < 6
          ? 'Password must be at least 6 characters'
          : null,
    },
  });

  const topLevelModules = useMemo(
    () => modules.filter((module) => !module.parentId),
    [modules]
  );

  useEffect(() => {
    void fetchUsers();
    void fetchModules();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = (await response.json()) as User[];
      setUsers(data);
    } catch {
      showNotification({
        title: 'Error',
        message: 'Failed to load users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/modules');

      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }

      const data = (await response.json()) as UserModule[];
      setModules(data);
    } catch {
      showNotification({
        title: 'Error',
        message: 'Failed to load modules',
        color: 'red',
      });
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      setLoadingPermissions((previous) => ({ ...previous, [userId]: true }));
      const response = await fetch(`/api/users/${userId}/permissions`);

      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      const data = (await response.json()) as UserPermission[];
      const moduleIds = data.map((permission) => permission.moduleId);

      setUserPermissions((previous) => ({ ...previous, [userId]: moduleIds }));
      setOriginalPermissions((previous) => ({
        ...previous,
        [userId]: moduleIds,
      }));
    } catch {
      showNotification({
        title: 'Error',
        message: 'Failed to load user permissions',
        color: 'red',
      });
    } finally {
      setLoadingPermissions((previous) => ({ ...previous, [userId]: false }));
    }
  };

  const handleToggleUserExpand = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(userId);
    if (!userPermissions[userId]) {
      await fetchUserPermissions(userId);
    }
  };

  const handleToggleModule = (
    userId: string,
    moduleId: string,
    module?: UserModule
  ) => {
    setUserPermissions((previous) => {
      const current = previous[userId] || [];
      const isChecked = current.includes(moduleId);
      let nextPermissions = [...current];

      if (module) {
        const allIds = [module.id, ...getAllDescendantIds(module)];

        if (isChecked) {
          nextPermissions = nextPermissions.filter(
            (id) => !allIds.includes(id)
          );
        } else {
          allIds.forEach((id) => {
            if (!nextPermissions.includes(id)) {
              nextPermissions.push(id);
            }
          });
        }
      } else if (isChecked) {
        nextPermissions = nextPermissions.filter((id) => id !== moduleId);
      } else {
        nextPermissions.push(moduleId);
      }

      return { ...previous, [userId]: nextPermissions };
    });
  };

  const handleSavePermissions = async (userId: string) => {
    try {
      setSavingPermissions((previous) => ({ ...previous, [userId]: true }));
      const moduleIds = userPermissions[userId] || [];

      const response = await fetch(`/api/users/${userId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to update permissions');
      }

      setOriginalPermissions((previous) => ({
        ...previous,
        [userId]: moduleIds,
      }));

      showNotification({
        title: 'Success',
        message: 'Permissions updated successfully',
        color: 'green',
      });
    } catch {
      showNotification({
        title: 'Error',
        message: 'Failed to update permissions',
        color: 'red',
      });
    } finally {
      setSavingPermissions((previous) => ({ ...previous, [userId]: false }));
    }
  };

  const hasPermissionChanges = (userId: string) => {
    const current = userPermissions[userId] || [];
    const original = originalPermissions[userId] || [];

    if (current.length !== original.length) {
      return true;
    }

    const currentSorted = [...current].sort();
    const originalSorted = [...original].sort();

    return !currentSorted.every((id, index) => id === originalSorted[index]);
  };

  const toggleSection = (userId: string, sectionId: string) => {
    setExpandedSections((previous) => {
      const next = new Set(previous[userId] || new Set<string>());

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return { ...previous, [userId]: next };
    });
  };

  const isSectionExpanded = (userId: string, sectionId: string) => {
    return expandedSections[userId]?.has(sectionId) ?? false;
  };

  const isModuleIndeterminate = (userId: string, module: UserModule) => {
    const descendantIds = getAllDescendantIds(module);
    if (!descendantIds.length) {
      return false;
    }

    const permissions = userPermissions[userId] || [];
    const checkedCount = descendantIds.filter((id) =>
      permissions.includes(id)
    ).length;

    return checkedCount > 0 && checkedCount < descendantIds.length;
  };

  const areAllChildrenChecked = (userId: string, module: UserModule) => {
    const descendantIds = getAllDescendantIds(module);
    if (!descendantIds.length) {
      return false;
    }

    const permissions = userPermissions[userId] || [];
    return descendantIds.every((id) => permissions.includes(id));
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    createForm.reset();
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedUser(null);
    editForm.reset();
  };

  const handleCreateUser = createForm.onSubmit(async (values) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'User created successfully',
        color: 'green',
      });

      closeCreateModal();
      await fetchUsers();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create user',
        color: 'red',
      });
    }
  });

  const handleEditUser = editForm.onSubmit(async (values) => {
    if (!selectedUser) {
      return;
    }

    try {
      const updateData: {
        name?: string;
        role?: UserRole;
        isActive?: boolean;
        password?: string;
      } = {};

      if (values.name !== selectedUser.name) {
        updateData.name = values.name;
      }

      if (values.role !== selectedUser.role) {
        updateData.role = values.role;
      }

      if (values.isActive !== selectedUser.isActive) {
        updateData.isActive = values.isActive;
      }

      if (values.password) {
        updateData.password = values.password;
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'User updated successfully',
        color: 'green',
      });

      closeEditModal();
      await fetchUsers();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update user',
        color: 'red',
      });
    }
  });

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    editForm.setValues({
      name: user.name || '',
      role: user.role,
      isActive: user.isActive,
      password: '',
    });
    setEditModalOpen(true);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'red';
      case 'ADMIN':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return {
    users,
    loading,
    modules: topLevelModules,
    createModalOpen,
    editModalOpen,
    selectedUser,
    expandedUserId,
    userPermissions,
    loadingPermissions,
    savingPermissions,
    createForm,
    editForm,
    setCreateModalOpen,
    handleToggleUserExpand,
    handleToggleModule,
    handleSavePermissions,
    hasPermissionChanges,
    toggleSection,
    isSectionExpanded,
    isModuleIndeterminate,
    areAllChildrenChecked,
    handleCreateUser,
    handleEditUser,
    openEditModal,
    closeCreateModal,
    closeEditModal,
    getRoleBadgeColor,
  };
}

import { useState, useEffect, useCallback, type FormEventHandler } from 'react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type {
  User,
  Module,
  UserPermission,
  UserPermissionsMap,
  LoadingMap,
  CreateUserFormValues,
  EditUserFormValues,
  CreateUserForm,
  EditUserForm,
} from '../types';

const collectDescendantIds = (module: Module): string[] => {
  const ids: string[] = [];
  module.children?.forEach((child) => {
    ids.push(child.id, ...collectDescendantIds(child));
  });
  return ids;
};

const collectIdsIncludingSelf = (module: Module): string[] => [
  module.id,
  ...collectDescendantIds(module),
];

interface UseUserManagementResult {
  users: User[];
  modules: Module[];
  loading: boolean;
  expandedUserId: string | null;
  userPermissions: UserPermissionsMap;
  loadingPermissions: LoadingMap;
  savingPermissions: LoadingMap;
  createModalOpen: boolean;
  editModalOpen: boolean;
  selectedUser: User | null;
  createForm: CreateUserForm;
  editForm: EditUserForm;
  handleCreateUserSubmit: FormEventHandler<HTMLFormElement>;
  handleEditUserSubmit: FormEventHandler<HTMLFormElement>;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (user: User) => void;
  closeEditModal: () => void;
  handleToggleUserExpand: (userId: string) => Promise<void>;
  handleToggleModule: (
    userId: string,
    moduleId: string,
    moduleObj?: Module
  ) => void;
  handleSavePermissions: (userId: string) => Promise<void>;
  hasPermissionChanges: (userId: string) => boolean;
  toggleSection: (userId: string, sectionId: string) => void;
  isSectionExpanded: (userId: string, sectionId: string) => boolean;
  isModuleIndeterminate: (userId: string, moduleData: Module) => boolean;
  areAllChildrenChecked: (userId: string, moduleData: Module) => boolean;
}

export function useUserManagement(): UseUserManagementResult {
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissionsMap>(
    {}
  );
  const [originalPermissions, setOriginalPermissions] =
    useState<UserPermissionsMap>({});
  const [loadingPermissions, setLoadingPermissions] = useState<LoadingMap>({});
  const [savingPermissions, setSavingPermissions] = useState<LoadingMap>({});
  const [expandedSections, setExpandedSections] = useState<
    Record<string, Set<string>>
  >({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load users',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchModules = useCallback(async () => {
    try {
      const response = await fetch('/api/modules');
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }
      const data = await response.json();
      setModules(data);
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load modules',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  }, []);

  const fetchUserPermissions = useCallback(async (userId: string) => {
    try {
      setLoadingPermissions((prev) => ({ ...prev, [userId]: true }));
      const response = await fetch(`/api/users/${userId}/permissions`);
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      const data: UserPermission[] = await response.json();
      const moduleIds = data.map((permission) => permission.moduleId);
      setUserPermissions((prev) => ({ ...prev, [userId]: moduleIds }));
      setOriginalPermissions((prev) => ({ ...prev, [userId]: moduleIds }));
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load user permissions',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setLoadingPermissions((prev) => ({ ...prev, [userId]: false }));
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    void fetchModules();
  }, [fetchUsers, fetchModules]);

  const handleToggleUserExpand = useCallback(
    async (userId: string) => {
      setExpandedUserId((current) => (current === userId ? null : userId));
      if (expandedUserId !== userId && !userPermissions[userId]) {
        await fetchUserPermissions(userId);
      }
    },
    [expandedUserId, userPermissions, fetchUserPermissions]
  );

  const handleToggleModule = useCallback(
    (userId: string, moduleId: string, moduleObj?: Module) => {
      setUserPermissions((prev) => {
        const current = prev[userId] || [];
        const isCurrentlyChecked = current.includes(moduleId);
        let nextPermissions = [...current];

        if (moduleObj) {
          const allIds = collectIdsIncludingSelf(moduleObj);
          if (isCurrentlyChecked) {
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
        } else if (isCurrentlyChecked) {
          nextPermissions = nextPermissions.filter((id) => id !== moduleId);
        } else {
          nextPermissions.push(moduleId);
        }

        return { ...prev, [userId]: nextPermissions };
      });
    },
    []
  );

  const handleSavePermissions = useCallback(
    async (userId: string) => {
      try {
        setSavingPermissions((prev) => ({ ...prev, [userId]: true }));
        const moduleIds = userPermissions[userId] || [];

        const response = await fetch(`/api/users/${userId}/permissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleIds }),
        });

        if (!response.ok) {
          throw new Error('Failed to update permissions');
        }

        setOriginalPermissions((prev) => ({ ...prev, [userId]: moduleIds }));

        showNotification({
          title: 'Success',
          message: 'Permissions updated successfully',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Failed to update permissions',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
      } finally {
        setSavingPermissions((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [userPermissions]
  );

  const hasPermissionChanges = useCallback(
    (userId: string): boolean => {
      const current = userPermissions[userId] || [];
      const original = originalPermissions[userId] || [];

      if (current.length !== original.length) {
        return true;
      }

      const currentSorted = [...current].sort();
      const originalSorted = [...original].sort();

      return !currentSorted.every((id, index) => id === originalSorted[index]);
    },
    [userPermissions, originalPermissions]
  );

  const toggleSection = useCallback((userId: string, sectionId: string) => {
    setExpandedSections((prev) => {
      const userSections = prev[userId] || new Set<string>();
      const updatedSet = new Set(userSections);

      if (updatedSet.has(sectionId)) {
        updatedSet.delete(sectionId);
      } else {
        updatedSet.add(sectionId);
      }

      return { ...prev, [userId]: updatedSet };
    });
  }, []);

  const isSectionExpanded = useCallback(
    (userId: string, sectionId: string): boolean => {
      return expandedSections[userId]?.has(sectionId) ?? false;
    },
    [expandedSections]
  );

  const isModuleIndeterminate = useCallback(
    (userId: string, moduleData: Module): boolean => {
      const descendants = collectDescendantIds(moduleData);
      if (descendants.length === 0) {
        return false;
      }
      const permissions = userPermissions[userId] || [];
      const checkedCount = descendants.filter((id) =>
        permissions.includes(id)
      ).length;
      return checkedCount > 0 && checkedCount < descendants.length;
    },
    [userPermissions]
  );

  const areAllChildrenChecked = useCallback(
    (userId: string, moduleData: Module): boolean => {
      const descendants = collectDescendantIds(moduleData);
      if (descendants.length === 0) {
        return false;
      }
      const permissions = userPermissions[userId] || [];
      return descendants.every((id) => permissions.includes(id));
    },
    [userPermissions]
  );

  const openCreateModal = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    createForm.reset();
  }, [createForm]);

  const openEditModal = useCallback(
    (user: User) => {
      setSelectedUser(user);
      editForm.setValues({
        name: user.name || '',
        role: user.role,
        isActive: user.isActive,
        password: '',
      });
      setEditModalOpen(true);
    },
    [editForm]
  );

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setSelectedUser(null);
    editForm.reset();
  }, [editForm]);

  const handleCreateUserSubmit = createForm.onSubmit(async (values) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'User created successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      closeCreateModal();
      void fetchUsers();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create user',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  });

  const handleEditUserSubmit = editForm.onSubmit(async (values) => {
    if (!selectedUser) {
      return;
    }

    try {
      const payload: Partial<EditUserFormValues> = {};

      if (values.name !== selectedUser.name) {
        payload.name = values.name;
      }
      if (values.role !== selectedUser.role) {
        payload.role = values.role;
      }
      if (values.isActive !== selectedUser.isActive) {
        payload.isActive = values.isActive;
      }
      if (values.password) {
        payload.password = values.password;
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'User updated successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      closeEditModal();
      void fetchUsers();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update user',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  });

  return {
    users,
    modules,
    loading,
    expandedUserId,
    userPermissions,
    loadingPermissions,
    savingPermissions,
    createModalOpen,
    editModalOpen,
    selectedUser,
    createForm,
    editForm,
    handleCreateUserSubmit,
    handleEditUserSubmit,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    handleToggleUserExpand,
    handleToggleModule,
    handleSavePermissions,
    hasPermissionChanges,
    toggleSection,
    isSectionExpanded,
    isModuleIndeterminate,
    areAllChildrenChecked,
  };
}

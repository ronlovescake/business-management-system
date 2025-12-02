export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  photoUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileFormValues {
  name: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

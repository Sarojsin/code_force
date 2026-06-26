import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adminService,
  RoleUpdate,
  BroadcastRequest,
} from 'src/services/api';

export const adminKeys = {
  all: ['admin'] as const,
  users: ['admin', 'users'] as const,
  analytics: ['admin', 'analytics'] as const,
};

export function useAdminUsers(params?: { page?: number; per_page?: number }) {
  return useQuery({
    queryKey: [...adminKeys.users, params],
    queryFn: () => adminService.getUsers(params),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: RoleUpdate }) =>
      adminService.updateUserRole(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users });
    },
  });
}

export function useVerifyNurse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nurseId: string) => adminService.verifyNurse(nurseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users });
    },
  });
}

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: adminKeys.analytics,
    queryFn: () => adminService.getDashboardAnalytics(),
  });
}

export function useSendBroadcast() {
  return useMutation({
    mutationFn: (data: BroadcastRequest) => adminService.sendBroadcast(data),
  });
}

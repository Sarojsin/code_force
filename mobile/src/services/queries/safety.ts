import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  safetyService,
  EmergencyContactCreate,
  EmergencyContactUpdate,
  SosTriggerRequest,
} from 'src/services/api';

export const safetyKeys = {
  all: ['safety'] as const,
  contacts: ['safety', 'contacts'] as const,
  sosHistory: ['safety', 'sosHistory'] as const,
  activeSos: ['safety', 'activeSos'] as const,
};

export function useEmergencyContacts() {
  return useQuery({
    queryKey: safetyKeys.contacts,
    queryFn: () => safetyService.getEmergencyContacts(),
  });
}

export function useCreateEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmergencyContactCreate) => safetyService.createEmergencyContact(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.contacts });
    },
  });
}

export function useUpdateEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmergencyContactUpdate }) =>
      safetyService.updateEmergencyContact(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.contacts });
    },
  });
}

export function useDeleteEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => safetyService.deleteEmergencyContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.contacts });
    },
  });
}

export function useTriggerSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: SosTriggerRequest; idempotencyKey: string }) =>
      safetyService.triggerSos(data, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.sosHistory });
      qc.invalidateQueries({ queryKey: safetyKeys.activeSos });
    },
  });
}

export function useActiveSos() {
  return useQuery({
    queryKey: safetyKeys.activeSos,
    queryFn: () => safetyService.getActiveSos(),
    refetchInterval: 30_000,
  });
}

export function useSosHistory() {
  return useQuery({
    queryKey: safetyKeys.sosHistory,
    queryFn: () => safetyService.getSosHistory(),
  });
}

export function useCancelSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => safetyService.cancelSos(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.sosHistory });
      qc.invalidateQueries({ queryKey: safetyKeys.activeSos });
    },
  });
}

export function useResolveSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => safetyService.resolveSos(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.sosHistory });
      qc.invalidateQueries({ queryKey: safetyKeys.activeSos });
    },
  });
}

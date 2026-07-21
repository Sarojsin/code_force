import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import {
  safetyService,
  EmergencyContactCreate,
  EmergencyContactUpdate,
  SosTriggerRequest,
} from 'src/services/api';
import { useOfflineStore } from 'src/stores/offlineStore';
import { isNetworkError } from 'src/services/sync';
import { generateId } from 'src/utils';
import {
  placeholderEmergencyContacts,
  placeholderActiveSos,
  placeholderSosHistory,
} from 'src/services/localDb/syncPlaceholders';
import {
  upsertEmergencyContact,
  upsertSosAlert,
  softDeleteLocalEntity,
} from 'src/services/localDb/writeThroughHelpers';
import { localDb } from 'src/services/localDb';

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
    initialData: () => placeholderEmergencyContacts() as any,
    staleTime: 0,
    retry: false,
  });
}

export function useCreateEmergencyContact() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (data: EmergencyContactCreate) => safetyService.createEmergencyContact(data),
    onSuccess: (result) => {
      upsertEmergencyContact(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: safetyKeys.contacts });
    },
    onError: (error, data) => {
      if (isNetworkError(error)) {
        const tempId = generateId();
        offlineStore.enqueue({
          type: 'safety/contact/create',
          endpoint: '/api/v1/safety/emergency-contacts',
          data: data as unknown as Record<string, unknown>,
          tempId,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(safetyKeys.contacts, (old: any) => {
          if (!old) return [{ ...data, id: tempId, _optimistic: true }];
          if (Array.isArray(old)) return [...old, { ...data, id: tempId, _optimistic: true }];
          return old;
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save contact' });
      }
    },
  });
}

export function useUpdateEmergencyContact() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmergencyContactUpdate }) =>
      safetyService.updateEmergencyContact(id, data),
    onSuccess: (result) => {
      upsertEmergencyContact(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: safetyKeys.contacts });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'safety/contact/update',
          endpoint: `/api/v1/safety/emergency-contacts/${variables.id}`,
          data: { id: variables.id, ...variables.data },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(safetyKeys.contacts, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: any) => item.id === variables.id ? { ...item, ...variables.data, _optimistic: true } : item);
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to update contact' });
      }
    },
  });
}

export function useDeleteEmergencyContact() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (id: string) => safetyService.deleteEmergencyContact(id),
    onSuccess: (_result, id) => {
      softDeleteLocalEntity(localDb.emergencyContact, id);
      qc.invalidateQueries({ queryKey: safetyKeys.contacts });
    },
    onError: (error, id) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'safety/contact/delete',
          endpoint: `/api/v1/safety/emergency-contacts/${id}`,
          data: { id },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(safetyKeys.contacts, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((item: any) => item.id !== id);
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to delete contact' });
      }
    },
  });
}

export function useTriggerSos() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: SosTriggerRequest; idempotencyKey: string }) =>
      safetyService.triggerSos(data, idempotencyKey),
    onSuccess: (result) => {
      if (result && result.id) {
        upsertSosAlert(result as unknown as Record<string, unknown>);
      }
      qc.invalidateQueries({ queryKey: safetyKeys.sosHistory });
      qc.invalidateQueries({ queryKey: safetyKeys.activeSos });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'safety/sos/trigger',
          endpoint: '/api/v1/safety/sos/trigger',
          data: variables.data as unknown as Record<string, unknown>,
          idempotencyKey: variables.idempotencyKey,
          clientUpdatedAt: new Date().toISOString(),
          priority: 'high',
        });
        Toast.show({ type: 'info', text1: 'SOS queued — will send when online' });
        qc.setQueryData(safetyKeys.activeSos, () => ({
          id: 'optimistic-sos',
          triggered_at: new Date().toISOString(),
          status: 'active',
          ...variables.data,
          _optimistic: true,
        }));
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to trigger SOS' });
      }
    },
  });
}

export function useActiveSos() {
  return useQuery({
    queryKey: safetyKeys.activeSos,
    queryFn: () => safetyService.getActiveSos(),
    refetchInterval: 30_000,
    initialData: () => placeholderActiveSos() as any,
    retry: false,
  });
}

export function useSosHistory() {
  return useQuery({
    queryKey: safetyKeys.sosHistory,
    queryFn: () => safetyService.getSosHistory(),
    initialData: () => placeholderSosHistory() as any,
    staleTime: 0,
    retry: false,
  });
}

export function useCancelSos() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (alertId: string) => safetyService.cancelSos(alertId),
    onSuccess: (result) => {
      if (result && (result as any).id) {
        upsertSosAlert(result as unknown as Record<string, unknown>);
      }
      qc.invalidateQueries({ queryKey: safetyKeys.sosHistory });
      qc.invalidateQueries({ queryKey: safetyKeys.activeSos });
    },
    onError: (error, alertId) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'safety/sos/cancel',
          endpoint: `/api/v1/safety/sos/${alertId}/cancel`,
          data: { sos_id: alertId },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'high',
        });
        Toast.show({ type: 'info', text1: 'Cancel will sync when online' });
        qc.setQueryData(safetyKeys.activeSos, () => null);
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to cancel SOS' });
      }
    },
  });
}

export function useResolveSos() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (alertId: string) => safetyService.resolveSos(alertId),
    onSuccess: (result) => {
      if (result && (result as any).id) {
        upsertSosAlert(result as unknown as Record<string, unknown>);
      }
      qc.invalidateQueries({ queryKey: safetyKeys.sosHistory });
      qc.invalidateQueries({ queryKey: safetyKeys.activeSos });
    },
    onError: (error, alertId) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'safety/sos/resolve',
          endpoint: `/api/v1/safety/sos/${alertId}/resolve`,
          data: { sos_id: alertId },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'high',
        });
        Toast.show({ type: 'info', text1: 'Resolve will sync when online' });
        qc.setQueryData(safetyKeys.activeSos, () => null);
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to resolve SOS' });
      }
    },
  });
}

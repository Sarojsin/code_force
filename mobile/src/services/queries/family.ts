import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { familyService, PermissionsUpdate } from 'src/services/api';

export const familyKeys = {
  all: ['family'] as const,
  links: ['family', 'links'] as const,
};

export function useFamilyLinks() {
  return useQuery({
    queryKey: familyKeys.links,
    queryFn: () => familyService.getLinks(),
  });
}

export function useGenerateFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => familyService.generateInvite(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKeys.links });
    },
  });
}

export function useFamilyInviteInfo(token: string) {
  return useQuery({
    queryKey: [...familyKeys.links, 'invite', token],
    queryFn: () => familyService.getInviteInfo(token),
    enabled: !!token,
  });
}

export function useAcceptFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => familyService.acceptInvite(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKeys.links });
    },
  });
}

export function useUpdateFamilyPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: PermissionsUpdate }) =>
      familyService.updatePermissions(linkId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKeys.links });
    },
  });
}

export function useRemoveFamilyLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => familyService.removeLink(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: familyKeys.links });
    },
  });
}

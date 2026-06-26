import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chatService } from 'src/services/api';

export const chatKeys = {
  all: ['chat'] as const,
  token: ['chat', 'token'] as const,
  rooms: ['chat', 'rooms'] as const,
};

export function useChatToken() {
  return useQuery({
    queryKey: chatKeys.token,
    queryFn: () => chatService.getToken(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGenerateChatLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => chatService.generateLink(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.rooms });
    },
  });
}

export function useChatLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => chatService.useLink(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.rooms });
    },
  });
}

export function useChatRooms() {
  return useQuery({
    queryKey: chatKeys.rooms,
    queryFn: () => chatService.getRooms(),
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authService } from 'src/services/api';
import { LoginResponse, RegisterRequest } from 'src/types/auth';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

export function useRegister() {
  const qc = useQueryClient();
  return useMutation<LoginResponse, Error, RegisterRequest>({
    mutationFn: (data) => authService.register(data),
    onSuccess: (data) => {
      qc.setQueryData(authKeys.me, data.user);
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<LoginResponse, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) => authService.login(email, password),
    onSuccess: (data) => {
      qc.setQueryData(authKeys.me, data.user);
    },
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => authService.requestOtp(phone),
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation<LoginResponse, Error, { phone: string; otp: string }>({
    mutationFn: ({ phone, otp }) => authService.verifyOtp(phone, otp),
    onSuccess: (data) => {
      qc.setQueryData(authKeys.me, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      qc.clear();
    },
  });
}

import { api, ApiSuccess } from './client';
import type { OnboardingData, OnboardingResponse, OnboardingStatusResponse } from 'src/types/onboarding';

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const onboardingService = {
  async upsert(data: OnboardingData): Promise<OnboardingResponse> {
    const resp = await api.put<ApiSuccess<OnboardingResponse> | OnboardingResponse>(
      '/onboarding',
      data,
    );
    return unwrap<OnboardingResponse>(resp.data);
  },

  async get(): Promise<OnboardingResponse> {
    const resp = await api.get<ApiSuccess<OnboardingResponse> | OnboardingResponse>('/onboarding');
    return unwrap<OnboardingResponse>(resp.data);
  },

  async getStatus(): Promise<OnboardingStatusResponse> {
    const resp = await api.get<ApiSuccess<OnboardingStatusResponse> | OnboardingStatusResponse>(
      '/onboarding/status',
    );
    return unwrap<OnboardingStatusResponse>(resp.data);
  },
};
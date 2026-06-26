import { useMutation, useQuery } from '@tanstack/react-query';

import { voiceService } from 'src/services/api';

export const voiceKeys = {
  all: ['voice'] as const,
  analysis: (entryId: string) => ['voice', 'analysis', entryId] as const,
};

export function useSubmitDailyJournal() {
  return useMutation({
    mutationFn: (data: { audio_base64?: string; transcription?: string; duration_seconds?: number }) =>
      voiceService.submitDailyJournal(data),
  });
}

export function useVoiceAnalysis(entryId: string) {
  return useQuery({
    queryKey: voiceKeys.analysis(entryId),
    queryFn: () => voiceService.getAnalysis(entryId),
    enabled: !!entryId,
  });
}

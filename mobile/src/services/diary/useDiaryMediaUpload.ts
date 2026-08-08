import { useEffect, useRef, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useQueryClient } from '@tanstack/react-query';
import { diaryService } from '../api/diary';
import { diaryLocal } from '../localDb';
import { useNetworkStatus } from '../sync/useNetworkStatus';
import { generateId } from 'src/utils/uuid';
import { logger } from 'src/utils';
import { emitDiaryPhotoAdded, emitDiaryMediaSynced } from './diaryEvents';

interface PendingUpload {
  mediaId: string;
  localPath: string;
  mimeType: string;
}

export function useDiaryMediaUpload() {
  const qc = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const queueRef = useRef<PendingUpload[]>([]);
  const uploadingRef = useRef(false);

  const enqueue = useCallback(async (
    localPath: string,
    mimeType: string = 'image/jpeg',
  ): Promise<string> => {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    const mediaId = generateId();
    const size = (fileInfo as any).size ?? 0;

    await diaryLocal.media.upsert({
      id: mediaId,
      user_id: '',
      media_type: mimeType.startsWith('video') ? 'video' : mimeType.startsWith('audio') ? 'voice' : 'image',
      file_size_bytes: size,
      mime_type: mimeType,
      local_file_path: localPath,
      upload_status: 'local',
      is_active: true,
    } as any);

    if (mimeType.startsWith('image')) {
      emitDiaryPhotoAdded({ mediaId, mimeType });
    }

    queueRef.current.push({ mediaId, localPath, mimeType });
    processQueue();
    return mediaId;
  }, []);

  const processQueue = useCallback(async () => {
    if (uploadingRef.current || queueRef.current.length === 0) return;
    if (!isConnected) return;

    uploadingRef.current = true;
    const item = queueRef.current[0];

    try {
      const media = await diaryService.createMedia({
        media_type: item.mimeType.startsWith('video') ? 'video' : item.mimeType.startsWith('audio') ? 'voice' : 'image',
        file_size_bytes: 0,
        mime_type: item.mimeType,
      });

      const { url, key } = await diaryService.getUploadUrl(media.id);

      const uploadResult = await FileSystem.uploadAsync(url, item.localPath, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': item.mimeType },
      });

      if (uploadResult.status === 200) {
        await diaryService.updateMedia(media.id, {
          upload_status: 'synced',
          s3_key: key,
        });
        await diaryLocal.media.markUploaded(media.id, key);
        emitDiaryMediaSynced({ mediaId: item.mediaId, s3Key: key });
        logger.info('DiaryMediaUpload: success', { mediaId: item.mediaId, key });
        qc.invalidateQueries({ queryKey: ['diary_media'] });
      } else {
        logger.warn('DiaryMediaUpload: upload failed', { status: uploadResult.status });
      }
    } catch (error) {
      logger.error('DiaryMediaUpload: error', error);
    }

    queueRef.current.shift();
    uploadingRef.current = false;
    processQueue();
  }, [isConnected, qc]);

  useEffect(() => {
    if (isConnected) processQueue();
  }, [isConnected, processQueue]);

  return { enqueue };
}

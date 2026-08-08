import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { generateId } from 'src/utils/uuid';
import { diaryLocal } from '../../services/localDb';
import { useDiary, useCreatePage } from '../../services/queries/diary';
import { useDiaryMediaUpload } from '../../services/diary/useDiaryMediaUpload';
import { resolveDiaryMediaUris } from '../../services/diary/diaryMediaUri';
import { emitDiaryPageSaved } from '../../services/diary/diaryEvents';
import { FloatingToolbar } from './components/FloatingToolbar';
import { ObjectToolOverlay } from './components/ObjectToolOverlay';
import { StickerPicker } from './components/StickerPicker';
import { MoodPicker } from './components/MoodPicker';
import { ScrapbookCanvas } from './components/ScrapbookCanvas';
import { DraggableObject, CanvasObject } from './components/DraggableObject';

export function DiaryEditorScreen({ route, navigation }: any) {
  const { diaryId, pageDate } = route.params ?? {} as any;
  const { top } = useSafeAreaInsets();
  const today = pageDate ?? new Date().toISOString().slice(0, 10);

  const { data: diary } = useDiary(diaryId);
  const createPage = useCreatePage();

  const [pageId, setPageId] = useState<string | null>(null);
  const [pageVersion, setPageVersion] = useState(1);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [mediaUris, setMediaUris] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editTextContent, setEditTextContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const { enqueue: uploadMedia } = useDiaryMediaUpload();
  const syncRef = useRef(diaryLocal.sync);
  const loadedRef = useRef(false);

  const todayStr = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        let pid: string | null = null;
        const existing = await diaryLocal.page.getByDate(diaryId, today);
        if (existing) {
          pid = existing.id;
          setPageVersion(existing.version ?? 1);
        } else {
          const result = await createPage.mutateAsync({ diary_id: diaryId, page_date: today });
          pid = result.id;
        }
        setPageId(pid);
        if (!pid) return;
        const objs = await diaryLocal.object.getByPage(pid);
        setObjects(objs as CanvasObject[]);
      } catch (e) {
        console.warn('DiaryEditor: page init error', e);
      }
    })();
  }, []);

  const persistObjects = useCallback(async (updated: CanvasObject[]) => {
    setObjects(updated);
    for (const obj of updated) {
      await diaryLocal.object.upsert(obj as any);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveDiaryMediaUris(objects.map(o => o.media_id)).then(map => {
      if (!cancelled) setMediaUris(map);
    });
    return () => { cancelled = true; };
  }, [objects]);

  const addObject = useCallback(async (type: string) => {
    if (!pageId) return;
    if (type === 'sticker') { setStickerPickerOpen(true); return; }
    if (type === 'mood') { setShowMoodPicker(true); return; }
    if (type === 'image') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required to add images.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mediaId = await uploadMedia(asset.uri, asset.mimeType ?? 'image/jpeg');
      const newObj: CanvasObject = {
        id: generateId(), page_id: pageId, object_type: 'image',
        position_x: 40 + Math.random() * 120, position_y: 80 + Math.random() * 300,
        width: 240, height: 200, rotation: (Math.random() - 0.5) * 6, z_index: objects.length,
        media_id: mediaId, is_active: true,
      };
      const updated = [...objects, newObj];
      await persistObjects(updated);
      syncRef.current.enqueue({ op_id: newObj.id, op_type: 'ADD_OBJECT', page_id: pageId, page_version: pageVersion, data: newObj as any });
      setToolbarOpen(false);
      return;
    }
    if (type === 'video') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required to add videos.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mediaId = await uploadMedia(asset.uri, asset.mimeType ?? 'video/mp4');
      const newObj: CanvasObject = {
        id: generateId(), page_id: pageId, object_type: 'video',
        position_x: 40 + Math.random() * 120, position_y: 80 + Math.random() * 300,
        width: 280, height: 220, rotation: (Math.random() - 0.5) * 6, z_index: objects.length,
        media_id: mediaId, is_active: true,
      };
      const updated = [...objects, newObj];
      await persistObjects(updated);
      syncRef.current.enqueue({ op_id: newObj.id, op_type: 'ADD_OBJECT', page_id: pageId, page_version: pageVersion, data: newObj as any });
      setToolbarOpen(false);
      return;
    }
    if (type === 'voice') {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Microphone access is required to record voice.'); return; }
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        recordingRef.current = recording;
        setIsRecording(true);
      } catch (e) {
        Alert.alert('Recording failed', 'Could not start voice recording.');
      }
      setToolbarOpen(false);
      return;
    }
    const id = generateId();
    const newObj: CanvasObject = {
      id, page_id: pageId, object_type: type,
      position_x: 40 + Math.random() * 120,
      position_y: 80 + Math.random() * 300,
      width: type === 'text' ? 200 : 180,
      height: type === 'text' ? 100 : 180,
      rotation: (Math.random() - 0.5) * 6,
      z_index: objects.length,
      text_content: type === 'text' ? 'Type here...' : null,
      font_family: type === 'text' ? 'Literata_400Regular' : null,
      font_size: type === 'text' ? 18 : null,
      is_active: true,
    };
    const updated = [...objects, newObj];
    await persistObjects(updated);
    syncRef.current.enqueue({
      op_id: id, op_type: 'ADD_OBJECT', page_id: pageId,
      page_version: pageVersion, data: newObj as any,
    });
    setToolbarOpen(false);
  }, [pageId, objects, pageVersion, persistObjects, uploadMedia]);

  const handleStickerSelect = useCallback(async (emoji: string) => {
    if (!pageId) return;
    setStickerPickerOpen(false);
    const id = generateId();
    const newObj: CanvasObject = {
      id, page_id: pageId, object_type: 'sticker',
      position_x: 40 + Math.random() * 120,
      position_y: 80 + Math.random() * 300,
      width: 64, height: 64,
      rotation: (Math.random() - 0.5) * 6,
      z_index: objects.length,
      sticker_id: emoji,
      is_active: true,
    };
    const updated = [...objects, newObj];
    await persistObjects(updated);
    syncRef.current.enqueue({
      op_id: id, op_type: 'ADD_OBJECT', page_id: pageId,
      page_version: pageVersion, data: newObj as any,
    });
    setToolbarOpen(false);
  }, [pageId, objects, pageVersion, persistObjects]);

  const handleMoodSelect = useCallback(async (mood: string) => {
    if (!pageId) return;
    const id = generateId();
    const newObj: CanvasObject = {
      id, page_id: pageId, object_type: 'mood',
      position_x: 40 + Math.random() * 120, position_y: 80 + Math.random() * 300,
      width: 100, height: 80, rotation: (Math.random() - 0.5) * 6, z_index: objects.length,
      text_content: mood, is_active: true,
    };
    const updated = [...objects, newObj];
    await persistObjects(updated);
    syncRef.current.enqueue({
      op_id: id, op_type: 'ADD_OBJECT', page_id: pageId,
      page_version: pageVersion, data: newObj as any,
    });
    setToolbarOpen(false);
  }, [pageId, objects, pageVersion, persistObjects]);

  const stopVoiceRecording = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (!uri || !pageId) return;
      const mediaId = await uploadMedia(uri, 'audio/mp4');
      const id = generateId();
      const newObj: CanvasObject = {
        id, page_id: pageId, object_type: 'voice',
        position_x: 40 + Math.random() * 120, position_y: 80 + Math.random() * 300,
        width: 240, height: 60, rotation: (Math.random() - 0.5) * 6, z_index: objects.length,
        media_id: mediaId, is_active: true,
      };
      const updated = [...objects, newObj];
      await persistObjects(updated);
      syncRef.current.enqueue({
        op_id: id, op_type: 'ADD_OBJECT', page_id: pageId,
        page_version: pageVersion, data: newObj as any,
      });
    } catch (e) {
      Alert.alert('Failed to save recording');
    }
  }, [pageId, objects, pageVersion, persistObjects, uploadMedia]);

  const updateObject = useCallback(async (id: string, patch: Partial<CanvasObject>) => {
    if (!pageId) return;
    const updated = objects.map(o => o.id === id ? { ...o, ...patch } : o);
    await persistObjects(updated);
    syncRef.current.enqueue({
      op_id: generateId(), op_type: 'UPDATE_OBJECT', page_id: pageId,
      page_version: pageVersion, data: { id, ...patch },
    });
  }, [pageId, objects, pageVersion, persistObjects]);

  const deleteObject = useCallback(async (id: string) => {
    if (!pageId) return;
    await diaryLocal.object.softDelete(id);
    const updated = objects.filter(o => o.id !== id);
    setObjects(updated);
    setSelectedId(null);
    syncRef.current.enqueue({
      op_id: generateId(), op_type: 'DELETE_OBJECT', page_id: pageId,
      page_version: pageVersion, data: { id },
    });
  }, [pageId, pageVersion]);

  const bringFront = useCallback((id: string) => {
    const updated = objects.map(o => ({
      ...o,
      z_index: o.id === id ? objects.length : o.z_index,
    }));
    persistObjects(updated);
    syncRef.current.enqueue({
      op_id: generateId(), op_type: 'REORDER_OBJECT', page_id: pageId!,
      page_version: pageVersion, data: { id, z_index: objects.length },
    });
  }, [objects, pageId, pageVersion, persistObjects]);

  const sendBack = useCallback((id: string) => {
    const updated = objects.map(o => ({
      ...o,
      z_index: o.id === id ? 0 : o.z_index + 1,
    }));
    persistObjects(updated);
    syncRef.current.enqueue({
      op_id: generateId(), op_type: 'REORDER_OBJECT', page_id: pageId!,
      page_version: pageVersion, data: { id, z_index: 0 },
    });
  }, [objects, pageId, pageVersion, persistObjects]);

  const duplicateObject = useCallback(async (id: string) => {
    if (!pageId) return;
    const src = objects.find(o => o.id === id);
    if (!src) return;
    const newId = generateId();
    const dup: CanvasObject = {
      ...src, id: newId, position_x: src.position_x + 20, position_y: src.position_y + 20,
    };
    const updated = [...objects, dup];
    await persistObjects(updated);
    setSelectedId(newId);
    syncRef.current.enqueue({
      op_id: newId, op_type: 'ADD_OBJECT', page_id: pageId,
      page_version: pageVersion, data: dup as any,
    });
  }, [pageId, objects, pageVersion, persistObjects]);

  const finishEditing = useCallback(async () => {
    setSaving(true);
    try {
      if (pageId) {
        await syncRef.current.flush(pageId);
        emitDiaryPageSaved({ diaryId, pageId });
      }
    } finally {
      setSaving(false);
      navigation.goBack();
    }
  }, [pageId, diaryId, navigation]);

  const selected = objects.find(o => o.id === selectedId);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleDragStart = useCallback((id: string) => {
    const obj = objects.find(o => o.id === id);
    if (obj) dragStartRef.current = { x: obj.position_x, y: obj.position_y };
  }, [objects]);

  const handleDragMove = useCallback((id: string, dx: number, dy: number) => {
    const start = dragStartRef.current;
    if (!start) return;
    setObjects(prev => prev.map(o =>
      o.id === id ? { ...o, position_x: start.x + dx / 2, position_y: start.y + dy / 2 } : o
    ));
  }, []);

  const handleDragRelease = useCallback((id: string, dx: number, dy: number) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) return;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      updateObject(id, {
        position_x: start.x + dx / 2,
        position_y: start.y + dy / 2,
      });
    }
  }, [updateObject]);

  const handleStartEdit = useCallback((id: string, content: string) => {
    setEditingTextId(id);
    setEditTextContent(content);
  }, []);

  const handleEditBlur = useCallback((id: string, text: string) => {
    updateObject(id, { text_content: text });
    setEditingTextId(null);
  }, [updateObject]);

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerAction}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{diary?.title ?? 'Memory Diary'}</Text>
          <Text style={styles.headerDate}>{todayStr}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, saving && styles.savingDot]} />
          <TouchableOpacity onPress={finishEditing} style={styles.checkBtn} disabled={saving}>
            <Text style={styles.checkText}>{saving ? '...' : '✓'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrapbookCanvas background="paper">
        {objects
          .filter(o => o.is_active)
          .sort((a, b) => a.z_index - b.z_index)
          .map(obj => (
            <DraggableObject
              key={obj.id}
              obj={obj}
              isSelected={selectedId === obj.id}
              today={today}
              mediaUri={mediaUris[obj.media_id ?? '']}
              editingTextId={editingTextId}
              editTextContent={editTextContent}
              onSelect={setSelectedId}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragRelease={handleDragRelease}
              onUpdate={updateObject}
              onStartEdit={handleStartEdit}
              onEditChange={setEditTextContent}
              onEditBlur={handleEditBlur}
            />
          ))}
      </ScrapbookCanvas>

      {selectedId && selected && (
        <View style={styles.toolOverlayWrap}>
          <ObjectToolOverlay
            onEdit={selected.object_type === 'text' ? () => { setEditingTextId(selected.id); setEditTextContent(selected.text_content ?? ''); } : undefined}
            onDuplicate={() => duplicateObject(selected.id)}
            onDelete={() => deleteObject(selected.id)}
            onBringFront={() => bringFront(selected.id)}
            onSendBack={() => sendBack(selected.id)}
          />
        </View>
      )}

      <FloatingToolbar
        isOpen={toolbarOpen}
        onToggle={() => setToolbarOpen(prev => !prev)}
        onAdd={addObject}
      />

      <StickerPicker
        visible={stickerPickerOpen}
        onSelect={handleStickerSelect}
        onClose={() => setStickerPickerOpen(false)}
      />

      <MoodPicker
        visible={showMoodPicker}
        onSelect={handleMoodSelect}
        onClose={() => setShowMoodPicker(false)}
      />

      {isRecording && (
        <View style={styles.recordingBar}>
          <Text style={styles.recordingText}>🔴 Recording...</Text>
          <TouchableOpacity onPress={stopVoiceRecording} style={styles.stopBtn}>
            <Text style={styles.stopBtnText}>■ Stop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f1' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#fbf9f1',
  },
  headerAction: { fontSize: 24, color: '#410403' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 18, color: '#410403' },
  headerDate: { fontFamily: 'WorkSans_400Regular', fontSize: 11, color: '#88726f', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7d562d' },
  savingDot: { backgroundColor: '#ba1a1a' },
  checkBtn: {
    backgroundColor: '#410403', width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  checkText: { color: '#fff', fontSize: 16 },
  toolOverlayWrap: {
    position: 'absolute', bottom: 120, alignSelf: 'center',
  },
  recordingBar: {
    position: 'absolute', bottom: 100, left: 24, right: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#410403', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20,
  },
  recordingText: { fontFamily: 'WorkSans_500Medium', fontSize: 14, color: '#fff' },
  stopBtn: {
    backgroundColor: '#ba1a1a', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 16,
  },
  stopBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 12, color: '#fff' },
});

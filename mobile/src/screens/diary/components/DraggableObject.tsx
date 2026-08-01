import React, { useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, PanResponder, StyleSheet, Image,
} from 'react-native';
import { PolaroidFrame } from './PolaroidFrame';
import { ResizeHandles } from './ResizeHandles';
import { MemoryChip } from './MemoryChip';
import { DateStamp } from './DateStamp';
import { MoodBadge } from './MoodBadge';
import { VintageStamp } from './VintageStamp';

export interface CanvasObject {
  id: string; page_id: string; object_type: string;
  position_x: number; position_y: number;
  width: number; height: number; rotation: number; z_index: number;
  text_content?: string | null; font_family?: string | null;
  font_size?: number | null; color?: string | null;
  media_id?: string | null; sticker_id?: string | null;
  is_active: boolean;
}

interface Props {
  obj: CanvasObject;
  isSelected: boolean;
  today: string;
  editingTextId: string | null;
  editTextContent: string;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onDragRelease: (id: string, dx: number, dy: number) => void;
  onUpdate: (id: string, patch: Partial<CanvasObject>) => void;
  onStartEdit: (id: string, content: string) => void;
  onEditChange: (text: string) => void;
  onEditBlur: (id: string, text: string) => void;
}

function DraggableObjectBase({
  obj, isSelected, today,
  editingTextId, editTextContent,
  onSelect, onDragStart, onDragMove, onDragRelease, onUpdate,
  onStartEdit, onEditChange, onEditBlur,
}: Props) {
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { onSelect(obj.id); onDragStart(obj.id); },
    onPanResponderMove: (_, gs) => onDragMove(obj.id, gs.dx, gs.dy),
    onPanResponderRelease: (_, gs) => onDragRelease(obj.id, gs.dx, gs.dy),
  })).current;

  function renderContent() {
    switch (obj.object_type) {
      case 'text':
        if (editingTextId === obj.id) {
          return (
            <TextInput
              style={[styles.textInput, obj.font_family ? { fontFamily: obj.font_family } : null, obj.font_size ? { fontSize: obj.font_size } : null]}
              value={editTextContent}
              onChangeText={onEditChange}
              onBlur={() => onEditBlur(obj.id, editTextContent)}
              autoFocus
              multiline
            />
          );
        }
        return (
          <TouchableOpacity onPress={() => onStartEdit(obj.id, obj.text_content ?? '')}>
            <Text style={[styles.textContent, obj.font_family ? { fontFamily: obj.font_family } : null, obj.font_size ? { fontSize: obj.font_size } : null]}>
              {obj.text_content}
            </Text>
          </TouchableOpacity>
        );
      case 'sticker':
        return <Text style={styles.sticker}>{obj.sticker_id ?? '🌸'}</Text>;
      case 'photo':
        return <PolaroidFrame imageUri={obj.media_id ?? undefined} width={obj.width} rotation={obj.rotation} />;
      case 'image':
        return <Image source={{ uri: obj.media_id ?? undefined }} style={styles.image} resizeMode="cover" />;
      case 'video':
        return (
          <View style={styles.video}>
            <Text style={styles.videoIcon}>🎬</Text>
            <Text style={styles.videoLabel}>Video</Text>
          </View>
        );
      case 'voice':
        return (
          <View style={styles.voice}>
            <Text style={styles.voiceIcon}>🎤</Text>
            <Text style={styles.voiceLabel}>Voice note</Text>
          </View>
        );
      case 'memory_tag':
        return <MemoryChip label={obj.text_content ?? 'tag'} variant="tag" />;
      case 'memory_location':
        return <MemoryChip label={obj.text_content ?? ''} variant="location" />;
      case 'memory_person':
        return <MemoryChip label={obj.text_content ?? ''} variant="person" />;
      case 'date':
        return <DateStamp date={today} />;
      case 'mood':
        return <MoodBadge mood={obj.text_content ?? 'calm'} />;
      case 'stamp':
        return <VintageStamp text={obj.text_content ?? 'treasured'} rotation={obj.rotation} />;
      default:
        return <Text style={styles.unknown}>?</Text>;
    }
  }

  return (
    <View
      style={[
        styles.object,
        {
          left: obj.position_x, top: obj.position_y,
          width: obj.width, height: obj.height,
          transform: [{ rotate: `${obj.rotation ?? 0}deg` }],
          zIndex: obj.z_index,
        },
        isSelected && styles.selected,
      ]}
      {...pan.panHandlers}
    >
      {renderContent()}
      {isSelected && (
        <ResizeHandles
          width={obj.width}
          height={obj.height}
          onResize={(w, h) => onUpdate(obj.id, { width: Math.max(40, w), height: Math.max(40, h) })}
          onRotate={(deg) => onUpdate(obj.id, { rotation: (obj.rotation ?? 0) + deg })}
        />
      )}
    </View>
  );
}

export const DraggableObject = React.memo(DraggableObjectBase);

const styles = StyleSheet.create({
  object: { position: 'absolute', minWidth: 40, minHeight: 40 },
  selected: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#410403', borderRadius: 4 },
  textContent: { fontSize: 18, color: '#1b1c17', lineHeight: 30 },
  textInput: {
    fontSize: 18, color: '#1b1c17', lineHeight: 30,
    backgroundColor: '#fffcf5', padding: 8, borderRadius: 4,
    borderWidth: 1, borderColor: '#e4e3db', minWidth: 160,
  },
  sticker: { fontSize: 48 },
  unknown: { fontSize: 20, color: '#88726f' },
  image: { width: '100%', height: '100%', borderRadius: 4 },
  video: {
    width: '100%', height: '100%', backgroundColor: '#1b1c17', borderRadius: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  videoIcon: { fontSize: 32 },
  videoLabel: { fontFamily: 'WorkSans_500Medium', fontSize: 10, color: '#fff', marginTop: 4 },
  voice: {
    width: '100%', height: '100%', backgroundColor: '#f0eee6', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8,
  },
  voiceIcon: { fontSize: 20 },
  voiceLabel: { fontFamily: 'WorkSans_500Medium', fontSize: 12, color: '#554240' },
});

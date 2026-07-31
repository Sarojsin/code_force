import { View, PanResponder, StyleSheet } from 'react-native';

interface ResizeHandlesProps {
  width: number;
  height: number;
  onResize?: (w: number, h: number) => void;
  onRotate?: (deg: number) => void;
}

const HANDLE_SIZE = 20;

function Handle({ onMove }: { onMove: (dx: number, dy: number) => void }) {
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => onMove(g.dx, g.dy),
    onPanResponderRelease: (_, g) => onMove(g.dx, g.dy),
  });
  return <View style={styles.handle} {...pan.panHandlers} />;
}

export function ResizeHandles({ width, height, onResize, onRotate }: ResizeHandlesProps) {
  return (
    <>
      <Handle onMove={(dx) => onResize?.(width + dx, height)} />
      <View style={[styles.corner, { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 }]}>
        <Handle onMove={(dx, dy) => onResize?.(width - dx, height - dy)} />
      </View>
      <View style={[styles.corner, { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 }]}>
        <Handle onMove={(dx, dy) => onResize?.(width + dx, height - dy)} />
      </View>
      <View style={[styles.corner, { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 }]}>
        <Handle onMove={(dx, dy) => onResize?.(width - dx, height + dy)} />
      </View>
      <View style={[styles.corner, { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 }]}>
        <Handle onMove={(dx, dy) => onResize?.(width + dx, height + dy)} />
      </View>
      <View style={[styles.rotateGrip, { top: -32, alignSelf: 'center' }]}>
        <Handle onMove={(dx) => onRotate?.(dx * 0.5)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#fbf9f1',
    borderWidth: 2,
    borderColor: '#410403',
  },
  corner: { position: 'absolute' },
  rotateGrip: { position: 'absolute' },
});

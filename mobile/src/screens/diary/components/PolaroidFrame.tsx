import { View, Text, Image, StyleSheet } from 'react-native';

interface PolaroidFrameProps {
  imageUri?: string;
  caption?: string;
  rotation?: number;
  width?: number;
}

export function PolaroidFrame({ imageUri, caption, rotation = 0, width = 180 }: PolaroidFrameProps) {
  const border = 12;
  const imgSize = width - border * 2;
  return (
    <View style={[styles.frame, { width, transform: [{ rotate: `${rotation}deg` }] }]}>
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: imgSize, height: imgSize * 0.8 }} />
        ) : (
          <View style={[styles.placeholder, { width: imgSize, height: imgSize * 0.8 }]} />
        )}
      </View>
      {caption ? (
        <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 2,
    shadowColor: '#410403',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  imageWrap: { alignItems: 'center' },
  placeholder: { backgroundColor: '#e4e3db', borderRadius: 2 },
  caption: {
    fontFamily: 'Literata_400Regular',
    fontSize: 12,
    color: '#554240',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

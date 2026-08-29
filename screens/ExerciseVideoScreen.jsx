import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function ExerciseVideoScreen({ videoUrl, exerciseName, onClose }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Fechar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{exerciseName}</Text>
      </View>
      <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture nativeControls />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', marginLeft: 16, flexShrink: 1 },
  video: { width: '100%', height: 260, backgroundColor: '#171717' },
});
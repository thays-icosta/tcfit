import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { getYoutubeVideoId } from './youtubeUtils';

function GalleryVideo({ videoUrl }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture nativeControls />;
}

function YoutubeVideo({ videoId }) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;
  if (Platform.OS === 'web') {
    return (
      <iframe
        src={embedUrl}
        style={{ width: '100%', height: 260, border: 0, backgroundColor: '#171717' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <WebView
      source={{ uri: embedUrl }}
      style={styles.video}
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
    />
  );
}

export default function ExerciseVideoScreen({ videoUrl, exerciseName, onClose }) {
  const youtubeId = getYoutubeVideoId(videoUrl);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Fechar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{exerciseName}</Text>
      </View>
      {youtubeId ? <YoutubeVideo videoId={youtubeId} /> : <GalleryVideo videoUrl={videoUrl} />}
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

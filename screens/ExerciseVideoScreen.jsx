import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { getYoutubeVideoId } from './youtubeUtils';
import { HeaderBack } from './Header';

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
      <HeaderBack backLabel="← Fechar" title={exerciseName} onBack={onClose} style={{ paddingHorizontal: 16 }} />
      {youtubeId ? <YoutubeVideo videoId={youtubeId} /> : <GalleryVideo videoUrl={videoUrl} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  video: { width: '100%', height: 260, backgroundColor: '#171717' },
});

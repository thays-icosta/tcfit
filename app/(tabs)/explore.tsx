import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabTwoScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="compass-outline" color="#F97316" size={64} />
      <Text style={styles.title}>TcFit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0A0A0A',
  },
  title: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '800',
    color: '#F5F5F5',
  },
});
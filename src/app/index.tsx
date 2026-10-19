import React from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { scenes } from '../scenes/registry';
import { Preview } from '../ui/Preview';
export default function Gallery() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(210, (width - 60) / 2);
  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>A SMALL MOMENT, MADE YOURS</Text>
        <Text style={styles.title}>Little Scenes</Text>
        <Text style={styles.subtitle}>한 문장을, 작은 작품으로.</Text>
        <View style={styles.cards}>
          {scenes.map((s) => (
            <Pressable
              key={s.id}
              testID={`scene-${s.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${s.kind}. 작품 만들기`}
              onPress={() => router.push(`/scene/${s.id}`)}
              style={{ width: cardWidth }}
            >
              <Preview id={s.id} width={cardWidth} />
              <Text style={styles.kind}>{s.kind}</Text>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.description}>{s.description}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.footer}>
          문구를 바꾸고, 마음에 드는 순간을 공유해요.{'\n'}모든 작품은 오프라인에서도 만들 수
          있어요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f3eb' },
  content: { padding: 24, paddingTop: 36 },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: '#687269' },
  title: { fontSize: 36, fontWeight: '600', color: '#263a30', marginTop: 12 },
  subtitle: { fontSize: 17, color: '#687269', marginTop: 8 },
  cards: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 36,
    justifyContent: 'center',
  },
  kind: { fontSize: 10, color: '#6c756a', marginTop: 12 },
  name: { fontSize: 18, fontWeight: '600', color: '#263a30', marginTop: 6 },
  description: { fontSize: 13, lineHeight: 21, color: '#687269', marginTop: 7 },
  footer: { fontSize: 13, lineHeight: 23, color: '#737b70', marginTop: 36 },
});

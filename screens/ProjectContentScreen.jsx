import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBack } from './Header';
import PdfViewerScreen from './PdfViewerScreen';

const ACCENT = '#FF6B00';

function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <Text style={styles.heading}>{block.text}</Text>;
    case 'paragraph':
      return <Text style={styles.paragraph}>{block.text}</Text>;
    case 'card':
      return (
        <View style={styles.card}>
          {!!block.title && <Text style={styles.cardTitle}>{block.title}</Text>}
          <Text style={styles.cardText}>{block.text}</Text>
        </View>
      );
    case 'topic_list':
      return (
        <View style={styles.card}>
          {(block.items || []).filter(Boolean).map((item, i) => (
            <View key={i} style={styles.topicRow}>
              <View style={styles.topicDot} />
              <Text style={styles.topicText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'highlight':
      return (
        <View style={styles.highlight}>
          <Text style={styles.highlightText}>{block.text}</Text>
        </View>
      );
    case 'tip':
      return (
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={16} color={ACCENT} />
          <Text style={styles.tipText}>{block.text}</Text>
        </View>
      );
    case 'checklist':
      return <ChecklistBlock items={block.items || []} />;
    default:
      return null;
  }
}

function ChecklistBlock({ items }) {
  const [checked, setChecked] = useState({});
  return (
    <View style={styles.card}>
      {items.filter(Boolean).map((item, i) => (
        <TouchableOpacity key={i} style={styles.checklistRow} onPress={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}>
          <Ionicons name={checked[i] ? 'checkbox' : 'square-outline'} size={18} color={checked[i] ? ACCENT : '#737373'} />
          <Text style={[styles.checklistText, checked[i] && styles.checklistTextDone]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Renders a project_contents row (jsonb `blocks` array) as short, card-based
// screens — títulos/cards/tópicos/destaques/dicas/checklists, never a big
// wall of text. `template.ebook_pdf_url` (if set) is the complementary
// e-book, opened via the existing PdfViewerScreen unchanged.
export default function ProjectContentScreen({ content, template, onClose, onMarkDone, alreadyDone }) {
  const [showPdf, setShowPdf] = useState(false);

  if (showPdf) {
    return <PdfViewerScreen fileUrl={template.ebook_pdf_url} title="E-book" onClose={() => setShowPdf(false)} />;
  }

  return (
    <View style={styles.container}>
      <HeaderBack title={content.title} onBack={onClose} style={{ paddingHorizontal: 16 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {!!content.subtitle && <Text style={styles.subtitle}>{content.subtitle}</Text>}
        {(content.blocks || []).map((block, i) => <Block key={i} block={block} />)}

        {!!template?.ebook_pdf_url && (
          <TouchableOpacity style={styles.ebookButton} onPress={() => setShowPdf(true)}>
            <Ionicons name="document-attach-outline" size={16} color={ACCENT} />
            <Text style={styles.ebookButtonText}>Baixar E-book completo</Text>
          </TouchableOpacity>
        )}

        {!alreadyDone && (
          <TouchableOpacity style={styles.doneButton} onPress={onMarkDone}>
            <Text style={styles.doneButtonText}>Concluir</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  subtitle: { color: '#a3a3a3', fontSize: 13, marginBottom: 12 },
  heading: { color: '#F5F5F7', fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  paragraph: { color: '#d4d4d4', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  card: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  cardText: { color: '#d4d4d4', fontSize: 13, lineHeight: 19 },
  topicRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  topicDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginTop: 6 },
  topicText: { color: '#d4d4d4', fontSize: 13, flex: 1, lineHeight: 19 },
  highlight: { backgroundColor: 'rgba(255,107,0,0.1)', borderLeftWidth: 3, borderLeftColor: ACCENT, borderRadius: 10, padding: 14, marginBottom: 12 },
  highlightText: { color: '#F5F5F7', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 12, marginBottom: 12 },
  tipText: { color: '#d4d4d4', fontSize: 12, flex: 1, lineHeight: 18 },
  checklistRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 },
  checklistText: { color: '#d4d4d4', fontSize: 13, flex: 1 },
  checklistTextDone: { color: '#737373', textDecorationLine: 'line-through' },
  ebookButton: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, marginTop: 6, marginBottom: 16 },
  ebookButtonText: { color: ACCENT, fontSize: 12, fontWeight: '600' },
  doneButton: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  doneButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '700' },
});

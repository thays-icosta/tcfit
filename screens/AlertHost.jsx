import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerAlertHost } from './alertUtils';

// In-app replacement for the browser's window.alert/confirm/prompt that
// showAlert() used on web. Mounted once in the root layout; showAlert()
// hands it {title, message, buttons} and keeps the exact same signature, so
// every existing call site picks this up without changes.
//
// Two layouts, chosen from the buttons themselves:
//   - decision sheet (2+ non-cancel options): bottom sheet, big stacked
//     buttons, first option highlighted in the brand orange
//   - dialog (0–1 options): centered card, Cancelar + confirm side by side

const ERROR_RE = /^(erro|ops\b|não\b|nao\b|falha|sessão|sessao)/i;
const WARNING_RE = /(atenção|atencao|cuidado)/i;
const SUCCESS_RE = /(feito|aplicado|enviado|salvo|gerado|criado|pronto|copiado|conclu[ií]d|sucesso)/i;

const TONES = {
  danger: { icon: 'warning', color: '#ef4444' },
  error: { icon: 'alert-circle', color: '#ef4444' },
  warning: { icon: 'warning', color: '#f59e0b' },
  success: { icon: 'checkmark-circle', color: '#22c55e' },
  info: { icon: 'information-circle', color: '#FF6B00' },
};

function inferTone(title, actions) {
  if (actions.some((b) => b.style === 'destructive')) return 'danger';
  const t = title || '';
  if (WARNING_RE.test(t)) return 'warning';
  if (ERROR_RE.test(t)) return 'error';
  if (SUCCESS_RE.test(t)) return 'success';
  return 'info';
}

let nextId = 1;

export default function AlertHost() {
  const [queue, setQueue] = useState([]);

  useEffect(() => registerAlertHost((alert) => setQueue((q) => [...q, { ...alert, id: nextId++ }])), []);

  const current = queue[0];
  if (!current) return null;

  const buttons = current.buttons && current.buttons.length > 0 ? current.buttons : [{ text: 'OK' }];
  const cancel = buttons.find((b) => b.style === 'cancel');
  const actions = buttons.filter((b) => b.style !== 'cancel');
  const isSheet = actions.length >= 2;

  // onPress runs on the next tick so a button that itself calls showAlert()
  // queues its alert behind this one instead of racing the unmount.
  const close = (button) => {
    setQueue((q) => q.slice(1));
    if (button?.onPress) setTimeout(() => button.onPress(), 0);
  };

  // Tapping outside / Android back: cancels when there's a Cancelar, counts
  // as the acknowledgement for a plain info alert, and does nothing for a
  // multi-option sheet or a lone destructive action (never fire those by accident).
  const dismiss = () => {
    if (cancel) close(cancel);
    else if (actions.length <= 1) close(actions[0]?.style === 'destructive' ? null : actions[0]);
  };

  const tone = TONES[inferTone(current.title, actions)];

  const header = (
    <>
      {!isSheet && (
        <View style={[styles.iconCircle, { backgroundColor: `${tone.color}1F`, borderColor: tone.color }]}>
          <Ionicons name={tone.icon} size={24} color={tone.color} />
        </View>
      )}
      <Text style={[styles.title, isSheet && styles.titleLeft]}>{current.title}</Text>
      {current.message ? (
        <ScrollView style={styles.messageScroll} bounces={false}>
          <Text style={[styles.message, isSheet && styles.messageLeft]}>{current.message}</Text>
        </ScrollView>
      ) : null}
    </>
  );

  return (
    <Modal key={current.id} visible transparent animationType={isSheet ? 'slide' : 'fade'} onRequestClose={dismiss}>
      <View style={[styles.overlay, isSheet && styles.overlaySheet]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Fechar" />

        {isSheet ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {header}
            <View style={styles.optionList}>
              {actions.map((b, i) => {
                const destructive = b.style === 'destructive';
                const primary = i === 0 && !destructive;
                return (
                  <TouchableOpacity
                    key={`${b.text}-${i}`}
                    accessibilityRole="button"
                    style={[styles.option, primary && styles.optionPrimary, destructive && styles.optionDanger]}
                    onPress={() => close(b)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionText, primary && styles.optionTextPrimary, destructive && styles.optionTextDanger]}>
                      {b.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {cancel && (
              <TouchableOpacity accessibilityRole="button" style={styles.sheetCancel} onPress={() => close(cancel)}>
                <Text style={styles.sheetCancelText}>{cancel.text || 'Cancelar'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            {header}
            <View style={styles.buttonRow}>
              {cancel && (
                <TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={() => close(cancel)}>
                  <Text style={styles.cancelButtonText}>{cancel.text || 'Cancelar'}</Text>
                </TouchableOpacity>
              )}
              {actions.map((b, i) => {
                const destructive = b.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={`${b.text}-${i}`}
                    accessibilityRole="button"
                    style={[styles.confirmButton, destructive && styles.confirmButtonDanger]}
                    onPress={() => close(b)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.confirmButtonText, destructive && styles.confirmButtonTextDanger]}>{b.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  overlaySheet: { justifyContent: 'flex-end', paddingHorizontal: 0 },

  card: { width: '100%', maxWidth: 400, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 22, padding: 22, alignItems: 'center' },
  iconCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#F5F5F7', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  titleLeft: { textAlign: 'left', alignSelf: 'stretch' },
  messageScroll: { maxHeight: 240, alignSelf: 'stretch', marginTop: 8 },
  message: { color: '#a3a3a3', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  messageLeft: { textAlign: 'left' },

  buttonRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 22 },
  cancelButton: { flex: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: '#a3a3a3', fontSize: 14, fontWeight: '700' },
  confirmButton: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  confirmButtonDanger: { backgroundColor: '#ef4444' },
  confirmButtonTextDanger: { color: '#FFFFFF' },

  sheet: { width: '100%', maxWidth: 480, backgroundColor: '#1C1C22', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#2B2B36', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#3a3a46', alignSelf: 'center', marginBottom: 16 },
  optionList: { gap: 10, marginTop: 18 },
  option: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  optionPrimary: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  optionDanger: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444' },
  optionText: { color: '#F5F5F7', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  optionTextPrimary: { color: '#0F0F12', fontWeight: '800' },
  optionTextDanger: { color: '#ef4444' },
  sheetCancel: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  sheetCancelText: { color: '#a3a3a3', fontSize: 14, fontWeight: '700' },
});

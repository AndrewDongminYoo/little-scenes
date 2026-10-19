import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Button } from './Button';
import { validateText } from '../domain/model';
export function TextEditor({
  initial,
  onApply,
  onClose,
}: {
  initial: string;
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState('');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={styles.panel} accessibilityViewIsModal>
          <Text style={styles.title}>어떤 문구를 남길까요?</Text>
          <Text style={styles.hint}>한글·영문·숫자, 40자 · 최대 세 줄</Text>
          <TextInput
            testID="phrase-input"
            accessibilityLabel="작품 문구"
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            style={styles.input}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <View style={styles.row}>
            <Button label="취소" onPress={onClose} />
            <Button
              testID="apply-phrase"
              label="적용"
              selected
              onPress={() => {
                const result = validateText(draft);
                if (!result.ok) {
                  setError(result.error!);
                  return;
                }
                onApply(result.text);
              }}
            />
            <Button label="문구 비우기" onPress={() => onApply('')} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0005' },
  panel: {
    backgroundColor: '#f7f3eb',
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: { fontSize: 20, color: '#263a30', fontWeight: '600' },
  hint: { fontSize: 12, color: '#687269', marginTop: 8 },
  input: {
    minHeight: 110,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#a9b1a4',
    borderRadius: 12,
    marginVertical: 16,
    padding: 14,
    fontSize: 22,
    color: '#263a30',
    textAlignVertical: 'top',
  },
  error: { color: '#9a302b', marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

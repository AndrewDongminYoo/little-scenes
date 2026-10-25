import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
export function Button({
  label,
  onPress,
  disabled = false,
  selected = false,
  testID,
  hint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
  /** Spoken after the label; use it to say what a cycling button changes to. */
  hint?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPressIn={() => console.error('[press-trace]', label, 'in')}
      onPressOut={() => console.error('[press-trace]', label, 'out')}
      onPress={() => {
        console.error('[press-trace]', label, 'press');
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.text, selected && { color: '#fff8ed' }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#e8e2d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: '#384a42' },
  text: { fontSize: 14, fontWeight: '600', color: '#29382f' },
});

import { Keyboard } from 'react-native';

// "Tap anywhere outside to close the keyboard" wrappers (Pressable /
// TouchableWithoutFeedback around a whole screen) call Keyboard.dismiss from
// onPress. On web a tap on a TextInput inside that wrapper ALSO bubbles up as
// a click on the wrapper, so the field was focused and then blurred in the
// same tap: on a phone the keyboard flashed and closed, and the field
// "didn't work" (this is what broke the Kg/Reps fields on workout execution).
// Taps that start on a text field must not dismiss anything.
export function dismissKeyboardUnlessTyping(event) {
  const target = event && (event.target || (event.nativeEvent && event.nativeEvent.target));
  const tag = target && typeof target.tagName === 'string' ? target.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  Keyboard.dismiss();
}

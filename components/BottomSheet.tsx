import { View, Text, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="bg-background dark:bg-background-dark rounded-t-3xl p-6 pb-10 shadow-xl"
          onStartShouldSetResponder={() => true}
        >
          <View className="w-10 h-1 bg-text-secondary/30 rounded-full self-center mb-4" />
          {title && (
            <Text className="text-lg font-bold text-text dark:text-text-dark mb-4">
              {title}
            </Text>
          )}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

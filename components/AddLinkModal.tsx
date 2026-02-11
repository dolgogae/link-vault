import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { analyzeAndSaveLink } from '@/services/links';
import { useLinkStore } from '@/stores/linkStore';

interface AddLinkModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (categoryPath: string[]) => void;
}

export function AddLinkModal({ visible, onClose, onSaved }: AddLinkModalProps) {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { incrementSaveCount } = useLinkStore();

  const isValidUrl = (text: string) => {
    try {
      new URL(text.startsWith('http') ? text : `https://${text}`);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    if (!isValidUrl(normalizedUrl)) {
      Alert.alert('오류', '유효한 URL을 입력해주세요.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeAndSaveLink(normalizedUrl);
      incrementSaveCount();
      Alert.alert(
        '저장 완료',
        `[${result.categoryPath.join(' > ')}]에 저장되었습니다.`,
      );
      setUrl('');
      onSaved?.(result.categoryPath);
      onClose();
    } catch (error: any) {
      const message =
        error.code === 'already-exists'
          ? '이미 저장된 링크입니다.'
          : error.message || '링크 저장에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-background dark:bg-background-dark rounded-t-3xl p-6 pb-10 shadow-xl">
          {/* 핸들 */}
          <View className="w-10 h-1 bg-text-secondary/30 rounded-full self-center mb-6" />

          <Text className="text-lg font-bold text-text dark:text-text-dark mb-4">
            링크 추가
          </Text>

          {/* URL 입력 */}
          <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl px-4 py-3 mb-4">
            <FontAwesome name="link" size={16} color="#9CA3AF" />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="URL을 입력하거나 붙여넣기"
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-3 text-base text-text dark:text-text-dark"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
              editable={!isAnalyzing}
            />
          </View>

          {/* 저장 버튼 */}
          <Pressable
            onPress={handleSave}
            disabled={!url.trim() || isAnalyzing}
            className={`py-4 rounded-xl items-center ${
              url.trim() && !isAnalyzing
                ? 'bg-primary active:bg-primary-dark'
                : 'bg-text-secondary/20'
            }`}
          >
            {isAnalyzing ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text className="text-white text-base font-semibold ml-2">
                  AI 분석 중...
                </Text>
              </View>
            ) : (
              <Text
                className={`text-base font-semibold ${
                  url.trim() ? 'text-white' : 'text-text-secondary'
                }`}
              >
                저장하기
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

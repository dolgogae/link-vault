import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { analyzeAndSaveLink } from '@/services/links';
import { useLinkStore } from '@/stores/linkStore';

interface AddLinkModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (categoryPath: string[], categoryIds: string[]) => void;
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
      setUrl('');
      onClose();
      Alert.alert(
        '저장 완료',
        `[${result.categoryPath.join(' > ')}]에 저장되었습니다.`,
        [
          { text: '확인' },
          {
            text: '바로가기',
            onPress: () => onSaved?.(result.categoryPath, result.categoryIds),
          },
        ],
      );
    } catch (error: any) {
      const message =
        error.code === 'already-exists'
          ? '이미 저장된 링크입니다.'
          : error.message || '링크 저장에 실패했습니다.';
      Alert.alert('오류', `[${error.code}] ${message}\n\n${error.details || ''}`);
      console.error('링크 저장 에러:', error.code, error.message, error.details);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    if (isAnalyzing) return;
    setUrl('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center items-center px-6"
      >
        <Pressable className="absolute inset-0 bg-black/40" onPress={handleClose} />
        <View
          className="bg-background dark:bg-background-dark rounded-2xl p-6 w-full shadow-xl"
          style={{ elevation: 10 }}
          onStartShouldSetResponder={() => true}
        >
          <Text className="text-lg font-bold text-text dark:text-text-dark mb-2">
            링크 추가
          </Text>
          <Text className="text-sm text-text-secondary dark:text-text-dark-secondary mb-4">
            URL을 입력하면 AI가 자동으로 적절한 폴더에 분류합니다
          </Text>

          <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl px-4 py-3 mb-5">
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
              onSubmitEditing={handleSave}
              returnKeyType="go"
            />
          </View>

          <View className="flex-row justify-end">
            <Pressable
              onPress={handleClose}
              disabled={isAnalyzing}
              className="px-4 py-2.5 mr-2"
            >
              <Text className="text-text-secondary text-base">취소</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!url.trim() || isAnalyzing}
              className={`rounded-xl px-5 py-2.5 ${
                url.trim() && !isAnalyzing
                  ? 'bg-primary active:bg-primary-dark'
                  : 'bg-text-secondary/20'
              }`}
            >
              {isAnalyzing ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white text-base font-semibold ml-2">
                    분석 중...
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

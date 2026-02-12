import { View, Text, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="items-center pt-20">
      <FontAwesome name={icon} size={48} color="#9CA3AF" />
      <Text className="text-base text-text-secondary dark:text-text-dark-secondary mt-4">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-sm text-text-secondary/60 mt-1">
          {subtitle}
        </Text>
      )}
      {action && (
        <Pressable
          onPress={action.onPress}
          className="mt-4 bg-primary px-6 py-2.5 rounded-xl"
        >
          <Text className="text-white font-medium">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

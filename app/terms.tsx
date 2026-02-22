import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

export default function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '이용약관', presentation: 'modal' }} />
      <ScrollView className="flex-1 bg-background dark:bg-background-dark px-5 py-6">
        <Text className="text-2xl font-bold text-text dark:text-text-dark mb-6">
          이용약관
        </Text>

        <Section title="제1조 (목적)">
          {`본 약관은 LinkVault(이하 "앱")가 제공하는 서비스의 이용 조건 및 절차, 이용자와 앱의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.`}
        </Section>

        <Section title="제2조 (정의)">
          {`1. "서비스"란 앱이 제공하는 링크 저장, 분류, 관리 등의 기능을 말합니다.
2. "이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.
3. "콘텐츠"란 이용자가 서비스에 저장한 링크, 카테고리 등의 데이터를 말합니다.`}
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          {`1. 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.
2. 앱은 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 앱 내 공지를 통해 효력이 발생합니다.
3. 이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.`}
        </Section>

        <Section title="제4조 (서비스의 제공)">
          {`앱은 다음과 같은 서비스를 제공합니다.

1. URL 링크 저장 및 관리
2. 링크 자동 분류 및 카테고리 관리
3. 링크 메타데이터 자동 추출 (제목, 설명, 이미지)
4. 링크 검색 및 즐겨찾기
5. 기타 앱이 정하는 서비스`}
        </Section>

        <Section title="제5조 (회원가입 및 계정)">
          {`1. 이용자는 Google 또는 Apple 계정을 통해 회원가입할 수 있습니다.
2. 이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.
3. 계정에 관한 관리 책임은 이용자에게 있습니다.`}
        </Section>

        <Section title="제6조 (이용자의 의무)">
          {`이용자는 다음 행위를 해서는 안 됩니다.

1. 타인의 개인정보를 수집, 저장, 공개하는 행위
2. 서비스를 이용하여 법령에 위반되는 행위
3. 서비스의 안정적 운영을 방해하는 행위
4. 앱의 사전 동의 없이 서비스를 상업적으로 이용하는 행위
5. 기타 공공질서 및 미풍양속에 반하는 행위`}
        </Section>

        <Section title="제7조 (서비스의 변경 및 중단)">
          {`1. 앱은 운영상, 기술상의 필요에 따라 서비스를 변경할 수 있습니다.
2. 앱은 천재지변, 시스템 장애 등 불가항력적 사유로 서비스를 일시적으로 중단할 수 있습니다.
3. 앱은 서비스 중단 시 사전에 공지합니다. 단, 긴급한 경우 사후에 공지할 수 있습니다.`}
        </Section>

        <Section title="제8조 (콘텐츠의 관리)">
          {`1. 이용자가 저장한 콘텐츠에 대한 권리와 책임은 이용자에게 있습니다.
2. 앱은 이용자의 콘텐츠를 서비스 제공 목적 외에 사용하지 않습니다.
3. 회원 탈퇴 시 이용자의 콘텐츠는 모두 삭제되며 복구할 수 없습니다.`}
        </Section>

        <Section title="제9조 (광고)">
          {`1. 앱은 서비스 운영을 위해 앱 내 광고를 게재할 수 있습니다.
2. 앱은 광고와 관련하여 이용자의 개인정보를 광고주에게 직접 제공하지 않습니다.`}
        </Section>

        <Section title="제10조 (면책조항)">
          {`1. 앱은 이용자가 저장한 외부 링크의 내용에 대해 책임지지 않습니다.
2. 앱은 이용자 간 또는 이용자와 제3자 간 분쟁에 대해 개입하지 않으며 책임지지 않습니다.
3. 앱은 무료로 제공되는 서비스에 대해 관련 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.`}
        </Section>

        <Section title="제11조 (계정 해지 및 탈퇴)">
          {`1. 이용자는 언제든지 앱 내 설정에서 계정을 삭제할 수 있습니다.
2. 계정 삭제 시 모든 데이터는 즉시 삭제되며 복구할 수 없습니다.`}
        </Section>

        <Section title="제12조 (분쟁 해결)">
          {`1. 본 약관에 관한 분쟁은 대한민국 법률을 준거법으로 합니다.
2. 서비스 이용과 관련하여 발생한 분쟁은 민사소송법상의 관할 법원에 제기합니다.`}
        </Section>

        <Section title="부칙">
          {`본 약관은 2025년 1월 1일부터 시행됩니다.`}
        </Section>

        <View className="h-12" />
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View className="mb-6">
      <Text className="text-base font-semibold text-text dark:text-text-dark mb-2">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-text-secondary dark:text-text-dark-secondary">
        {children}
      </Text>
    </View>
  );
}

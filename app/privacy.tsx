import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

export default function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '개인정보처리방침', presentation: 'modal' }} />
      <ScrollView className="flex-1 bg-background dark:bg-background-dark px-5 py-6">
        <Text className="text-2xl font-bold text-text dark:text-text-dark mb-6">
          개인정보처리방침
        </Text>

        <Section title="1. 개인정보의 수집 항목 및 수집 방법">
          {`LinkVault(이하 "앱")는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.

[필수 수집 항목]
- 이메일 주소
- 이름(닉네임)
- 로그인 제공자 정보 (Google, Apple)

[자동 수집 항목]
- 기기 정보 (OS 버전, 기기 모델)
- 앱 사용 기록 (Firebase Analytics)
- 광고 식별자 (AdMob)

[수집 방법]
- 소셜 로그인(Google, Apple) 시 제공받는 정보
- 서비스 이용 과정에서 자동 생성되는 정보`}
        </Section>

        <Section title="2. 개인정보의 수집 및 이용 목적">
          {`수집한 개인정보는 다음 목적으로 이용됩니다.

- 회원 식별 및 서비스 제공
- 저장된 링크 데이터의 관리 및 동기화
- 앱 이용 통계 분석 및 서비스 개선
- 맞춤형 광고 제공 (Google AdMob)
- 고객 문의 대응`}
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          {`회원 탈퇴 시 수집된 개인정보는 즉시 파기됩니다.

단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
- 계약 또는 청약 철회 등에 관한 기록: 5년
- 소비자 불만 또는 분쟁 처리에 관한 기록: 3년`}
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          {`앱은 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.

다만, 아래의 경우에는 예외로 합니다.
- 이용자가 사전에 동의한 경우
- 법령에 의해 요구되는 경우`}
        </Section>

        <Section title="5. 개인정보의 처리 위탁">
          {`앱은 서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁하고 있습니다.

- Google Firebase: 데이터 저장, 인증, 분석
- Google AdMob: 광고 제공`}
        </Section>

        <Section title="6. 이용자의 권리">
          {`이용자는 언제든지 다음 권리를 행사할 수 있습니다.

- 개인정보 열람 요구
- 개인정보 수정 요구
- 개인정보 삭제 요구 (앱 내 '계정 삭제' 기능)
- 개인정보 처리 정지 요구`}
        </Section>

        <Section title="7. 개인정보의 파기">
          {`회원 탈퇴 시 개인정보는 즉시 파기됩니다.

- Firebase Authentication 계정 삭제
- Firestore에 저장된 사용자 데이터 삭제
- 저장된 링크 및 카테고리 데이터 삭제`}
        </Section>

        <Section title="8. 개인정보 보호책임자">
          {`개인정보 처리에 관한 문의는 아래로 연락해 주세요.

이메일: support@linkvault.app`}
        </Section>

        <Section title="9. 개정 이력">
          {`본 개인정보처리방침은 2025년 1월 1일부터 시행됩니다.`}
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

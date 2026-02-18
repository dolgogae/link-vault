# Google Play Store 출시 체크리스트

## 완료된 항목

- [x] 릴리스 키스토어 생성 (`android/app/linkvault-release.keystore`)
- [x] keystore.properties 설정 (`android/keystore.properties`)
- [x] build.gradle 릴리스 서명 설정
- [x] .gitignore에 키스토어 관련 파일 추가
- [x] 릴리스 AAB 빌드 성공 (`android/app/build/outputs/bundle/release/app-release.aab`)

## 해야 할 항목

### 1. AdMob 광고 ID 수정

- [ ] AdMob 콘솔(https://admob.google.com)에서 **배너 광고 단위** 생성
- [ ] AdMob 콘솔에서 **전면(인터스티셜) 광고 단위** 생성
- [ ] `.env` 파일 수정 (현재 앱 ID `~`가 들어가 있음, 광고 단위 ID `/`로 변경 필요)
  ```
  EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-5234234878363803/배너_광고단위_ID
  EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-5234234878363803/전면_광고단위_ID
  ```

### 2. 키스토어 보안

- [ ] `android/keystore.properties`에서 비밀번호 변경 (현재: `linkvault2024`)
- [ ] 키스토어 파일 안전한 곳에 백업 (잃어버리면 앱 업데이트 불가)

### 3. Google Play Console 설정

Play Console: https://play.google.com/console

- [ ] 개발자 계정 등록 ($25 일회성)
- [ ] 새 앱 만들기 (앱 이름, 기본 언어 설정)

### 4. 스토어 등록정보

- [ ] 앱 이름
- [ ] 짧은 설명 (80자 이내)
- [ ] 긴 설명 (4000자 이내)
- [ ] 스크린샷 (휴대전화 최소 2장)
- [ ] 고해상도 아이콘 (512x512)
- [ ] 그래픽 이미지 (1024x500)

### 5. 앱 콘텐츠 설정 (Play Console 내)

- [ ] 개인정보처리방침 URL (광고 + Google 로그인 사용하므로 필수)
- [ ] 콘텐츠 등급 (IARC 설문 작성)
- [ ] 타겟 연령층 설정
- [ ] 광고 포함 여부 → "예"
- [ ] 데이터 안전 섹션 작성 (수집하는 데이터 명시)

### 6. 출시

- [ ] AAB 업로드 (`android/app/build/outputs/bundle/release/app-release.aab`)
- [ ] 심사 제출

## 참고

- AAB 재빌드 명령어: `cd android && ./gradlew bundleRelease`
- 빌드 결과물 경로: `android/app/build/outputs/bundle/release/app-release.aab`
- 앱 버전 변경: `android/app/build.gradle`의 `versionCode`와 `versionName` 수정

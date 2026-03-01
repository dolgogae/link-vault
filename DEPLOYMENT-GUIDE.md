# LinkVault 배포 가이드

출시 전 필요한 모든 작업을 순서대로 정리한 문서.

---

## 1. 사전 준비

### 1-1. 릴리스 키스토어 확인

> 이미 완료됨 (`android/app/linkvault-release.keystore`)

- [ ] `android/keystore.properties` 비밀번호 변경 (현재: `linkvault2024`)
- [ ] 키스토어 파일을 안전한 곳에 백업 (Google Drive, USB 등)
  - **잃어버리면 앱 업데이트가 영구적으로 불가능**

### 1-2. 앱 버전 확인

`android/app/build.gradle`에서 확인:
```
versionCode  → 1 (출시마다 +1)
versionName  → "1.0.0"
```

---

## 2. AdMob 운영 전환

### 2-1. 광고 단위 생성

1. [AdMob 콘솔](https://admob.google.com) 접속
2. 앱 선택 (앱 ID: `ca-app-pub-5234234878363803~8534862763`)
3. **광고 단위** 탭 → **광고 단위 추가**
4. 아래 2개 생성:

| 광고 유형 | 이름 (자유) | 형식 |
|-----------|-------------|------|
| 배너 | `linkvault_banner_home` | 적응형 배너 |
| 전면 | `linkvault_interstitial_save` | 전면 광고 |

5. 생성 후 각 광고 단위 ID를 복사 (형식: `ca-app-pub-5234234878363803/xxxxxxxxxx`)

### 2-2. `.env` 파일 수정

```bash
# 현재 (잘못됨 - 앱 ID가 들어가 있음)
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-5234234878363803~8534862763
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-5234234878363803~8534862763

# 수정 (광고 단위 ID - 슬래시 형식)
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-5234234878363803/여기에_배너_ID
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-5234234878363803/여기에_전면_ID
```

> `~` (앱 ID)가 아니라 `/` (광고 단위 ID)여야 함. 이걸 안 바꾸면 운영 광고가 안 나옴.

### 2-3. AdMob 앱 설정 확인

- [ ] AdMob 콘솔 → 앱 설정 → 앱 스토어 연결 (Play Store 출시 후)
- [ ] 결제 정보 등록 (AdMob 수익 정산용)

---

## 3. Google Play Console 설정

### 3-1. 개발자 계정 등록

1. [Google Play Console](https://play.google.com/console) 접속
2. 개발자 계정 등록 (**$25 일회성**)
3. 본인 확인 완료 (개인 개발자: 신분증, 사업자: 사업자등록증)

### 3-2. 앱 만들기

1. Play Console → **앱 만들기**
2. 설정:
   - 앱 이름: `LinkVault`
   - 기본 언어: `한국어`
   - 앱/게임: `앱`
   - 유료/무료: `무료` (무료→유료 전환 불가, 인앱결제는 무료 앱에서 가능)

### 3-3. 스토어 등록정보

| 항목 | 요구사항 |
|------|----------|
| 앱 이름 | 30자 이내 |
| 짧은 설명 | 80자 이내 |
| 긴 설명 | 4000자 이내 |
| 앱 아이콘 | 512x512 PNG (32bit, 투명 배경 가능) |
| 그래픽 이미지 | 1024x500 JPG/PNG |
| 휴대전화 스크린샷 | 최소 2장, 16:9 또는 9:16, 최소 320px ~ 최대 3840px |

### 3-4. 앱 콘텐츠 설정

Play Console → **앱 콘텐츠** 메뉴에서 모두 작성:

- [ ] **개인정보처리방침**: URL 입력 (앱 내 `privacy.tsx` 내용을 웹에 호스팅)
- [ ] **광고**: "예, 앱에 광고가 포함되어 있습니다"
- [ ] **콘텐츠 등급**: IARC 설문 작성 → 등급 자동 부여
- [ ] **타겟 연령층**: 18세 이상
- [ ] **데이터 안전**: 아래 항목 작성

#### 데이터 안전 섹션 작성 가이드

| 데이터 유형 | 수집 여부 | 공유 여부 | 목적 |
|-------------|-----------|-----------|------|
| 이메일 주소 | 수집 | 공유 안 함 | 계정 관리 |
| 이름 | 수집 | 공유 안 함 | 계정 관리 |
| 앱 활동 (저장된 링크) | 수집 | 공유 안 함 | 앱 기능 |
| 광고 ID | 수집 | Google (AdMob) | 광고 |

---

## 4. 프리미엄 구독 상품 생성

### 4-1. Play Console에서 구독 만들기

1. Play Console → 해당 앱 → **수익 창출** → **상품** → **구독**
2. **구독 만들기** 클릭
3. 설정:

| 항목 | 값 |
|------|-----|
| 상품 ID | `linkvault_premium_monthly` |
| 이름 | LinkVault 프리미엄 |
| 설명 | 무제한 링크 저장, 광고 제거, 4단계 폴더 |

4. **기본 요금제 추가**:
   - 요금제 ID: `monthly`
   - 결제 주기: 1개월
   - 가격: $1.99 (또는 ₩2,500)
   - 무료 체험: 선택사항 (7일 권장)

5. **활성화** 클릭

> 구독 상품이 활성화되려면 AAB를 내부 테스트 트랙에 최소 1회 업로드해야 함

### 4-2. Google Play 서비스 계정 (구독 검증용)

서버에서 구독 영수증을 검증하려면 서비스 계정이 필요:

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 선택 (Firebase 프로젝트와 동일)
2. **IAM 및 관리자** → **서비스 계정** → **서비스 계정 만들기**
   - 이름: `play-billing-verifier`
   - 역할: 불필요 (Play Console에서 별도 권한 부여)
3. 생성된 서비스 계정 → **키** 탭 → **키 추가** → **JSON** → 다운로드
4. **Google Play Console** → **설정** → **API 액세스** → 서비스 계정 연결
   - 위에서 만든 서비스 계정에 **재무 데이터 보기** 권한 부여
5. **Android Publisher API** 활성화:
   - Cloud Console → **API 및 서비스** → **라이브러리** → `Google Play Android Developer API` → **사용**

### 4-3. Firebase Secret 등록

```bash
# 다운로드한 서비스 계정 JSON의 내용을 Firebase Secret으로 저장
firebase functions:secrets:set GOOGLE_PLAY_SERVICE_ACCOUNT

# 프롬프트가 나오면 JSON 내용 전체를 붙여넣기
```

---

## 5. Firebase Cloud Functions 배포

```bash
cd functions
npm install
npm run build

# 배포
firebase deploy --only functions
```

배포되는 함수 목록:
- `analyzeLink` - 링크 메타데이터 분석
- `categorizeLink` - AI 자동 분류 (OpenAI)
- `saveLink` - 링크 저장 + 월간 한도 체크
- `verifyPurchase` - Google Play 구독 검증
- `cleanupCategories` - 카테고리 데이터 정리
- `healthCheck` - 헬스체크

---

## 6. Firestore 보안 규칙 배포

```bash
firebase deploy --only firestore:rules
```

> `plan`, `subscription`, `monthlyUsage` 필드는 클라이언트에서 직접 변경 불가 (Cloud Functions만 가능)

---

## 7. 릴리스 빌드

### 7-1. 네이티브 빌드 준비

```bash
# prebuild (필요 시)
npx expo prebuild --clean

# 프로젝트 전용 debug keystore 복사 (prebuild 후 필수)
cp debug.keystore android/app/debug.keystore
```

### 7-2. AAB 빌드

```bash
cd android && ./gradlew bundleRelease
```

빌드 결과물: `android/app/build/outputs/bundle/release/app-release.aab`

### 7-3. 릴리스 빌드 테스트

릴리스 APK로 직접 테스트:
```bash
cd android && ./gradlew assembleRelease
# 결과물: android/app/build/outputs/apk/release/app-release.apk
adb install app/build/outputs/apk/release/app-release.apk
```

확인 사항:
- [ ] 앱 정상 실행
- [ ] 로그인 (Google/Apple/Email) 동작
- [ ] 링크 저장 + AI 분류 동작
- [ ] 배너 광고 노출 (운영 광고 단위 ID 적용 후)
- [ ] 전면 광고 3건 저장마다 노출
- [ ] 설정 → 구독 섹션 표시 (무료 플랜, 사용량)

---

## 8. Play Store 출시

### 8-1. 내부 테스트 (권장)

1. Play Console → **테스트** → **내부 테스트** → **새 버전 만들기**
2. AAB 업로드
3. 테스터 이메일 추가
4. **검토 시작**
5. 테스터가 Play Store에서 앱 설치 후 테스트
6. **구독 결제 테스트**: 테스터 계정으로 `linkvault_premium_monthly` 구매 확인

> 내부 테스트에서는 실제 결제 없이 테스트 가능 (라이선스 테스터 설정 필요)

#### 라이선스 테스터 설정
Play Console → **설정** → **라이선스 테스트** → 테스터 Gmail 추가

### 8-2. 프로덕션 출시

1. 내부 테스트 확인 완료 후
2. Play Console → **프로덕션** → **새 버전 만들기**
3. AAB 업로드 (내부 테스트와 동일한 AAB 사용 가능)
4. 출시 노트 작성
5. **검토 제출**
6. 심사 대기 (보통 1~7일, 첫 앱은 더 오래 걸릴 수 있음)

---

## 9. 출시 후 작업

- [ ] AdMob 콘솔 → 앱 설정 → Play Store 연결
- [ ] Firebase Analytics 대시보드 확인
- [ ] Crashlytics 모니터링 설정
- [ ] 구독 결제 정상 동작 확인 (Play Console → 주문 관리)
- [ ] AdMob 수익 확인 (24~48시간 후부터)

---

## 10. 다른 스토어 출시 (선택)

| 스토어 | 등록비 | 비고 |
|--------|--------|------|
| Samsung Galaxy Store | 무료 | AAB 그대로 업로드 가능 |
| ONE Store | 무료 | 한국 특화, 별도 SDK 불필요 |
| Amazon Appstore | 무료 | APK 업로드 |

---

## 빠른 참조

```bash
# Cloud Functions 배포
cd functions && npm run build && firebase deploy --only functions

# Firestore 규칙 배포
firebase deploy --only firestore:rules

# 릴리스 AAB 빌드
cd android && ./gradlew bundleRelease

# 릴리스 APK 빌드 (테스트용)
cd android && ./gradlew assembleRelease

# 빌드 결과물 경로
# AAB: android/app/build/outputs/bundle/release/app-release.aab
# APK: android/app/build/outputs/apk/release/app-release.apk
```

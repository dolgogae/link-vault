# LinkVault

AI가 자동으로 분류해주는 링크 관리 앱.

URL을 저장하면 OpenAI가 콘텐츠를 분석하여 적절한 폴더에 자동 분류합니다.

## 주요 기능

- **AI 자동 분류** - 링크 저장 시 GPT가 콘텐츠를 분석하여 카테고리 자동 배치
- **계층형 폴더** - 최대 4단계 깊이의 폴더 구조
- **검색** - 제목, URL, 태그, 설명으로 검색
- **즐겨찾기** - 자주 쓰는 링크 빠른 접근
- **공유 인텐트** - 다른 앱에서 공유하기로 바로 저장
- **프리미엄 구독** - 무제한 저장, 광고 제거

## 기술 스택

| 영역 | 기술 |
|------|------|
| 앱 | React Native (Expo bare workflow) |
| 스타일 | NativeWind (TailwindCSS) |
| 상태관리 | Zustand |
| 인증 | Firebase Auth (Google, Apple, Email) |
| DB | Cloud Firestore |
| AI | OpenAI API (gpt-5-nano) |
| 서버 | Firebase Cloud Functions v2 |
| 광고 | Google AdMob |
| 결제 | Google Play Billing (react-native-iap) |

## 프로젝트 구조

```
link-vault/
├── app/                    # Expo Router 화면
│   ├── (tabs)/             # 메인 탭 (홈, 검색, 즐겨찾기, 설정)
│   └── (auth)/             # 인증 화면
├── components/             # 재사용 컴포넌트
├── services/               # Firebase 서비스 (links, categories, auth, subscription)
├── stores/                 # Zustand 스토어 (auth, link, subscription)
├── hooks/                  # 커스텀 훅
├── constants/              # 상수 (테마, 구독 플랜)
├── types/                  # TypeScript 타입 정의
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── analyzeLink.ts      # 링크 메타데이터 분석
│       ├── categorize.ts       # AI 자동 분류
│       ├── saveLink.ts         # 링크 저장 + 월간 한도
│       ├── verifyPurchase.ts   # 구독 결제 검증
│       └── cleanupCategories.ts
└── android/                # Android 네이티브
```

## 시작하기

### 사전 요구사항

- Node.js 20+
- npm
- Android Studio (Android SDK)
- Firebase 프로젝트

### 설치

```bash
git clone <repo-url>
cd link-vault
npm install
cd functions && npm install && cd ..
```

### 환경 변수

`.env.example`을 `.env`로 복사 후 값 입력:

```bash
cp .env.example .env
```

### 실행

```bash
# 개발 서버
npx expo start

# Android 직접 실행
npx expo run:android
```

### Cloud Functions 배포

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 플랜

| | Free | Premium ($1.99/월) |
|---|---|---|
| 월 저장 | 30건 | 무제한 |
| AI 자동분류 | O | O |
| 카테고리 깊이 | 2단계 | 4단계 |
| 광고 | 배너 + 전면 (3건마다) | 없음 |

## 배포

[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) 참고.

## Debug Keystore

`npx expo prebuild --clean` 후 반드시 프로젝트 전용 keystore 복사:

```bash
cp debug.keystore android/app/debug.keystore
```

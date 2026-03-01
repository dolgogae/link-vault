# Google Play Store 출시 체크리스트

> 이 문서는 [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)로 통합되었습니다.
> 전체 배포 과정은 DEPLOYMENT-GUIDE.md를 참고하세요.

## 완료된 항목

- [x] 릴리스 키스토어 생성 (`android/app/linkvault-release.keystore`)
- [x] keystore.properties 설정 (`android/keystore.properties`)
- [x] build.gradle 릴리스 서명 설정
- [x] .gitignore에 키스토어 관련 파일 추가
- [x] 릴리스 AAB 빌드 성공
- [x] 프리미엄 구독 시스템 구현 (react-native-iap + verifyPurchase Cloud Function)
- [x] 월간 사용량 제한 구현 (무료 30건/월)
- [x] 광고 게이팅 구현 (프리미엄은 광고 없음)

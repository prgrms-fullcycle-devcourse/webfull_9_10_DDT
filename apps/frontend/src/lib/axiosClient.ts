// 전역 axios 설정 모듈. import만 해도 baseURL·인터셉터가 등록된다.
// 1) baseURL을 env로 지정, 2) 요청마다 access_token을 Authorization 헤더에 자동 첨부,
// 3) 응답 본문이 { data: ... } 래퍼면 한 겹 벗겨 response.data로 평탄화한다.
import axios from 'axios';
import { getToken } from './getToken';

axios.defaults.baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// 요청 인터셉터: 토큰이 있으면 Bearer 인증 헤더를 붙인다.
axios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 공통 { data } 래퍼를 벗겨 호출부가 res.data로 바로 실데이터를 받게 한다.
axios.interceptors.response.use((response) => {
  if (
    response.data &&
    typeof response.data === 'object' &&
    'data' in response.data
  ) {
    response.data = response.data.data;
  }
  return response;
});

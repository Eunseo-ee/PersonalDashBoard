import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' : 저장소 이름 대소문자나 하위 경로(/app/)가 달라도 깨지지 않도록 상대 경로로 빌드한다.
// (라우터를 쓰게 되면 BrowserRouter 대신 HashRouter를 쓰는 걸 권장)
export default defineConfig({
  base: './',
  plugins: [react()],
})

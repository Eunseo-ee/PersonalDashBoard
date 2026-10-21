import { createClient } from '@supabase/supabase-js'

// publishable 키는 브라우저에 공개되는 값이다. 실제 보안은 DB의 RLS 정책이 담당한다.
// 서비스 공개 시점에 새 Supabase 프로젝트로 옮기면 이 두 줄만 바꾸면 된다.
const SUPABASE_URL = 'https://bkaytrqxcaialedltfox.supabase.co'
const SUPABASE_KEY = 'sb_publishable_KaZUGivoh_nLVG17TfUgaQ_Se6SfQLY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

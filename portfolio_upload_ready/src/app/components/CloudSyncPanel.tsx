import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { useSupabaseSession } from '../hooks/useSupabaseSession';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { pullFromCloud, pushToCloud, readLocalStoragePayload, writeLocalStoragePayload } from '../lib/cloudSync';

// 일반인용: "동기화"는 회사/집/폰에서 같은 값을 보이게 해주는 기능

export function CloudSyncPanel() {
  const { user, loading } = useSupabaseSession();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'waiting' | 'syncing' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [lastSyncText, setLastSyncText] = useState<string>('');
  const [loginCooldown, setLoginCooldown] = useState(false);

  const lastPushedRef = useRef<string>('');
const pushingRef = useRef(false);

// ✅ 자동 새로고침은 너무 자주 하면 화면이 튕겨서 불편함
// - 다른 기기(회사/집/폰)에서 값이 바뀌었을 때만 새로고침을 걸어주는데,
// - 빈도는 "1시간에 1번"으로 제한한다.
const AUTO_RELOAD_INTERVAL_MS = 60 * 60 * 1000; // 1시간
const AUTO_RELOAD_TS_KEY = 'cloudSyncLastAutoReloadAt';

const getLastAutoReloadAt = () => {
  try {
    return Number(sessionStorage.getItem(AUTO_RELOAD_TS_KEY) || '0');
  } catch {
    return 0;
  }
};

const canAutoReloadNow = () => {
  const last = getLastAutoReloadAt();
  return Date.now() - last >= AUTO_RELOAD_INTERVAL_MS;
};

const markAutoReloadNow = () => {
  try {
    sessionStorage.setItem(AUTO_RELOAD_TS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
};

const clearAutoReloadMark = () => {
  try {
    sessionStorage.removeItem(AUTO_RELOAD_TS_KEY);
  } catch {
    // ignore
  }
};

  const origin = useMemo(() => {
    try {
      return window.location.origin;
    } catch {
      return '';
    }
  }, []);

  const signIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage('동기화 설정이 아직 안 됐어. (Vercel에 Supabase 환경변수부터 넣어야 해)');
      return;
    }
    if (!email.trim()) {
      setMessage('이메일을 입력해줘.');
      return;
    }
    if (loginCooldown) {
      setMessage('로그인 메일을 너무 자주 보낼 수 없어. 1분 정도 뒤에 다시 눌러줘.');
      return;
    }
    try {
      setStatus('sending');
      setMessage('');
      // Supabase 메일 전송은 rate limit이 있어서, 실수로 연타해도 1분간은 막아둔다
      setLoginCooldown(true);
      setTimeout(() => setLoginCooldown(false), 60_000);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: origin,
        },
      });
      if (error) throw error;
      setStatus('waiting');
      setMessage('이메일로 온 로그인 링크를 눌러줘. (같은 기기에서 메일을 열면 더 쉬움)');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e?.message || '로그인 메일 전송에 실패했어.');
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAutoReloadMark();
    setStatus('idle');
    setMessage('로그아웃 됐어.');
  };

  // 1) 로그인 되면: 클라우드에서 한번 내려받기(회사에서 입력한 값 -> 이 기기로)
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      try {
        setStatus('syncing');
        setMessage('동기화 불러오는 중...');

        const cloudPayload = await pullFromCloud(user.id);
        if (cancelled) return;

        if (cloudPayload && Object.keys(cloudPayload).length > 0) {
          // 클라우드 값으로 로컬 저장을 덮어쓰기 (바뀐 게 있을 때만)
          const localBefore = readLocalStoragePayload();
          const isSame = Object.keys(cloudPayload).every((k) => localBefore[k] === cloudPayload[k]);
          if (!isSame) {
            writeLocalStoragePayload(cloudPayload);
          }
          // 컴포넌트들이 localStorage에서 초기값을 읽는 구조라, 새로고침이 필요할 수 있음
// 하지만 계속 새로고침되면 사용이 불가하니 "1시간에 1번"으로 제한한다.
if (!isSame && canAutoReloadNow()) {
  markAutoReloadNow();
  setMessage('회사/다른 기기 값으로 맞췄어. 새로고침 한 번 할게!');
  setTimeout(() => window.location.reload(), 600);
  return;
} else {
  setMessage(isSame ? '동기화 확인 완료.' : '회사/다른 기기 값으로 맞췄어. (자동 새로고침은 1시간에 1번만 할게)');
}
}

        // 처음 로그인인데 클라우드에 데이터가 없으면: 현재 로컬 값을 올려서 "기준"을 만든다
        const localPayload = readLocalStoragePayload();
        await pushToCloud(user.id, localPayload);
        lastPushedRef.current = JSON.stringify(localPayload);
        setLastSyncText(new Date().toLocaleString());
        setStatus('ready');
        setMessage('동기화 ON (회사/집/폰에서 같은 값이 보여)');
      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMessage(e?.message || '동기화 초기화에 실패했어.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);
// 1-b) 로그인 상태에서: 1시간마다 "다른 기기에서 바뀐 값"이 있는지 확인하기
useEffect(() => {
  if (!user) return;
  if (status === 'error') return;
  if (!supabase) return;

  const timer = setInterval(async () => {
    try {
      const cloudPayload = await pullFromCloud(user.id);
      if (!cloudPayload || Object.keys(cloudPayload).length === 0) return;

      // cloudPayload에 있는 키들만 비교 (로컬에 다른 키가 더 있어도 OK)
      const localPayload = readLocalStoragePayload();
      const isSame = Object.keys(cloudPayload).every((k) => localPayload[k] === cloudPayload[k]);
      if (isSame) return;

      // 다른 기기에서 변경된 값 발견 → 로컬 덮어쓰기
      writeLocalStoragePayload(cloudPayload);

      // 화면 반영을 위해 새로고침이 필요할 수 있음(하지만 1시간에 1번으로 제한)
      if (canAutoReloadNow()) {
        markAutoReloadNow();
        setMessage('다른 기기에서 값이 바뀌었어. 새로고침 한 번 할게!');
        setTimeout(() => window.location.reload(), 600);
      } else {
        setMessage('다른 기기에서 값이 바뀌었어. (자동 새로고침은 1시간에 1번만 해)');
      }
    } catch (e) {
      console.error(e);
    }
  }, AUTO_RELOAD_INTERVAL_MS);

  return () => clearInterval(timer);
}, [user, status]);


  // 2) 로그인 상태에서: 주기적으로 "변경된 값"을 클라우드로 올리기
  useEffect(() => {
    if (!user) return;
    if (status === 'error') return;
    if (!supabase) return;

    const timer = setInterval(async () => {
      try {
        // 이미 업로드 중이면 중복 호출 방지
        if (pushingRef.current) return;

        const payload = readLocalStoragePayload();
        const json = JSON.stringify(payload);
        if (json === lastPushedRef.current) return;

        // 입력 중(커서가 인풋에 있을 때)에는 너무 자주 업로드하지 않도록 한 템포 늦춘다
        const active = document.activeElement as HTMLElement | null;
        const isTyping = !!active && ['INPUT', 'TEXTAREA'].includes(active.tagName);
        if (isTyping) return;

        pushingRef.current = true;
        await pushToCloud(user.id, payload);
        lastPushedRef.current = json;
        setLastSyncText(new Date().toLocaleString());
        if (status !== 'ready') setStatus('ready');
      } catch (e) {
        // 일시적인 네트워크 오류는 그냥 무시(다음 주기에 재시도)
        console.error(e);
      } finally {
        pushingRef.current = false;
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [user, status]);

  return (
    <Card className="mb-4 p-4 bg-white/80 backdrop-blur shadow-md rounded-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="font-semibold">동기화</div>
          <div className="text-sm text-gray-600 break-words">
            {!isSupabaseConfigured
              ? '동기화: 설정 필요 (Supabase URL/KEY를 Vercel에 등록해야 함)'
              : loading
              ? '확인 중...'
              : user
                ? `로그인됨: ${user.email ?? ''}`
                : '로그인하면 회사/집/폰에서 값이 같아져.'}
          </div>
          {message && <div className="text-sm mt-1 text-gray-700">{message}</div>}
          {lastSyncText && <div className="text-xs mt-1 text-gray-500">마지막 동기화: {lastSyncText}</div>}
        </div>

        {!user ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 입력 (예: abc@gmail.com)"
              className="w-full md:w-[260px]"
              type="email"
            />
            <Button onClick={signIn} disabled={status === 'sending' || loginCooldown}>
              {status === 'sending' ? '보내는 중...' : loginCooldown ? '잠시 후 다시' : '로그인 링크 받기'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

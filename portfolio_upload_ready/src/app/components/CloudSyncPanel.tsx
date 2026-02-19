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

  const lastPushedRef = useRef<string>('');
  const reloadedAfterPullRef = useRef(false);

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
    try {
      setStatus('sending');
      setMessage('');
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin

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
          // 클라우드 값으로 로컬 저장을 덮어쓰기
          writeLocalStoragePayload(cloudPayload);
          // 컴포넌트들이 localStorage에서 초기값을 읽는 구조라, 한번 새로고침하면 깔끔하게 반영됨
          if (!reloadedAfterPullRef.current) {
            reloadedAfterPullRef.current = true;
            setMessage('회사/다른 기기 값으로 맞췄어. 새로고침 한 번 할게!');
            setTimeout(() => window.location.reload(), 600);
            return;
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

  // 2) 로그인 상태에서: 5초마다 "변경된 값"을 클라우드로 올리기
  useEffect(() => {
    if (!user) return;
    if (status === 'error') return;
    if (!supabase) return;

    const timer = setInterval(async () => {
      try {
        const payload = readLocalStoragePayload();
        const json = JSON.stringify(payload);
        if (json === lastPushedRef.current) return;

        await pushToCloud(user.id, payload);
        lastPushedRef.current = json;
        setLastSyncText(new Date().toLocaleString());
        if (status !== 'ready') {
          setStatus('ready');
          setMessage('동기화 ON');
        }
      } catch (e) {
        // 일시적인 네트워크 오류는 그냥 무시(다음 주기에 재시도)
        console.error(e);
      }
    }, 5000);

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
            <Button onClick={signIn} disabled={status === 'sending'}>
              {status === 'sending' ? '보내는 중...' : '로그인 링크 받기'}
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

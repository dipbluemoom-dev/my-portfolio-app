import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  pullFromCloud,
  pushToCloud,
  readLocalStoragePayload,
  writeLocalStoragePayload,
} from '../lib/cloudSync';
import { Button } from './ui/button';
import { Input } from './ui/input';

function shallowEqualPayload(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

const AUTO_PULL_INTERVAL_MS = 30_000; // 30초마다 서버 확인
const AUTO_PUSH_INTERVAL_MS = 120_000; // 2분마다 자동 업로드(너무 잦으면 사용감 저하)
const AUTO_RELOAD_MIN_INTERVAL_MS = 60 * 60 * 1000; // 1시간
const AUTO_RELOAD_KEY = 'cloudSyncLastAutoReloadAt';

export function CloudSyncPanel({ onToast }: { onToast?: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'loggedIn' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [autoReloadDisabled, setAutoReloadDisabled] = useState(false);

  // 로그인 링크(메일) 너무 자주 누르지 않도록
  const lastEmailSentAtRef = useRef<number>(0);

  // 자동 새로고침 루프 방지(스토리지 막힌 환경 대비)
  const lastAutoReloadAtRef = useRef<number>(0);

  const getLastAutoReloadAt = () => {
    if (autoReloadDisabled) return Date.now();
    try {
      const v = localStorage.getItem(AUTO_RELOAD_KEY);
      return v ? Number(v) || 0 : 0;
    } catch {
      return lastAutoReloadAtRef.current || 0;
    }
  };

  const markAutoReloadNow = () => {
    const now = Date.now();
    lastAutoReloadAtRef.current = now;
    try {
      localStorage.setItem(AUTO_RELOAD_KEY, String(now));
    } catch {
      // iOS 일부 환경/인앱브라우저에서 스토리지가 막히면 무한 새로고침이 될 수 있어서
      // 그 경우 자동 새로고침 기능 자체를 꺼버림
      setAutoReloadDisabled(true);
    }
  };

  const canAutoReloadNow = () => {
    if (autoReloadDisabled) return false;
    const last = getLastAutoReloadAt();
    return Date.now() - last >= AUTO_RELOAD_MIN_INTERVAL_MS;
  };

  useEffect(() => {
    // 세션 복구
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.id) {
          setUserId(data.session.user.id);
          setStatus('loggedIn');
          setMessage('로그인 됨');
        }
      } catch {
        // ignore
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) {
        setStatus('loggedIn');
        setMessage('로그인 됨');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage('이메일을 입력해줘');
      return;
    }

    // 5분 쿨다운
    const now = Date.now();
    if (now - lastEmailSentAtRef.current < 5 * 60 * 1000) {
      setStatus('error');
      setMessage('방금 보냈어. 5분 정도 기다렸다가 다시 시도해줘');
      return;
    }

    setStatus('sending');
    setMessage('메일 보내는 중…');

    try {
      const origin = window.location.origin;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: origin,
        },
      });

      if (error) throw error;

      lastEmailSentAtRef.current = now;
      setStatus('sent');
      setMessage('메일 보냈어! 메일함에서 로그인 링크를 눌러줘');

      onToast?.('메일 보냈어. 메일함에서 로그인 링크를 눌러줘.');
    } catch (e: any) {
      const msg = String(e?.message || e);
      setStatus('error');

      if (msg.toLowerCase().includes('rate limit')) {
        setMessage('너무 많이 눌렀어(전송 제한). 10분 정도 기다렸다가 다시 해줘');
      } else {
        setMessage(msg);
      }
    }
  };

  const pullOnce = async () => {
    if (!userId) return;

    try {
      const cloudPayload = await pullFromCloud(userId);
      if (!cloudPayload) return;

      const localPayload = readLocalStoragePayload();

      if (!shallowEqualPayload(localPayload, cloudPayload)) {
        // 서버값으로 맞추고 새로고침(단, 무한루프 방지)
        writeLocalStoragePayload(cloudPayload);

        if (canAutoReloadNow()) {
          markAutoReloadNow();
          setMessage('다른 기기 값으로 동기화했어. 새로고침 할게!');
          onToast?.('다른 기기 값으로 맞췄어. 새로고침 할게!');
          setTimeout(() => window.location.reload(), 600);
        } else {
          // 자동 새로고침이 막혀있거나(모바일/인앱브라우저) / 1시간 내 재실행이면
          setMessage('다른 기기 값으로 맞췄어. 화면만 한번 새로고침하면 완벽해!');
          onToast?.('다른 기기 값으로 맞췄어. 새로고침 한번 해줘!');
        }
      }
    } catch (e: any) {
      // ignore
      console.error(e);
    }
  };

  const pushOnce = async () => {
    if (!userId) return;
    try {
      const payload = readLocalStoragePayload();
      await pushToCloud(userId, payload);
      // 너무 자주 토스트하면 방해라서 조용히
    } catch (e: any) {
      console.error(e);
    }
  };

  // 자동 Pull
  useEffect(() => {
    if (!userId) return;
    pullOnce();

    const t = setInterval(() => {
      pullOnce();
    }, AUTO_PULL_INTERVAL_MS);

    return () => clearInterval(t);
  }, [userId]);

  // 자동 Push
  useEffect(() => {
    if (!userId) return;

    const t = setInterval(() => {
      pushOnce();
    }, AUTO_PUSH_INTERVAL_MS);

    return () => clearInterval(t);
  }, [userId]);

  // 수동 저장
  const manualSave = async () => {
    if (!userId) {
      onToast?.('먼저 로그인부터 해줘');
      return;
    }
    try {
      await pushOnce();
      onToast?.('저장 완료! (클라우드에 업로드 됨)');
    } catch {
      onToast?.('저장 실패… 잠깐 뒤에 다시 해줘');
    }
  };

  const currentDomain = useMemo(() => {
    try {
      return window.location.host;
    } catch {
      return '';
    }
  }, []);

  return (
    <div className="p-4 rounded-2xl border bg-white shadow-sm">
      <div className="font-semibold mb-1">동기화</div>
      <div className="text-sm text-gray-600 mb-3">
        로그인하면 저장/불러오기가 가능해.
        <span className="block text-xs text-gray-400 mt-1">현재 접속 도메인: {currentDomain}</span>
        <span className="block text-xs text-gray-400">메일 링크가 안 열리면: 메일앱/카톡 내장 브라우저 말고 Safari(또는 크롬)로 열어줘</span>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full sm:w-64"
        />
        <Button onClick={sendMagicLink} disabled={status === 'sending'}>
          로그인 링크 받기
        </Button>

        <Button variant="outline" onClick={manualSave} disabled={!userId}>
          저장
        </Button>
      </div>

      <div className="mt-2 text-sm">
        {status === 'error' ? (
          <span className="text-red-600">{message}</span>
        ) : (
          <span className="text-gray-700">{message}</span>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        자동 동기화: 서버 확인 30초 / 자동 업로드 2분
        {autoReloadDisabled && (
          <span className="block text-amber-700 mt-1">* 이 기기(브라우저)는 저장소가 제한돼서 자동 새로고침을 껐어. 필요한 경우 직접 새로고침만 해줘.</span>
        )}
      </div>
    </div>
  );
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MIN_PASSWORD, USERNAME_RULES, formatPhone, normalizeUsername } from "@/lib/account";
import { ZALO_URL } from "@/lib/site";
import { checkPhone, createAccount, loginEmail } from "./actions";

type Mode = "login" | "signup";

const inputClass =
  "mt-1 h-12 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function LoginForm({ next, initialMode }: { next: string; initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  /** Sign-up: the checked phone number once step 1 is done. */
  const [phone, setPhone] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setPassword("");
    setConfirm("");
  }

  async function run(task: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch (err) {
      console.error(err);
      setError("Có lỗi kết nối, bạn thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  /** Signs in from the browser, so Supabase's rate limits apply per visitor rather than to our server. */
  async function signIn(email: string) {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(
        signInError.status === 429
          ? "Bạn thử quá nhiều lần, đợi vài phút rồi thử lại nhé."
          : "Sai tên đăng nhập / số điện thoại hoặc mật khẩu.",
      );
      return;
    }
    const device = await fetch("/auth/thiet-bi", { method: "POST" });
    if (!device.ok) return setError("Đăng nhập chưa xong, bạn thử lại nhé.");
    router.replace(next);
    router.refresh();
  }

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!identifier.trim() || !password) return setError("Nhập tên đăng nhập (hoặc số điện thoại) và mật khẩu.");
      await signIn(await loginEmail(identifier));
    });
  };

  const onPhoneStep = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await checkPhone(phoneInput);
      if (res.error || !res.phone) return setError(res.error ?? "Số điện thoại không hợp lệ.");
      setPhone(res.phone);
    });
  };

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!phone) return;
      if (!normalizeUsername(username)) return setError(`Tên đăng nhập chưa hợp lệ: ${USERNAME_RULES}`);
      if (password.length < MIN_PASSWORD) return setError(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`);
      if (password !== confirm) return setError("Hai mật khẩu không khớp.");
      const res = await createAccount(phone, username, password);
      if (res.error || !res.email) return setError(res.error ?? "Chưa tạo được tài khoản.");
      await signIn(res.email);
    });
  };

  const submitButton = (label: string) => (
    <button
      type="submit"
      disabled={busy}
      className="h-12 w-full rounded-xl bg-accent font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
    >
      {busy ? "Đang xử lý…" : label}
    </button>
  );
  const errorLine = error && <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <div className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-medium">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`h-10 rounded-lg ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {m === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        ))}
      </div>

      {mode === "login" && (
        <form onSubmit={onLogin} className="mt-5 space-y-3 text-left">
          <label className="block">
            <span className="text-sm text-muted">Tên đăng nhập hoặc số điện thoại</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
              required
            />
          </label>
          {errorLine}
          {submitButton("Đăng nhập")}
          <p className="text-center text-sm text-muted">
            Quên mật khẩu?{" "}
            <a href={ZALO_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
              Nhắn Zalo để được đặt lại
            </a>
          </p>
        </form>
      )}

      {mode === "signup" && !phone && (
        <form onSubmit={onPhoneStep} className="mt-5 space-y-3 text-left">
          <p className="text-sm font-medium">Bước 1/2 · Số điện thoại</p>
          <label className="block">
            <span className="text-sm text-muted">Số điện thoại</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0901 234 567"
              className={inputClass}
              required
            />
          </label>
          {errorLine}
          {submitButton("Tiếp tục")}
        </form>
      )}

      {mode === "signup" && phone && (
        <form onSubmit={onCreate} className="mt-5 space-y-3 text-left">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Bước 2/2 · Tên đăng nhập & mật khẩu</span>
            <button
              type="button"
              onClick={() => {
                setPhone(null);
                setError(null);
              }}
              className="text-accent underline underline-offset-4"
            >
              Đổi số
            </button>
          </div>
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Số điện thoại: <b>{formatPhone(phone)}</b>
          </p>
          <label className="block">
            <span className="text-sm text-muted">Tên đăng nhập</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="vd: nam.guitar"
              className={inputClass}
              required
            />
            <span className="mt-1 block text-xs text-muted">{USERNAME_RULES}</span>
          </label>
          <label className="block">
            <span className="text-sm text-muted">Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Nhập lại mật khẩu</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
              required
            />
          </label>
          {errorLine}
          {submitButton("Tạo tài khoản")}
        </form>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { changePassword, checkCurrentPassword } from "./actions";

const input = "h-11 w-full rounded-md border border-border bg-bg px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const button = "h-11 shrink-0 whitespace-nowrap rounded-md bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-deep disabled:opacity-60";

/** Two steps: confirm the current password, then choose a new one (any characters). */
export function PasswordForm() {
  const [step, setStep] = useState<"current" | "new" | "done">("current");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch {
      setError("Có lỗi kết nối, bạn thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="mt-3 text-sm">
        <p className="text-[#2f7a50]">Đã đổi mật khẩu.</p>
        <button
          type="button"
          onClick={() => {
            setStep("current");
            setCurrent("");
            setPassword("");
            setConfirm("");
          }}
          className="mt-2 text-accent underline underline-offset-4"
        >
          Đổi lại lần nữa
        </button>
      </div>
    );
  }

  if (step === "current") {
    return (
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            if (await checkCurrentPassword(current)) setStep("new");
            else setError("Mật khẩu hiện tại không đúng.");
          });
        }}
      >
        <label className="block text-sm text-muted" htmlFor="pw-current">
          Bước 1/2 · Nhập mật khẩu hiện tại
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={input}
            required
          />
          <button type="submit" disabled={busy} className={button}>
            {busy ? "Đang kiểm tra…" : "Tiếp tục"}
          </button>
        </div>
        {error && <p className="text-sm text-[#b33a28]">{error}</p>}
      </form>
    );
  }

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (password !== confirm) return setError("Hai mật khẩu mới không khớp.");
          const res = await changePassword(current, password);
          if (res.error) return setError(res.error);
          setStep("done");
        });
      }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Bước 2/2 · Nhập mật khẩu mới</span>
        <button type="button" onClick={() => setStep("current")} className="text-accent underline underline-offset-4">
          Quay lại
        </button>
      </div>
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Mật khẩu mới"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={input}
        autoFocus
        required
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu mới"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={input}
        required
      />
      {error && <p className="text-sm text-[#b33a28]">{error}</p>}
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}

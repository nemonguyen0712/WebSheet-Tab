"use client";

import { ToolButton, ToolGroup, Toolbar } from "./Toolbar";
import { usePersistentState } from "./usePersistentState";
import { Watermark } from "./Watermark";

export function TextViewer({ text, watermark }: { text: string; watermark: string }) {
  const [fontSize, setFontSize] = usePersistentState("text-font-size", 15);

  return (
    <div>
      <Toolbar>
        <ToolGroup label="Cỡ chữ">
          <ToolButton label="Chữ nhỏ hơn" onClick={() => setFontSize(Math.max(11, fontSize - 1))}>
            A−
          </ToolButton>
          <ToolButton label="Chữ to hơn" onClick={() => setFontSize(Math.min(28, fontSize + 1))}>
            A+
          </ToolButton>
        </ToolGroup>
      </Toolbar>
      <div className="relative overflow-x-auto rounded-xl border border-border bg-surface p-4 sm:p-6">
        <Watermark text={watermark} />
        <div className="font-mono leading-relaxed whitespace-pre" style={{ fontSize }}>
          {text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ")}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type LanguageView = "both" | "en" | "zh";

const options: { value: LanguageView; label: string }[] = [
  { value: "both", label: "EN/中" },
  { value: "en", label: "EN" },
  { value: "zh", label: "中" }
];

export function LanguageSwitcher() {
  const [languageView, setLanguageView] = useState<LanguageView>("both");

  useEffect(() => {
    document.documentElement.dataset.language = languageView;
  }, [languageView]);

  return (
    <div className="languageSwitch" aria-label="Language">
      {options.map((option) => (
        <button
          aria-pressed={languageView === option.value}
          key={option.value}
          onClick={() => {
            setLanguageView(option.value);
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

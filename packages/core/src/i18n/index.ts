import { enMessages } from "./en";
import { zhMessages } from "./zh";

const messages = {
  en: enMessages,
  zh: zhMessages
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof enMessages;

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}

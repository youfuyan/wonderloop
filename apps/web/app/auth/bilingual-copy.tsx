import { t } from "@wonderloop/core";
import type { MessageKey } from "@wonderloop/core";

type BilingualCopyProps = {
  messageKey: MessageKey;
};

export function BilingualCopy({ messageKey }: BilingualCopyProps) {
  return (
    <>
      <span lang="zh">{t("zh", messageKey)}</span>
      <span lang="en">{t("en", messageKey)}</span>
    </>
  );
}

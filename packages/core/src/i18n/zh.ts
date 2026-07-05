import type { enMessages } from "./en";

export const zhMessages: Record<keyof typeof enMessages, string> = {
  notAuthenticated: "请先登录后继续。",
  episodeNotFound: "这一集暂时还不能收听。",
  paywallRequired: "订阅后即可解锁完整好奇循环。"
};

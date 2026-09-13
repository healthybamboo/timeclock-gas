// サーバー側の現在時刻・ユーザー取得

export function timeZone(): string {
  return Session.getScriptTimeZone() || "Asia/Tokyo";
}

/** Date → "YYYY-MM-DDTHH:mm" (スクリプトのタイムゾーン) */
export function formatDateTime(d: Date): string {
  return Utilities.formatDate(d, timeZone(), "yyyy-MM-dd'T'HH:mm");
}

export function now(): string {
  return formatDateTime(new Date());
}

export function today(): string {
  return now().slice(0, 10);
}

/**
 * 操作しているユーザーのメールアドレス。
 * Workspace ドメイン内で公開していれば getActiveUser で取得できる。
 * 取得できない場合 (個人アカウント等) はデプロイ者 = 単一ユーザー運用とみなす。
 */
export function currentUserEmail(): string {
  const active = Session.getActiveUser().getEmail();
  if (active) return active;
  const effective = Session.getEffectiveUser().getEmail();
  return effective || "unknown";
}

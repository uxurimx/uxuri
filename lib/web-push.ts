import webPush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

webPush.setVapidDetails(
  "mailto:admin@uxuri.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        JSON.stringify(payload)
      )
    )
  );

  // Remove expired/invalid subscriptions (410 Gone)
  const expired = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410;
  });
  if (expired.length > 0) {
    await Promise.all(
      expired.map((sub) => db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint)))
    );
  }
}

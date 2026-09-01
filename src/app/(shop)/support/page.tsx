import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/shop/back-button";
import { SupportChat } from "@/components/shop/support-chat";
import { SupportCloseButton } from "@/components/shop/support-close-button";
import { getCurrentUser } from "@/lib/session";
import { getThread, markRead } from "@/lib/support";

export const metadata: Metadata = { title: "المساعدة" };

/**
 * The customer's support conversation.
 *
 * The thread is read for the signed-in user and for nobody else — there is no
 * id in the URL to point at another account.
 */
export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/support");

  const thread = await getThread(user.id);
  // Opening the screen is what "seen" means here, so the shop's replies stop
  // counting as unread the moment they are on screen.
  await markRead(user.id, true);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/account" />
        <h1 className="text-glow flex-1 pb-0.5 text-center text-lg font-bold leading-[1.6] text-fg-strong">
          المساعدة
        </h1>
        {thread.messages.length > 0 ? (
          <SupportCloseButton />
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
      </div>

      <SupportChat thread={thread} />
    </div>
  );
}

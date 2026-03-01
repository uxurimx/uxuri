import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatClient } from "@/components/chat/chat-client";

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    // Fill remaining height without the topbar overflow
    <div className="-m-4 -mt-12 md:-mt-4 md:-m-6 lg:-m-8 h-[calc(100vh-4rem)] flex flex-col">
      <Suspense>
        <ChatClient currentUserId={userId} />
      </Suspense>
    </div>
  );
}

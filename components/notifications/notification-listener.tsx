"use client";

import { useEffect } from "react";
import { getPusherClient } from "@/lib/pusher";
import { useToast } from "@/components/ui/toast";

interface AssignedPayload { taskTitle: string; assignedByName: string }
interface CompletedPayload { taskTitle: string; completedByName: string }

export function NotificationListener({ userId }: { userId: string }) {
  const { addNotification } = useToast();

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-user-${userId}`);

    channel.bind("task:assigned", (data: AssignedPayload) => {
      addNotification(`Te asignaron: "${data.taskTitle}" — por ${data.assignedByName}`, "info");
    });

    channel.bind("task:completed", (data: CompletedPayload) => {
      addNotification(`"${data.taskTitle}" marcada como completada por ${data.completedByName}`, "success");
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-user-${userId}`);
    };
  }, [userId, addNotification]);

  return null;
}

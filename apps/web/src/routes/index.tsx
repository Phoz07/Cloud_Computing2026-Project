import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { eventClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

export const Route = createFileRoute("/")({ component: EventsPage });

function EventsPage() {
  const { data, isLoading, error, refetch , status } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await eventClient.api.events.health.get();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Card className="w-full max-w-sm">
        <CardContent>
          <div className="flex">
            <div className="w-40">
              <h2 className="text-lg font-bold flex items-center gap-2 ">
                <div
                  className={cn("size-2 rounded-full animate-pulse", status === "error" ? "bg-red-500" : status === "pending" ? "bg-amber-300" : "bg-green-500")}
                  />
                Event Service
              </h2>
            </div>
            <div className="flex-1 flex justify-end">
              {isLoading && "Loading"}
              <code className="bg-muted text-muted-foreground p-1 rounded-full px-3">
              {data && data}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

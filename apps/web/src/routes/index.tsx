import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { authClient, eventClient, paymentClient, registrationClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

export const Route = createFileRoute("/")({ component: EventsPage });

type HealthCheck = () => Promise<{ data: string | null; error: unknown }>;

const services: { name: string; check: HealthCheck }[] = [
  { name: "Auth Service", check: () => authClient.api.auth.health.get() },
  { name: "Event Service", check: () => eventClient.api.events.health.get() },
  { name: "Registration Service", check: () => registrationClient.api.regis.health.get() },
  { name: "Payment Service", check: () => paymentClient.api.payment.health.get() },
];

function EventsPage() {
  return (
    <div className="space-y-4">
      {services.map((service) => (
        <ServiceHealthCard key={service.name} {...service} />
      ))}
    </div>
  );
}

function ServiceHealthCard({ name, check }: { name: string; check: HealthCheck }) {
  const { data, isLoading, status } = useQuery({
    queryKey: ["health", name],
    queryFn: async () => {
      const { data, error } = await check();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="w-full max-w-sm">
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2 ">
            <div
              className={cn("size-2 rounded-full animate-pulse", status === "error" ? "bg-red-500" : status === "pending" ? "bg-amber-300" : "bg-green-500")}
              />
            {name}
          </h2>
          <div className="flex justify-end">
            {isLoading && "Loading"}
            {data && (
              <code className="bg-muted text-muted-foreground p-1 rounded-full px-3">
                {data}
              </code>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function NoAccessPage() {
  return (
    <div className="mx-auto max-w-xl pt-10">
      <EmptyState
        icon={Lock}
        title="This part of Waypoint Hub isn't available for your role"
        action={
          <Button asChild>
            <Link href="/today">Back to Today</Link>
          </Button>
        }
      >
        If you think you need it for your work, ask an Admin. They can change your access in Settings.
      </EmptyState>
    </div>
  );
}

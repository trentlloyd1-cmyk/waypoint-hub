import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import contacts" };

export default async function ImportPage() {
  await requireRole("admin", "manager", "bizdev");
  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="link" className="mb-2 px-0">
        <Link href="/contacts">
          <ArrowLeft aria-hidden /> All contacts
        </Link>
      </Button>
      <PageHeader
        title="Import contacts"
        description="Bring people in from a spreadsheet (CSV). We'll match the columns, check for duplicates and show you a preview first."
      />
      <ImportWizard />
    </div>
  );
}

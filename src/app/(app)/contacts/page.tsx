import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Download, FileUp, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NewContactButton, NewOrganisationButton } from "@/components/contacts/new-contact-button";
import { TagList } from "@/components/records/tag-editor";
import { requireRole } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatDate, formatPhone, ORGANISATION_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

const PAGE_SIZE = 50;

type Search = { tab?: string; q?: string; tag?: string; page?: string; bin?: string };

function href(current: Search, changes: Partial<Search>) {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  const s = params.toString();
  return `/contacts${s ? `?${s}` : ""}`;
}

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const { profile } = await requireRole("admin", "manager", "bizdev");
  const raw = await searchParams;
  const sp: Search = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const tab = sp.tab === "organisations" ? "organisations" : "people";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const showBin = sp.bin === "1" && can.deleteContacts(profile.role);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: allTags } = await supabase.from("tags").select("id, name").order("name");

  let rows: React.ReactNode;
  let total = 0;

  if (tab === "people") {
    let query = supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, preferred_name, email, mobile, phone, suburb, do_not_contact, deleted_at, organisations(id, name), contact_tags(tags(id, name))",
        { count: "exact" },
      )
      .order("last_name")
      .order("first_name")
      .range(from, from + PAGE_SIZE - 1);
    query = showBin ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    if (q) query = query.ilike("search_text", `%${q}%`);
    if (sp.tag) {
      const { data: tagged } = await supabase.from("contact_tags").select("contact_id").eq("tag_id", sp.tag);
      query = query.in("id", (tagged ?? []).map((t) => t.contact_id));
    }
    const { data, count } = await query;
    total = count ?? 0;

    rows =
      data && data.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-left">
            <caption className="sr-only">People</caption>
            <thead className="hidden bg-muted/60 text-sm md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Organisation</th>
                <th scope="col" className="px-4 py-3 font-semibold">Mobile / phone</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">Email</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold xl:table-cell">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((c) => (
                <tr key={c.id} className="relative block hover:bg-muted/50 md:table-row">
                  <td className="block px-4 pt-3 md:table-cell md:py-3">
                    <Link href={`/contacts/${c.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                      {displayName(c)}
                    </Link>
                    {c.do_not_contact && (
                      <Badge variant="outline" className="ml-2 border-amber-500 text-amber-800 dark:text-amber-200">
                        Do not contact
                      </Badge>
                    )}
                    {c.deleted_at && <span className="ml-2 text-sm text-muted-foreground">Binned {formatDate(c.deleted_at)}</span>}
                  </td>
                  <td className="block px-4 text-sm text-muted-foreground md:table-cell md:py-3 md:text-base md:text-foreground">
                    {c.organisations?.name}
                  </td>
                  <td className="tabular block px-4 text-sm md:table-cell md:py-3 md:text-base">
                    {formatPhone(c.mobile || c.phone)}
                  </td>
                  <td className="hidden max-w-64 truncate px-4 py-3 lg:table-cell">{c.email}</td>
                  <td className="block px-4 pb-3 md:hidden xl:table-cell xl:py-3">
                    <TagList tags={c.contact_tags.flatMap((ct) => (ct.tags ? [ct.tags] : []))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null;
  } else {
    let query = supabase
      .from("organisations")
      .select("id, name, type, phone, email, suburb, deleted_at, organisation_tags(tags(id, name))", {
        count: "exact",
      })
      .order("name")
      .range(from, from + PAGE_SIZE - 1);
    query = showBin ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    if (q) query = query.ilike("search_text", `%${q}%`);
    if (sp.tag) {
      const { data: tagged } = await supabase.from("organisation_tags").select("organisation_id").eq("tag_id", sp.tag);
      query = query.in("id", (tagged ?? []).map((t) => t.organisation_id));
    }
    const { data, count } = await query;
    total = count ?? 0;

    rows =
      data && data.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-left">
            <caption className="sr-only">Organisations</caption>
            <thead className="hidden bg-muted/60 text-sm md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">Suburb</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold xl:table-cell">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((o) => (
                <tr key={o.id} className="relative block hover:bg-muted/50 md:table-row">
                  <td className="block px-4 pt-3 md:table-cell md:py-3">
                    <Link href={`/organisations/${o.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                      {o.name}
                    </Link>
                    {o.deleted_at && <span className="ml-2 text-sm text-muted-foreground">Binned {formatDate(o.deleted_at)}</span>}
                  </td>
                  <td className="block px-4 text-sm text-muted-foreground md:table-cell md:py-3 md:text-base md:text-foreground">
                    {ORGANISATION_TYPE_LABELS[o.type]}
                  </td>
                  <td className="tabular block px-4 text-sm md:table-cell md:py-3 md:text-base">{formatPhone(o.phone)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{o.suburb}</td>
                  <td className="block px-4 pb-3 md:hidden xl:table-cell xl:py-3">
                    <TagList tags={o.organisation_tags.flatMap((ot) => (ot.tags ? [ot.tags] : []))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null;
  }

  const filtered = Boolean(q || sp.tag);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={showBin ? "Bin" : "Contacts"}
        description={
          showBin
            ? "Binned records are deleted for good after 30 days. Open one to restore it."
            : "Everyone we work with: people and the organisations they belong to."
        }
        actions={
          <>
            {can.importContacts(profile.role) && !showBin && (
              <Button asChild variant="outline">
                <Link href="/contacts/import">
                  <FileUp aria-hidden /> Import
                </Link>
              </Button>
            )}
            {can.exportData(profile.role) && !showBin && (
              <Button asChild variant="outline">
                <a href={`/api/export/${tab === "people" ? "contacts" : "organisations"}`} download>
                  <Download aria-hidden /> Export CSV
                </a>
              </Button>
            )}
            {!showBin && (tab === "people" ? <NewContactButton /> : <NewOrganisationButton variant="default" />)}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Contact type" className="inline-flex rounded-lg bg-muted p-1">
          {(
            [
              ["people", "People", UsersRound],
              ["organisations", "Organisations", Building2],
            ] as const
          ).map(([key, label, Icon]) => (
            <Link
              key={key}
              href={href(sp, { tab: key === "people" ? undefined : key, page: undefined })}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md px-4 font-semibold",
                tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>

        <form className="flex flex-1 flex-wrap items-center gap-2 lg:max-w-2xl lg:justify-end" role="search">
          {tab === "organisations" && <input type="hidden" name="tab" value="organisations" />}
          {showBin && <input type="hidden" name="bin" value="1" />}
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={sp.q}
              placeholder={tab === "people" ? "Name, email, mobile or suburb" : "Name, suburb or email"}
              aria-label={`Search ${tab}`}
              className="h-10 pl-9"
            />
          </div>
          {allTags && allTags.length > 0 && (
            <select
              name="tag"
              defaultValue={sp.tag ?? ""}
              aria-label="Filter by tag"
              className="h-10 rounded-lg border border-input bg-background px-3"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <Button type="submit" variant="secondary" className="h-10">
            Search
          </Button>
          {filtered && (
            <Button asChild variant="ghost" className="h-10">
              <Link href={href(sp, { q: undefined, tag: undefined, page: undefined })}>Clear</Link>
            </Button>
          )}
        </form>
      </div>

      {rows ??
        (filtered ? (
          <EmptyState icon={Search} title="No matches">
            Nothing matches your search. Try fewer words, or check the spelling.
          </EmptyState>
        ) : showBin ? (
          <EmptyState icon={Trash2} title="The bin is empty">
            Nothing has been deleted in the last 30 days.
          </EmptyState>
        ) : tab === "people" ? (
          <EmptyState
            icon={UserPlus}
            title="No contacts yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <NewContactButton label="Add a contact" />
                <Button asChild variant="outline">
                  <Link href="/contacts/import">
                    <FileUp aria-hidden /> Import a spreadsheet
                  </Link>
                </Button>
              </div>
            }
          >
            Add the people you work with: support coordinators, plan managers, family members and community contacts.
          </EmptyState>
        ) : (
          <EmptyState icon={Building2} title="No organisations yet" action={<NewOrganisationButton label="Add an organisation" variant="default" />}>
            Add the providers, plan managers and groups that refer to us or work alongside us.
          </EmptyState>
        ))}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p aria-live="polite">
          {total} {tab === "people" ? (total === 1 ? "person" : "people") : total === 1 ? "organisation" : "organisations"}
          {pages > 1 && ` · page ${page} of ${pages}`}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={href(sp, { page: String(page - 1) })}>Previous</Link>
            </Button>
          )}
          {page < pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={href(sp, { page: String(page + 1) })}>Next</Link>
            </Button>
          )}
          {can.deleteContacts(profile.role) && (
            <Button asChild variant="ghost" size="sm">
              <Link href={href(sp, { bin: showBin ? undefined : "1", page: undefined })}>
                <Trash2 aria-hidden /> {showBin ? "Back to contacts" : "Bin"}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

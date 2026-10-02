"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { OrganisationFormDialog } from "@/components/contacts/organisation-form-dialog";

type Ctx = {
  newContact: (defaults?: { organisation_id?: string }) => void;
  newOrganisation: () => void;
  canCreate: boolean;
};

const RecordDialogsContext = createContext<Ctx | null>(null);

/** Lets "+ New", the Ctrl+K bar and empty states all open the same add-a-record forms. */
export function RecordDialogsProvider({ children, canCreate }: { children: React.ReactNode; canCreate: boolean }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDefaults, setContactDefaults] = useState<{ organisation_id?: string }>({});
  const [orgOpen, setOrgOpen] = useState(false);
  // Bumped on every open so each form mounts fresh, with no leftovers from last time.
  const [contactKey, setContactKey] = useState(0);
  const [orgKey, setOrgKey] = useState(0);

  const newContact = useCallback((defaults: { organisation_id?: string } = {}) => {
    setContactDefaults(defaults);
    setContactKey((k) => k + 1);
    setContactOpen(true);
  }, []);
  const newOrganisation = useCallback(() => {
    setOrgKey((k) => k + 1);
    setOrgOpen(true);
  }, []);

  const value = useMemo(() => ({ newContact, newOrganisation, canCreate }), [newContact, newOrganisation, canCreate]);

  return (
    <RecordDialogsContext.Provider value={value}>
      {children}
      {canCreate && (
        <>
          <ContactFormDialog key={`contact-${contactKey}`} open={contactOpen} onOpenChange={setContactOpen} defaults={contactDefaults} />
          <OrganisationFormDialog key={`org-${orgKey}`} open={orgOpen} onOpenChange={setOrgOpen} />
        </>
      )}
    </RecordDialogsContext.Provider>
  );
}

export function useRecordDialogs() {
  const ctx = useContext(RecordDialogsContext);
  if (!ctx) throw new Error("useRecordDialogs must be used inside RecordDialogsProvider");
  return ctx;
}

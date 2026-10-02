"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Keyboard, Plus, Smartphone, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PinMark } from "@/components/brand/logo";
import { completeOnboarding } from "./actions";

const STEPS = [
  {
    icon: null,
    title: "Welcome to Waypoint Hub",
    body: "This is where we keep track of enquiries, referrals, our partners and what's happening in the community. Care records stay in ShiftCare. This is just for growing and looking after relationships.",
  },
  {
    icon: Sun,
    title: "Start each day on Today",
    body: "Today shows your tasks, your calendar, new referrals and anyone who needs a follow-up. If you only look at one screen, make it this one.",
  },
  {
    icon: Keyboard,
    title: "Find anything with Ctrl + K",
    body: "Press Ctrl and K together (or tap the search bar at the top) and start typing a name, email or phone number. You can also run quick actions from there.",
  },
  {
    icon: Plus,
    title: "Add things with the orange New button",
    body: "It's on every screen. Add a contact or organisation in a couple of clicks. We'll warn you if they might already be in here.",
  },
  {
    icon: Smartphone,
    title: "Works on your phone too",
    body: "Open Waypoint Hub in your phone's browser and choose \"Add to Home Screen\" to use it like an app when you're out in the community.",
  },
];

/** A short walkthrough shown the first time someone signs in. */
export function OnboardingTour({ firstName }: { firstName: string }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();
  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  const finish = () => {
    setOpen(false);
    startTransition(() => completeOnboarding());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-secondary">
            {Icon ? <Icon className="size-7 text-primary" aria-hidden /> : <PinMark size={36} />}
          </div>
          <DialogTitle className="text-xl">
            {step === 0 && firstName ? `Welcome, ${firstName}!` : current.title}
          </DialogTitle>
          <DialogDescription className="text-base text-foreground/80">{current.body}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Step {step + 1} of {STEPS.length}
        </p>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft aria-hidden /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={finish}>
              Skip the tour
            </Button>
          )}
          <Button size="lg" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
            {last ? "Let's go" : "Next"}
            {!last && <ArrowRight aria-hidden />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

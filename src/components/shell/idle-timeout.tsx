"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
const STORAGE_KEY = "wh_last_activity";
const KEEPALIVE_MS = 5 * 60 * 1000;

/**
 * Signs people out after 30 minutes without touching the app, with a one-minute warning
 * first. Protects participant information on shared or unattended devices.
 */
export function IdleTimeout() {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivity = useRef(0);

  useEffect(() => {
    lastActivity.current = Date.now();
    // Shared between tabs, so working in one tab keeps the others signed in too.
    let lastShared = 0;
    let lastPing = Date.now();
    const mark = () => {
      lastActivity.current = Date.now();
      if (lastActivity.current - lastShared > 10_000) {
        lastShared = lastActivity.current;
        try {
          localStorage.setItem(STORAGE_KEY, String(lastActivity.current));
        } catch {
          // Storage blocked (private mode): this tab's own timer still works.
        }
      }
    };
    EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    const timer = setInterval(() => {
      let shared = 0;
      try {
        shared = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
      } catch {}
      if (shared > lastActivity.current) lastActivity.current = shared;
      const idle = Date.now() - lastActivity.current;
      // Someone typing a long note makes no page requests; let the server know they're still here.
      if (idle < KEEPALIVE_MS && Date.now() - lastPing > KEEPALIVE_MS) {
        lastPing = Date.now();
        fetch("/api/keepalive", { method: "POST" }).catch(() => {});
      }
      if (idle >= IDLE_MS) {
        clearInterval(timer);
        signOut();
      } else if (idle >= IDLE_MS - WARNING_MS) {
        setWarning(true);
        setSecondsLeft(Math.ceil((IDLE_MS - idle) / 1000));
      } else {
        setWarning(false);
      }
    }, 1000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
    };
  }, []);

  return (
    <AlertDialog open={warning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            To keep everyone&apos;s information safe, we&apos;ll sign you out in{" "}
            <strong aria-live="polite">{secondsLeft} seconds</strong> unless you&apos;re still working.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              lastActivity.current = Date.now();
              try {
                localStorage.setItem(STORAGE_KEY, String(lastActivity.current));
              } catch {}
              setWarning(false);
            }}
          >
            I&apos;m still here
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function signOut() {
  const form = document.createElement("form");
  form.method = "post";
  form.action = "/auth/signout?reason=timeout";
  document.body.appendChild(form);
  form.submit();
}

/**
 * Test-notification dispatch.
 *
 * Every send here is explicitly SIMULATED — nothing leaves the browser. The
 * payload shape matches what a real SMS/e-mail/WhatsApp gateway would receive
 * so an officer can review it before anyone wires up a live channel.
 */

export type Channel = "SMS" | "Email" | "WhatsApp" | "IVR" | "Siren test";

export interface Recipient {
  id: string;
  name: string;
  role: string;
  channel: Channel;
  address: string;
}

export const TEST_RECIPIENTS: Recipient[] = [
  {
    id: "ddma",
    name: "District Disaster Management Authority — Control Room",
    role: "District Magistrate's desk",
    channel: "SMS",
    address: "+91-90XXX-TEST01",
  },
  {
    id: "imdcwc",
    name: "IMD Cyclone Warning Centre (test route)",
    role: "Forecast liaison",
    channel: "Email",
    address: "cwc-test@example.invalid",
  },
  {
    id: "municipal",
    name: "Municipal Commissioner's office (test route)",
    role: "Urban response",
    channel: "WhatsApp",
    address: "wa-test-9000000000",
  },
  {
    id: "shelter",
    name: "Shelter wardens' IVR group (test)",
    role: "Evacuation marshals",
    channel: "IVR",
    address: "ivr-group-07",
  },
];

export interface DispatchStep {
  label: string;
  at: string;
  state: "ok" | "pending";
}

export interface DispatchRecord {
  id: string;
  simulated: true;
  advisoryHeadline: string;
  scenario: string;
  validTime: string;
  assets: string[];
  evidenceCount: number;
  recipients: string[];
  sentAt: string;
  status: "queued" | "sent" | "delivered";
  steps: DispatchStep[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buildPayload(input: {
  headline: string;
  body: string;
  scenario: string;
  validTime: string;
  assets: string[];
  evidenceCount: number;
}): string {
  const body = input.body.replace(/\s+/g, " ").slice(0, 300);
  return `[SIMULATED TEST] ${input.headline} | Scenario: ${input.scenario} | Valid: ${
    input.validTime
  } | Exposed assets: ${input.assets.slice(0, 6).join("; ")}${
    input.assets.length > 6 ? ` (+${input.assets.length - 6} more)` : ""
  } | Evidence items: ${input.evidenceCount} | ${body}`;
}

export async function sendTestDispatch(
  input: {
    headline: string;
    body: string;
    scenario: string;
    validTime: string;
    assets: string[];
    evidenceCount: number;
  },
  recipients: Recipient[],
  onStep: (record: DispatchRecord) => void,
): Promise<DispatchRecord> {
  const sentAt = new Date().toISOString();
  const record: DispatchRecord = {
    id: `TEST-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    simulated: true,
    advisoryHeadline: input.headline,
    scenario: input.scenario,
    validTime: input.validTime,
    assets: input.assets,
    evidenceCount: input.evidenceCount,
    recipients: recipients.map((r) => `${r.name} → ${r.address}`),
    sentAt,
    status: "queued",
    steps: [],
  };

  const push = (label: string, state: "ok" | "pending") => {
    record.steps.push({ label, at: new Date().toISOString(), state });
    onStep({ ...record, steps: [...record.steps] });
  };

  onStep({ ...record });
  await sleep(350);
  push(`Payload assembled — ${buildPayload(input).length} chars, evidence items attached`, "ok");
  record.status = "sent";
  onStep({ ...record, steps: [...record.steps] });

  for (const r of recipients) {
    await sleep(420);
    push(`${r.channel} accepted by gateway (simulated): ${r.address}`, "ok");
  }

  await sleep(500);
  push(`Delivery receipts returned for ${recipients.length}/${recipients.length} recipients (simulated)`, "ok");
  record.status = "delivered";
  onStep({ ...record, steps: [...record.steps] });
  return record;
}

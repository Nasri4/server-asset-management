import axios from "axios";

import { env } from "../config/env";
import { audit } from "./audit";

export type SmsSendParams = {
  to: string;
  message: string;
  kind: string;
  actor: string;
  entity: string;
  entityId?: string | number | null;
  details?: any;
};

export async function sendSmsPlaceholder(params: SmsSendParams) {
  const url = (env.notifications.smsApiUrl ?? "").trim();
  const to = (params.to ?? "").trim();
  const message = String(params.message ?? "").trim();

  let delivered = false;
  let mode: "placeholder" | "provider" = "placeholder";

  if (!to || !message) {
    await audit({
      actor: params.actor,
      action: "SMS_SKIPPED",
      entity: params.entity,
      entityId: params.entityId ?? null,
      details: {
        reason: !to ? "missing_to" : "missing_message",
        to,
        kind: params.kind,
        ...params.details,
      },
    });
    return { delivered: false, mode };
  }

  if (!url) {
    if (env.nodeEnv !== "production") {
      console.log(`[sms] placeholder kind=${params.kind} to=${to}`);
    }
    delivered = true;
    mode = "placeholder";
  } else {
    mode = "provider";
    await axios.post(
      url,
      {
        to,
        message,
        source: "SAM",
        kind: params.kind,
      },
      { timeout: 10_000 }
    );
    delivered = true;
  }

  await audit({
    actor: params.actor,
    action: "SMS_SENT",
    entity: params.entity,
    entityId: params.entityId ?? null,
    details: {
      to,
      kind: params.kind,
      delivered,
      mode,
      sms_api_url_configured: Boolean(url),
      ...params.details,
    },
  });

  return { delivered: true, mode };
}

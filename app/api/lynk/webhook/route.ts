import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const maxWebhookBytes = 64 * 1024;
const requestTimeoutMs = 10_000;

type JsonRecord = Record<string, unknown>;

type AccessCodeDelivery = {
  recipient_email: string;
  recipient_name: string;
  access_code: string | null;
  already_sent: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(
  status: number,
  body: { error?: string; received?: boolean; invalid_fields?: string[] },
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxWebhookBytes) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}

async function callSupabaseRpc<T>(functionName: string, args: JsonRecord): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server configuration.");
  }

  const rpcUrl = new URL(`/rest/v1/rpc/${functionName}`, supabaseUrl);
  const rpcResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store",
  });

  if (!rpcResponse.ok) {
    throw new Error(`Supabase RPC ${functionName} failed with status ${rpcResponse.status}.`);
  }

  return await rpcResponse.json() as T;
}

async function sendAccessCodeEmail(delivery: AccessCodeDelivery): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL_BREVO;
  if (!apiKey || !senderEmail) {
    throw new Error("Missing Brevo server configuration.");
  }

  const customerName = delivery.recipient_name.trim();
  const greeting = customerName ? `Hi ${escapeHtml(customerName)},` : "Hi pelanggan JOOLO,";
  const code = escapeHtml(delivery.access_code ?? "");
  const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: "JOOLO" },
      to: [{ email: delivery.recipient_email, name: customerName || undefined }],
      subject: "Kode Akses JOOLO Anda",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6">
          <p>${greeting}</p>
          <p>Terima kasih telah melakukan checkout dan bergabung dengan JOOLO.</p>
          <p>Gunakan kode akses berikut untuk membuka dashboard JOOLO:</p>
          <p style="display:inline-block;padding:12px 16px;border-radius:8px;background:#101b2e;color:#9ffff5;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:2px">${code}</p>
          <p>Kode ini hanya dapat digunakan satu kali. Simpan kode ini dan jangan bagikan kepada orang lain.</p>
          <p>Jika ada kendala, hubungi admin JOOLO melalui <a href="https://wa.me/6287893951233">WhatsApp</a>.</p>
          <p>Salam hangat,<br>Tim JOOLO</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
    cache: "no-store",
  });

  if (!emailResponse.ok) {
    throw new Error(`Brevo email request failed with status ${emailResponse.status}.`);
  }
}

export async function POST(request: Request) {
  const merchantKey = process.env.MERCHANT_KEY;
  if (!merchantKey) {
    console.error("Lynk webhook is missing its merchant key configuration.");
    return response(503, { error: "Webhook is not configured." });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxWebhookBytes) {
    return response(413, { error: "Webhook payload is too large." });
  }

  let bodyText: string | null;
  try {
    bodyText = await readBoundedBody(request);
  } catch {
    console.warn("Lynk webhook request body could not be read.");
    return response(400, { error: "Could not read webhook payload." });
  }
  if (bodyText === null) {
    return response(413, { error: "Webhook payload is too large." });
  }
  if (!bodyText.trim()) {
    console.warn("Lynk webhook received an empty payload.");
    return response(400, { error: "Webhook payload is empty." });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    console.warn("Lynk webhook payload was not valid JSON.");
    return response(400, { error: "Webhook payload is not valid JSON." });
  }

  if (!isRecord(payload) || payload.event !== "payment.received") {
    return response(200, { received: true });
  }
  if (!isRecord(payload.data) || payload.data.message_action !== "SUCCESS" || payload.data.message_code !== "0") {
    return response(200, { received: true });
  }

  const paymentData = payload.data;
  const messageData = isRecord(paymentData.message_data) ? paymentData.message_data : null;
  const customer = messageData && isRecord(messageData.customer) ? messageData.customer : null;
  const totals = messageData && isRecord(messageData.totals) ? messageData.totals : null;
  const messageId = paymentData.message_id;
  const refId = messageData?.refId;
  const amount = totals?.grandTotal;
  const customerEmail = customer?.email;
  const customerName = customer?.name;
  const receivedSignature = request.headers.get("X-Lynk-Signature")?.trim() ?? "";

  if (
    typeof messageId !== "string" || !messageId.trim() || messageId.length > 200
    || typeof refId !== "string" || !refId.trim() || refId.length > 200
    || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0
    || typeof customerEmail !== "string"
    || customerEmail.length > 320
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    || (customerName !== undefined && typeof customerName !== "string")
  ) {
    const invalidFields: string[] = [];
    if (typeof messageId !== "string" || !messageId.trim() || messageId.length > 200) {
      invalidFields.push("data.message_id");
    }
    if (typeof refId !== "string" || !refId.trim() || refId.length > 200) {
      invalidFields.push("data.message_data.refId");
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      invalidFields.push("data.message_data.totals.grandTotal");
    }
    if (
      typeof customerEmail !== "string"
      || customerEmail.length > 320
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    ) {
      invalidFields.push("data.message_data.customer.email");
    }
    if (customerName !== undefined && typeof customerName !== "string") {
      invalidFields.push("data.message_data.customer.name");
    }
    console.warn("Lynk webhook successful payment has invalid fields.", invalidFields);
    return response(400, {
      error: "Successful payment is missing required customer or transaction details.",
      invalid_fields: invalidFields,
    });
  }

  const expectedSignature = createHash("sha256")
    .update(`${String(amount)}${refId}${messageId}${merchantKey}`, "utf8")
    .digest();
  if (!/^[a-f\d]{64}$/i.test(receivedSignature)) {
    return response(401, { error: "Invalid Lynk signature." });
  }
  const signatureBytes = Buffer.from(receivedSignature, "hex");
  if (signatureBytes.length !== expectedSignature.length || !timingSafeEqual(signatureBytes, expectedSignature)) {
    return response(401, { error: "Invalid Lynk signature." });
  }

  try {
    const deliveries = await callSupabaseRpc<AccessCodeDelivery[]>("prepare_lynk_access_code", {
      p_message_id: messageId,
      p_ref_id: refId,
      p_email: customerEmail,
      p_customer_name: typeof customerName === "string" ? customerName : "",
    });
    const delivery = Array.isArray(deliveries) ? deliveries[0] : undefined;

    if (!delivery) {
      throw new Error("Supabase did not return an access-code delivery.");
    }
    if (delivery.already_sent) {
      return response(200, { received: true });
    }
    if (
      delivery.recipient_email !== customerEmail.toLowerCase()
      || typeof delivery.access_code !== "string"
      || !/^[A-HJ-NP-Z2-9]{16}$/.test(delivery.access_code)
    ) {
      throw new Error("Supabase returned an invalid pending access-code delivery.");
    }

    await sendAccessCodeEmail(delivery);
    const markedSent = await callSupabaseRpc<boolean>("mark_lynk_access_code_sent", { p_ref_id: refId });
    if (markedSent !== true) {
      throw new Error("Supabase could not mark the access-code email as sent.");
    }

    return response(200, { received: true });
  } catch (error) {
    console.error("Lynk payment webhook processing failed.", error);
    return response(500, { error: "Payment notification could not be processed; please retry." });
  }
}

import net from "node:net";
import tls from "node:tls";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function getEmailConfigStatus() {
  return {
    configured: resendConfigured() || smtpConfigured(),
    provider: resendConfigured() ? "resend" : smtpConfigured() ? "smtp" : "preview",
    resendApiKey: Boolean(process.env.RESEND_API_KEY),
    emailFrom: Boolean(process.env.EMAIL_FROM),
    animationEmail: Boolean(process.env.ANIMATION_EMAIL),
    smtpHost: Boolean(process.env.SMTP_HOST),
    smtpPort: Boolean(process.env.SMTP_PORT),
    smtpSecure: Boolean(process.env.SMTP_SECURE),
    smtpUser: Boolean(process.env.SMTP_USER),
    smtpPass: Boolean(process.env.SMTP_PASS),
    smtpFrom: Boolean(process.env.SMTP_FROM)
  };
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function normalizeAddress(value) {
  return String(value || "").trim();
}

function errorDetail(error) {
  if (error instanceof AggregateError && Array.isArray(error.errors)) {
    return error.errors
      .map((inner) => inner?.message || inner?.code || String(inner))
      .filter(Boolean)
      .join(" | ") || error.message || "AggregateError";
  }

  return error?.message || error?.code || String(error) || "Erreur SMTP inconnue.";
}

function command(socket, line, expected = [250]) {
  return new Promise((resolve, reject) => {
    let response = "";
    let settled = false;

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
      socket.off("timeout", onTimeout);
    }

    function finish(error, value) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    }

    function onError(error) {
      finish(error || new Error("Erreur SMTP inconnue."));
    }

    function onClose() {
      finish(new Error(response.trim() || "Connexion SMTP fermee par le serveur."));
    }

    function onTimeout() {
      finish(new Error("Delai SMTP depasse."));
    }

    function onData(chunk) {
      response += chunk.toString("utf8");
      const lines = response.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";

      if (!/^\d{3} /.test(last)) return;

      const code = Number(last.slice(0, 3));
      if (expected.includes(code)) finish(null, response);
      else finish(new Error(`SMTP ${code}: ${response.trim()}`));
    }

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
    socket.once("timeout", onTimeout);
    if (line) socket.write(`${line}\r\n`);
  });
}

function connectSmtp() {
  return new Promise((resolve, reject) => {
    const port = Number(process.env.SMTP_PORT || 587);
    const host = process.env.SMTP_HOST;
    const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
    const socket = secure ? tls.connect(port, host) : net.connect(port, host);

    socket.setTimeout(15000);
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("Delai SMTP depasse.")));
    socket.once(secure ? "secureConnect" : "connect", async () => {
      try {
        await command(socket, "", [220]);
        resolve({ socket, secure });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function upgradeStartTls(socket) {
  await command(socket, "STARTTLS", [220]);

  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: process.env.SMTP_HOST
    });

    secureSocket.once("secureConnect", () => resolve(secureSocket));
    secureSocket.once("error", reject);
    secureSocket.once("timeout", () => reject(new Error("Delai STARTTLS depasse.")));
  });
}

function buildMessage({ from, to, cc, subject, text, attachment }) {
  const boundary = `arkadia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const recipients = [to, cc].filter(Boolean).join(", ");
  const attachmentBase64 = attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n");

  return [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    "",
    attachmentBase64,
    "",
    `--${boundary}--`,
    ""
  ].filter((line) => line !== "").join("\r\n").replace(/\r\n\./g, "\r\n..") + "\r\n.";
}

async function sendSmtpMail({ to, cc, subject, text, attachment }) {
  const from = process.env.SMTP_FROM;
  const { socket, secure } = await connectSmtp();
  let currentSocket = socket;

  try {
    await command(currentSocket, `EHLO ${process.env.SMTP_EHLO || "arkadia.local"}`, [250]);

    if (!secure && Number(process.env.SMTP_PORT || 587) !== 25) {
      currentSocket = await upgradeStartTls(currentSocket);
      await command(currentSocket, `EHLO ${process.env.SMTP_EHLO || "arkadia.local"}`, [250]);
    }

    await command(currentSocket, "AUTH LOGIN", [334]);
    await command(currentSocket, Buffer.from(process.env.SMTP_USER, "utf8").toString("base64"), [334]);
    await command(currentSocket, Buffer.from(process.env.SMTP_PASS, "utf8").toString("base64"), [235]);
    await command(currentSocket, `MAIL FROM:<${from}>`, [250]);

    const recipients = [to, cc].filter(Boolean);
    for (const recipient of recipients) {
      await command(currentSocket, `RCPT TO:<${recipient}>`, [250, 251]);
    }

    await command(currentSocket, "DATA", [354]);
    await command(currentSocket, buildMessage({ from, to, cc, subject, text, attachment }), [250]);
    await command(currentSocket, "QUIT", [221]);
  } finally {
    currentSocket.end();
  }
}

async function sendResendMail({ to, cc, subject, text, attachment }) {
  const recipients = [to].filter(Boolean);
  const ccRecipients = [cc].filter(Boolean);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: recipients,
      cc: ccRecipients.length ? ccRecipients : undefined,
      subject,
      text,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content.toString("base64")
        }
      ]
    })
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Resend HTTP ${response.status}: ${body}`);
  }

  return body;
}

export async function sendCharacterWorkbookEmail({ data, workbook, emailPreview, filename }) {
  const animationEmail = normalizeAddress(process.env.ANIMATION_EMAIL || "vidarmazrim@gmail.com");
  const playerEmail = normalizeAddress(data.joueur?.email);

  if (!resendConfigured() && !smtpConfigured()) {
    return {
      sent: false,
      mode: "preview",
      message: "Fiche recue. Aucun fournisseur courriel configure: mode previsualisation.",
      smtpConfig: getEmailConfigStatus(),
      recipients: {
        animation: animationEmail,
        joueur: playerEmail
      }
    };
  }

  if (resendConfigured()) {
    try {
      await sendResendMail({
        to: animationEmail,
        cc: playerEmail,
        subject: `Fiche Arkadia - ${data.personnage?.nom || "Personnage"}`,
        text: emailPreview,
        attachment: {
          filename,
          content: workbook
        }
      });

      return {
        sent: true,
        mode: "resend",
        message: "Fiche envoyee par courriel.",
        recipients: {
          animation: animationEmail,
          joueur: playerEmail
        }
      };
    } catch (error) {
      return {
        sent: false,
        mode: "resend-error",
        message: `Courriel non envoye: ${errorDetail(error)}`,
        recipients: {
          animation: animationEmail,
          joueur: playerEmail
        }
      };
    }
  }

  try {
    await sendSmtpMail({
      to: animationEmail,
      cc: playerEmail,
      subject: `Fiche Arkadia - ${data.personnage?.nom || "Personnage"}`,
      text: emailPreview,
      attachment: {
        filename,
        content: workbook
      }
    });
  } catch (error) {
    const detail = errorDetail(error);
    return {
      sent: false,
      mode: "smtp-error",
      message: `Courriel non envoye: ${detail}`,
      recipients: {
        animation: animationEmail,
        joueur: playerEmail
      }
    };
  }

  return {
    sent: true,
    mode: "smtp",
    message: "Fiche envoyee par courriel.",
    recipients: {
      animation: animationEmail,
      joueur: playerEmail
    }
  };
}

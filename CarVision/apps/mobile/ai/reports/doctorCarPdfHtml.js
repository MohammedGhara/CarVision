/**
 * Server-free HTML for expo-print — DoctorCar AI full snapshot.
 * All user/vehicle strings must be passed through escapeHtml.
 */

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function h2(text) {
  return `<h2 style="font-size:16px;margin:18px 0 8px 0;color:#111827;border-bottom:1px solid #E5E7EB;padding-bottom:4px;">${text}</h2>`;
}

function p(text, sub = false) {
  return `<p style="margin:4px 0;font-size:13px;line-height:1.5;color:${sub ? "#4B5563" : "#111827"};">${text}</p>`;
}

function bulletList(lines) {
  if (!lines?.length) return `<p style="color:#9CA3AF;font-size:13px;margin:4px 0;">—</p>`;
  const items = lines.map((line) => `<li style="margin:4px 0;font-size:13px;color:#374151;">${escapeHtml(line)}</li>`).join("");
  return `<ul style="margin:8px 0;padding-left:20px;">${items}</ul>`;
}

function vitalsTable(rows) {
  const tr = rows
    .map(
      ([label, val]) => `
    <tr>
      <td style="padding:8px;border:1px solid #E5E7EB;font-size:13px;color:#374151;">${escapeHtml(label)}</td>
      <td style="padding:8px;border:1px solid #E5E7EB;font-size:13px;font-weight:600;color:#111827;">${escapeHtml(val)}</td>
    </tr>`
    )
    .join("");
  return `
    <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
      <tbody>${tr}</tbody>
    </table>`;
}

/**
 * @param {object} opts
 * @param {string} opts.reportTitle
 * @param {string} opts.subtitle
 * @param {string} opts.generatedAt
 * @param {string|null} opts.sessionUpdated
 * @param {string} opts.healthScoreLine
 * @param {string} opts.healthBandLine
 * @param {string} opts.summaryLine
 * @param {string} opts.riskLine
 * @param {string} opts.guidanceLine
 * @param {string[]} opts.analysisLines
 * @param {string} opts.primaryRecommendation
 * @param {string[]} opts.secondaryRecommendations
 * @param {string|null} opts.mlLine
 * @param {string[]} opts.maintenanceLines
 * @param {string[][]} opts.vitalRows [label, value][]
 * @param {string[]} opts.warningLines
 * @param {string[]} opts.anomalyLines
 * @param {string[]} opts.predictiveLines
 * @param {string} opts.dtcBlocksHtml
 * @param {string} opts.footerDisclaimer
 */
export function buildDoctorCarPdfHtml(opts) {
  const {
    reportTitle,
    subtitle,
    generatedAt,
    sessionUpdated,
    healthScoreLine,
    healthBandLine,
    summaryLine,
    riskLine,
    guidanceLine,
    analysisLines,
    primaryRecommendation,
    secondaryRecommendations,
    mlLine,
    maintenanceLines,
    vitalRows,
    warningLines,
    anomalyLines,
    predictiveLines,
    dtcBlocksHtml,
    footerDisclaimer,
  } = opts;

  const sec2 = secondaryRecommendations?.length
    ? bulletList(secondaryRecommendations)
    : `<p style="color:#9CA3AF;font-size:13px;">—</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(reportTitle)}</title>
</head>
<body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;margin:20px;color:#111827;max-width:720px;">
  <h1 style="font-size:22px;margin:0 0 4px 0;">${escapeHtml(reportTitle)}</h1>
  <p style="margin:0 0 12px 0;font-size:13px;color:#6B7280;">${escapeHtml(subtitle)}</p>
  <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;"><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>
  ${
    sessionUpdated
      ? `<p style="margin:0 0 16px 0;font-size:12px;color:#6B7280;"><strong>Telemetry snapshot:</strong> ${escapeHtml(sessionUpdated)}</p>`
      : `<p style="margin:0 0 16px 0;font-size:12px;color:#9CA3AF;">No live telemetry session at export.</p>`
  }

  ${h2("Health & summary")}
  ${p(`<strong>${escapeHtml(healthScoreLine)}</strong>`)}
  ${p(escapeHtml(healthBandLine))}
  ${p(escapeHtml(summaryLine))}

  ${h2("Risk & drive guidance")}
  ${p(escapeHtml(riskLine))}
  ${p(escapeHtml(guidanceLine))}

  ${h2("Live analysis")}
  ${bulletList(analysisLines)}

  ${h2("Recommendations")}
  ${p(`<strong>Primary:</strong> ${escapeHtml(primaryRecommendation)}`)}
  <p style="margin:8px 0 4px 0;font-size:12px;color:#6B7280;font-weight:600;">Also consider</p>
  ${sec2}

  ${mlLine ? `${h2("Learned fault estimate")}${p(escapeHtml(mlLine))}` : ""}

  ${h2("Predictive maintenance outlook")}
  ${bulletList(maintenanceLines)}

  ${h2("Live vitals")}
  ${vitalsTable(vitalRows)}

  ${h2("AI detections (rules)")}
  ${bulletList(warningLines)}

  ${h2("Anomaly detection")}
  ${bulletList(anomalyLines)}

  ${h2("Predictive hints")}
  ${bulletList(predictiveLines)}

  ${h2("DTC intelligence")}
  ${dtcBlocksHtml || `<p style="color:#9CA3AF;font-size:13px;">No trouble codes in snapshot.</p>`}

  <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB;" />
  <p style="font-size:11px;color:#9CA3AF;line-height:1.45;margin:0;">${escapeHtml(footerDisclaimer)}</p>
  <p style="font-size:10px;color:#D1D5DB;margin-top:12px;">CarVision DoctorCar AI — informational only; does not replace professional diagnosis.</p>
</body>
</html>`;
}

/**
 * @param {object} d
 * @param {(u: string) => string} tUrgency
 */
export function buildDtcBlockHtml(d, tUrgency) {
  const urg = d.urgency ? escapeHtml(tUrgency(d.urgency)) : "";
  let html = `<div style="margin-bottom:14px;padding:12px;border:1px solid #E5E7EB;border-radius:10px;background:#FAFAFA;">`;
  html += `<h3 style="margin:0 0 6px;font-size:14px;color:#111827;">${escapeHtml(d.code)}</h3>`;
  html += `<p style="margin:0 0 10px;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(formatSeverity(d.severity))}${urg ? ` · ${urg}` : ""}${d.category ? ` · ${escapeHtml(d.category)}` : ""}</p>`;
  if (d.aiSummary) {
    html += `<p style="margin:6px 0;font-size:12px;color:#4338CA;background:#EEF2FF;padding:8px;border-radius:8px;"><strong>AI:</strong> ${escapeHtml(d.aiSummary)}</p>`;
  }
  if (d.explanation) {
    html += `<p style="margin:8px 0;font-size:12px;color:#374151;line-height:1.45;">${escapeHtml(d.explanation)}</p>`;
  }
  if (d.canDrive) {
    html += `<p style="margin:6px 0;font-size:12px;color:#B45309;"><strong>Drive:</strong> ${escapeHtml(d.canDrive)}</p>`;
  }
  if (d.symptoms?.length) {
    html += `<p style="margin:8px 0 4px;font-size:11px;color:#6B7280;font-weight:600;">Symptoms</p><ul style="margin:0;padding-left:18px;">`;
    for (const s of d.symptoms) {
      html += `<li style="font-size:12px;color:#374151;margin:2px 0;">${escapeHtml(s)}</li>`;
    }
    html += `</ul>`;
  }
  const causes = d.possibleCauses?.length ? d.possibleCauses : d.causes;
  if (causes?.length) {
    html += `<p style="margin:8px 0 4px;font-size:11px;color:#6B7280;font-weight:600;">Possible causes</p><ul style="margin:0;padding-left:18px;">`;
    for (const c of causes) {
      html += `<li style="font-size:12px;color:#374151;margin:2px 0;">${escapeHtml(c)}</li>`;
    }
    html += `</ul>`;
  }
  if (d.recommendedAction) {
    let ra = d.recommendedAction;
    if (d.estimatedRepairCost) ra += ` (${d.estimatedRepairCost})`;
    html += `<p style="margin:8px 0;font-size:12px;color:#111827;"><strong>Recommended:</strong> ${escapeHtml(ra)}</p>`;
  }
  if (d.recommendations?.length) {
    html += `<p style="margin:8px 0 4px;font-size:11px;color:#6B7280;font-weight:600;">Repair notes</p><ul style="margin:0;padding-left:18px;">`;
    for (const r of d.recommendations) {
      html += `<li style="font-size:11px;color:#4B5563;margin:2px 0;">${escapeHtml(r)}</li>`;
    }
    html += `</ul>`;
  }
  html += `</div>`;
  return html;
}

function formatSeverity(sev) {
  const s = String(sev || "unknown");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

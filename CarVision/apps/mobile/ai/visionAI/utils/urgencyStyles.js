/** @param {'low'|'medium'|'high'|'critical'} urgency */
export function urgencyColors(urgency) {
  switch (urgency) {
    case "critical":
      return { bg: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.55)", text: "#FCA5A5" };
    case "high":
      return { bg: "rgba(251,146,60,0.16)", border: "rgba(251,146,60,0.5)", text: "#FDBA74" };
    case "medium":
      return { bg: "rgba(250,204,21,0.12)", border: "rgba(250,204,21,0.45)", text: "#FDE68A" };
    default:
      return { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.4)", text: "#6EE7B7" };
  }
}

/** @param {'yes'|'no'|'caution'} advice */
export function driveAdviceColors(advice) {
  switch (advice) {
    case "yes":
      return { bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.45)", text: "#34D399", icon: "checkmark-circle" };
    case "no":
      return { bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.5)", text: "#F87171", icon: "close-circle" };
    default:
      return { bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.48)", text: "#FBBF24", icon: "alert-circle" };
  }
}

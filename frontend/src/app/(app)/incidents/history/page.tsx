import { redirect } from "next/navigation";

export default function IncidentHistoryPage() {
  // History is now embedded inside /incidents (use the History toggle).
  redirect("/incidents");
}

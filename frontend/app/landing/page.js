import { redirect } from "next/navigation";

// The landing page lives at the site root ("/"). This route is kept as a
// redirect so any existing links/bookmarks to /landing still work.
export default function LandingRedirect() {
  redirect("/");
}

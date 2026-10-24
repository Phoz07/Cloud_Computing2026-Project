import { useEffect } from "react";
import { pageTitle, SITE_NAME } from "@/lib/site";

/**
 * The tab title while the page shows `title`. Until it's known, the title stays as it is: on the
 * first page that's the one the server sent (server/head.ts).
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = pageTitle(title);
    // back to the site's name, not to the title before: that may be the server's, of another page
    return () => {
      document.title = SITE_NAME;
    };
  }, [title]);
}

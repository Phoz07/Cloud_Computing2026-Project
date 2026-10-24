import { and, asc, db, eq, organizerApplications, users } from "@app/db";
import { HTTPError } from "elysia";
import type * as OrganizerModel from "./model";

export class OrganizerNotFound extends HTTPError.id("ORGANIZER_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบผู้จัดงานนี้";
}

/**
 * Public profile of whoever organizes an event. Plain users answer 404 like unknown ids, so this
 * can't be used to look up arbitrary accounts; someone approved before still has a profile even
 * after losing the role, because their events may still be listed.
 */
export async function getOrganizerProfile(id: string): Promise<OrganizerModel.Profile | OrganizerNotFound> {
  const [user] = await db
    .select({ id: users.id, name: users.name, image: users.image, role: users.role })
    .from(users)
    .where(eq(users.id, id));
  if (!user) return new OrganizerNotFound();

  const approved = await db
    .select({ organizationName: organizerApplications.organizationName, reviewedAt: organizerApplications.reviewedAt })
    .from(organizerApplications)
    .where(and(eq(organizerApplications.userId, id), eq(organizerApplications.status, "approved")))
    .orderBy(asc(organizerApplications.reviewedAt));
  if (approved.length === 0 && user.role !== "organizer" && user.role !== "admin") return new OrganizerNotFound();

  // first approval for "since"; the latest one carries the name they organize under now
  const first = approved[0];
  const latest = approved.at(-1);
  return {
    id: user.id,
    name: latest?.organizationName ?? user.name,
    image: user.image ?? null,
    organizerSince: first?.reviewedAt?.toISOString() ?? null,
  };
}

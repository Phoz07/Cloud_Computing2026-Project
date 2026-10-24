import { db, eq, users } from "@app/db";
import { deleteFile, ownedKey, storeFile } from "@app/storage";

// users.image is Better Auth's field and Google writes absolute URLs into it, so it holds the
// browser path (/files/<key>) rather than a bare key. The row lock makes concurrent uploads each
// delete exactly the image they replaced.
async function replaceImage(userId: string, image: string | null) {
  const previous = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    await tx.update(users).set({ image }).where(eq(users.id, userId));
    return row?.image;
  });
  // only our own upload is deleted, never a Google photo or a path the user set by hand
  await deleteFile(ownedKey(previous, "avatar", userId));
}

export async function setAvatar(userId: string, file: File) {
  const stored = await storeFile("avatar", userId, file);
  if (stored instanceof Error) return stored;
  await replaceImage(userId, stored.url);
  return { image: stored.url };
}

export async function removeAvatar(userId: string) {
  await replaceImage(userId, null);
  return { image: null };
}

const MiB = 1024 * 1024;

const imageTypes = ["image/jpeg", "image/png", "image/webp"];

type FileKindConfig = {
  /** Which domain id the files hang off: `public/<owner>/<ownerId>/<folder>/<fileId>` */
  owner: "users" | "events";
  folder: string;
  types: string[];
  maxSize: number;
};

// Every kind of file a service may store. Add new kinds here, not ad hoc in a service.
// Everything under `public/` is anonymously readable (bucket policy in docker-compose.yml).
export const fileKinds = {
  avatar: { owner: "users", folder: "avatar", types: imageTypes, maxSize: 2 * MiB },
  eventCover: { owner: "events", folder: "cover", types: imageTypes, maxSize: 5 * MiB },
  eventAsset: { owner: "events", folder: "assets", types: imageTypes, maxSize: 10 * MiB },
} as const satisfies Record<string, FileKindConfig>;

export type FileKind = keyof typeof fileKinds;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const folderOf = (kind: FileKind, ownerId: string) => {
  const { owner, folder } = fileKinds[kind];
  return `public/${owner}/${ownerId}/${folder}`;
};

/** The only keys a kind may write: owner and file ids are uuids, so no `..` or stray segments. */
export const keyPattern = (kind: FileKind) => {
  const { owner, folder } = fileKinds[kind];
  return new RegExp(`^public/${owner}/${UUID}/${folder}/${UUID}$`);
};

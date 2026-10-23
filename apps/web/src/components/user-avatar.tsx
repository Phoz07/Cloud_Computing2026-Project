import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)).toUpperCase();
}

export function UserAvatar({
  user,
  ...props
}: React.ComponentProps<typeof Avatar> & { user: { name: string; image?: string | null } }) {
  return (
    <Avatar data-slot="user-avatar" {...props}>
      {user.image && <AvatarImage src={user.image} alt={user.name} />}
      <AvatarFallback>{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

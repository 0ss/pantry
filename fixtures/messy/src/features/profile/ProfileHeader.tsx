import { formatDate } from "../../utils/date";

export function ProfileHeader({ name, joinedAt }: { name: string; joinedAt: string }) {
  return (
    <header>
      <h1>{name}</h1>
      <p>Joined {formatDate(joinedAt)}</p>
    </header>
  );
}

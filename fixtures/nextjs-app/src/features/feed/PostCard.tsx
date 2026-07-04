import { Heart, MessageCircle } from "lucide-react";
import { formatRelativeTime } from "@/lib/date";
import { truncate } from "@/lib/utils";

interface Post {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  likes: number;
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-lg border p-4">
      <header className="flex items-center justify-between">
        <span className="font-medium">{post.author}</span>
        <time className="text-sm text-slate-500">{formatRelativeTime(post.createdAt)}</time>
      </header>
      <p className="mt-2">{truncate(post.body, 240)}</p>
      <footer className="mt-3 flex gap-4 text-sm text-slate-500">
        <span>
          <Heart size={14} /> {post.likes}
        </span>
        <span>
          <MessageCircle size={14} /> Reply
        </span>
      </footer>
    </article>
  );
}

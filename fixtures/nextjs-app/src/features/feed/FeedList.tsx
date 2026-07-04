"use client";
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { PostCard } from "./PostCard";

interface Post {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  likes: number;
}

export function FeedList({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query);
  const visible = posts.filter((p) => p.body.toLowerCase().includes(debouncedQuery.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts"
        className="rounded-md border px-3 py-2"
      />
      {visible.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

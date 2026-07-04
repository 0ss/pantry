"use client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { profileSchema } from "@/schemas/user";

export function ProfileForm() {
  const { register, handleSubmit } = useForm();
  const { push } = useToast();

  const onSubmit = handleSubmit((data) => {
    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) {
      push("Please fix the errors", "error");
      return;
    }
    push("Profile saved");
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input {...register("name")} placeholder="Name" className="rounded-md border px-3 py-2" />
      <textarea {...register("bio")} placeholder="Bio" className="rounded-md border px-3 py-2" />
      <Button type="submit">Save</Button>
    </form>
  );
}

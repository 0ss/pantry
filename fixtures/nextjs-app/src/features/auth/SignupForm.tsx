"use client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { signupSchema } from "@/schemas/user";

export function SignupForm({ onSignup }: { onSignup: (email: string) => void }) {
  const { register, handleSubmit, setError } = useForm();

  const onSubmit = handleSubmit((data) => {
    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
      setError("root", { message: "Invalid input" });
      return;
    }
    onSignup(parsed.data.email);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input {...register("email")} type="email" placeholder="Email" />
      <input {...register("password")} type="password" placeholder="Password" />
      <input {...register("name")} placeholder="Name" />
      <Button type="submit">Sign up</Button>
    </form>
  );
}

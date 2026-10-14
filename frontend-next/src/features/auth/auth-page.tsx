import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, Network, Sparkles, UsersRound } from "lucide-react";
import { AuthForm } from "@/features/auth/auth-form";
import { currentActor } from "@/server/session";

export async function AuthPage({ mode }: { mode: "login" | "register" }) {
  if (await currentActor(await headers())) redirect("/dashboard");
  const register = mode === "register";
  return (
    <section className="auth-layout">
      <aside className="auth-story">
        <div className="auth-story-copy">
          <p className="auth-eyebrow"><Sparkles aria-hidden="true" /> {register ? "A shared classroom starts here" : "Welcome back to your classroom"}</p>
          <h1>{register ? "Make room for better learning." : "Pick up where your class left off."}</h1>
          <p>{register ? "Bring teaching and learning into one connected space, with you in control." : "Your courses, your class material and your next steps are all in one place."}</p>
        </div>
        <div className="auth-feature-list">
          <div><span className="auth-feature-swatch auth-swatch-yellow"><Network aria-hidden="true" /></span><span><strong>Connected curriculum</strong><small>Clear paths through big ideas</small></span><ArrowRight aria-hidden="true" /></div>
          <div><span className="auth-feature-swatch auth-swatch-mint"><BookOpenCheck aria-hidden="true" /></span><span><strong>Courses with a rhythm</strong><small>Lessons, practice and reflection</small></span><ArrowRight aria-hidden="true" /></div>
          <div><span className="auth-feature-swatch auth-swatch-blue"><UsersRound aria-hidden="true" /></span><span><strong>One classroom, together</strong><small>Teacher and student spaces</small></span><ArrowRight aria-hidden="true" /></div>
        </div>
        <p className="auth-story-note">Open-source learning platform · Teacher-led · Built for understanding</p>
      </aside>
      <div className="auth-form-panel"><AuthForm mode={mode} /></div>
    </section>
  );
}

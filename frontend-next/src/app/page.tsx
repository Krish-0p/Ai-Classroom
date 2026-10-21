import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  Compass,
  GraduationCap,
  Network,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { currentActor } from "@/server/session";
import { messages as m } from "@/lib/messages";

const steps = [
  { number: "01", title: "Shape the course", description: "Bring your syllabus into one clear, connected curriculum.", icon: Compass, color: "sun" },
  { number: "02", title: "Teach with context", description: "Build lessons, practice and simple slides from your approved curriculum.", icon: BookOpenCheck, color: "coral" },
  { number: "03", title: "See understanding", description: "Give students useful feedback. Help teachers see where to go next.", icon: BrainCircuit, color: "mint" },
] as const;

export default async function HomePage() {
  if (await currentActor(await headers())) redirect("/dashboard");
  return (
    <div className="landing-page -mx-5 -mt-10 flex flex-col gap-24 px-5 pb-12 sm:gap-32 sm:pb-20">
      <section className="landing-hero relative mx-auto grid w-full max-w-6xl items-center gap-12 overflow-hidden rounded-[2rem] px-7 py-14 sm:px-12 sm:py-20 lg:min-h-[610px] lg:grid-cols-2 lg:gap-10 lg:px-16">
        <div className="relative z-10 flex flex-col items-start gap-7">
          <Badge className="landing-pill"><Sparkles data-icon="inline-start" /> A calmer way to learn together</Badge>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Good teaching deserves <span className="landing-underline">room to grow.</span>
          </h1>
          <p className="max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
            One thoughtful place for your curriculum, lessons, classroom questions and student progress. Built to keep teachers in control and learning connected.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className={buttonVariants({ size: "lg", className: "landing-primary" })} href="/register">
              Create your classroom <ArrowRight data-icon="inline-end" />
            </Link>
            <Link className={buttonVariants({ size: "lg", variant: "outline", className: "landing-secondary" })} href="/login">
              I already have an account
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><UsersRound aria-hidden="true" /> Made for teachers and students</span>
            <span className="flex items-center gap-2"><Network aria-hidden="true" /> Open source. Course-centered.</span>
          </div>
        </div>
        <div className="landing-art relative mx-auto aspect-square w-full max-w-[480px]" aria-label="Curriculum, lessons, practice and progress connected in one classroom" role="img">
          <div className="landing-orbit landing-orbit-one" />
          <div className="landing-orbit landing-orbit-two" />
          <div className="landing-note landing-note-curriculum"><span className="landing-icon landing-icon-blue"><Network aria-hidden="true" /></span><span><strong>Course map</strong><small>Ideas, connected</small></span><ArrowUpRight aria-hidden="true" /></div>
          <div className="landing-note landing-note-lesson"><span className="landing-icon landing-icon-mint"><BookOpenCheck aria-hidden="true" /></span><span><strong>Lesson studio</strong><small>Ready to teach</small></span><ArrowRight aria-hidden="true" /></div>
          <div className="landing-note landing-note-practice"><span className="landing-icon landing-icon-coral"><BrainCircuit aria-hidden="true" /></span><span><strong>Practice</strong><small>Feedback that helps</small></span><ArrowDownRight aria-hidden="true" /></div>
          <div className="landing-core"><div className="landing-core-mark"><GraduationCap aria-hidden="true" /></div><p>One class.<br /><strong>Many ways to grow.</strong></p><div className="landing-core-dots"><i /><i /><i /><i /></div></div>
          <span className="landing-spark landing-spark-one" aria-hidden="true">✳</span><span className="landing-spark landing-spark-two" aria-hidden="true">✦</span>
        </div>
      </section>

      <section className="landing-journey mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="landing-journey-intro"><Badge variant="outline" className="w-fit">Learning, with a little more intention</Badge><h2>From course plan to real understanding.</h2><p>A connected classroom helps good ideas make it from the syllabus to the moment a student understands.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">{steps.map(({ number, title, description, icon: Icon, color }) => <article className={`landing-step landing-step-${color}`} key={number}><div className="flex items-center justify-between"><span className="text-sm font-semibold tabular-nums">{number}</span><Icon aria-hidden="true" /></div><h3 className="mt-9 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></article>)}</div>
      </section>

      <section className="landing-bottom mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 rounded-[2rem] px-8 py-10 sm:flex-row sm:items-center sm:px-12 sm:py-12"><div className="flex max-w-2xl flex-col gap-3"><p className="text-sm font-semibold uppercase tracking-[0.15em]">A shared space for teaching and learning</p><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your next class can start here.</h2><p className="text-muted-foreground">Create a teacher account, or join your classroom with the code from your instructor.</p></div><Link className={buttonVariants({ size: "lg", className: "landing-primary shrink-0" })} href="/register">Get started <ArrowRight data-icon="inline-end" /></Link></section>
    </div>
  );
}

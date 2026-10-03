import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Lets a personal delete workout history of THEIR OWN students — one session,
// or everything — e.g. to clean up the test workouts done while setting up.
//
// Why a function and not a client-side delete: no table in the history chain
// (workout_sessions, workout_session_sets, workout_completions) has a DELETE
// policy, for anyone. Rather than opening a general delete permission in the
// database, the delete runs here with the service role, after proving the
// caller is a personal and that the student belongs to them.
//
// Deleting a workout_sessions row cascades to its workout_session_sets and
// session_personal_notes (FKs are ON DELETE CASCADE). workout_completions has
// no link to a session, so it is matched by student + workout + time (every
// finished session writes its completion within seconds of finished_at).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPLETION_WINDOW_MS = 5 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData?.user) {
      return json({ error: "Sessão inválida ou expirada. Saia e entre novamente." }, 401);
    }
    const callerId = userData.user.id;

    const { data: caller } = await supabase.from("users").select("role").eq("id", callerId).single();
    if (caller?.role !== "personal") {
      return json({ error: "Apenas o personal pode apagar o histórico de treinos." }, 403);
    }

    const { action, session_id, student_id } = await req.json();

    // Resolve + authorize the student first, whichever action this is.
    let studentId: string | null = null;
    let session: { id: string; student_id: string; workout_id: string | null; finished_at: string | null } | null = null;

    if (action === "delete_session") {
      if (!session_id || typeof session_id !== "string") return json({ error: "Sessão não informada." }, 400);
      const { data } = await supabase
        .from("workout_sessions")
        .select("id, student_id, workout_id, finished_at")
        .eq("id", session_id)
        .maybeSingle();
      if (!data) return json({ error: "Esse treino não foi encontrado." }, 404);
      session = data;
      studentId = data.student_id;
    } else if (action === "clear_all") {
      if (!student_id || typeof student_id !== "string") return json({ error: "Aluno não informado." }, 400);
      studentId = student_id;
    } else {
      return json({ error: "Ação inválida." }, 400);
    }

    const { data: student } = await supabase.from("users").select("id, personal_id").eq("id", studentId).maybeSingle();
    if (!student || student.personal_id !== callerId) {
      // Same answer as "not found" so this can't be used to probe other personals' students.
      return json({ error: "Aluno não encontrado." }, 404);
    }

    if (action === "delete_session" && session) {
      const { count: setCount } = await supabase
        .from("workout_session_sets")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);

      const { error: delError } = await supabase.from("workout_sessions").delete().eq("id", session.id);
      if (delError) {
        console.error("manage-student-history: delete_session falhou:", delError);
        return json({ error: "Não foi possível apagar esse treino agora." }, 500);
      }

      let completions = 0;
      if (session.finished_at && session.workout_id) {
        const t = new Date(session.finished_at).getTime();
        const { data: removed } = await supabase
          .from("workout_completions")
          .delete()
          .eq("student_id", session.student_id)
          .eq("workout_id", session.workout_id)
          .gte("completed_at", new Date(t - COMPLETION_WINDOW_MS).toISOString())
          .lte("completed_at", new Date(t + COMPLETION_WINDOW_MS).toISOString())
          .select("id");
        completions = removed?.length ?? 0;
      }
      return json({ ok: true, deleted_sessions: 1, deleted_sets: setCount ?? 0, deleted_completions: completions });
    }

    // clear_all
    const { count: sessionCount } = await supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId);
    const { data: sessionIds } = await supabase.from("workout_sessions").select("id").eq("student_id", studentId);
    let setCount = 0;
    if (sessionIds && sessionIds.length > 0) {
      const { count } = await supabase
        .from("workout_session_sets")
        .select("id", { count: "exact", head: true })
        .in("session_id", sessionIds.map((s: { id: string }) => s.id));
      setCount = count ?? 0;
    }

    const { error: delSessionsError } = await supabase.from("workout_sessions").delete().eq("student_id", studentId);
    if (delSessionsError) {
      console.error("manage-student-history: clear_all (sessões) falhou:", delSessionsError);
      return json({ error: "Não foi possível limpar o histórico agora." }, 500);
    }
    const { data: removedCompletions, error: delCompError } = await supabase
      .from("workout_completions")
      .delete()
      .eq("student_id", studentId)
      .select("id");
    if (delCompError) console.error("manage-student-history: clear_all (conclusões) falhou:", delCompError);

    return json({
      ok: true,
      deleted_sessions: sessionCount ?? 0,
      deleted_sets: setCount,
      deleted_completions: removedCompletions?.length ?? 0,
    });
  } catch (e) {
    console.error("manage-student-history: erro inesperado:", e);
    return json({ error: "Algo deu errado. Tenta de novo em instantes." }, 500);
  }
});

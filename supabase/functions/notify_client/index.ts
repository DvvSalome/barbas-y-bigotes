import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import webpush from "npm:web-push";
import { Resend } from "npm:resend";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

webpush.setVapidDetails(
  "mailto:soporte@barbasybigotes.com",
  vapidPublicKey,
  vapidPrivateKey
);

const resend = new Resend(resendApiKey);

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    try {
      const payload = await req.json();
      
      // Asegurarse de que sea un webhook de la tabla reservas
      if (payload.type !== "UPDATE" || payload.table !== "reservas") {
        return Response.json({ message: "Ignored" });
      }

      const { record, old_record } = payload;
      
      // Si el estado no cambió, ignorar
      if (record.estado === old_record.estado) {
        return Response.json({ message: "State unchanged" });
      }

      // Obtener el cliente asociado a la reserva
      const { data: cliente } = await ctx.supabaseAdmin
        .from("clientes")
        .select("id, nombre, auth_id")
        .eq("id", record.cliente_id)
        .single();
        
      if (!cliente) return Response.json({ message: "Client not found" });

      // Obtener el correo del cliente desde la tabla perfiles o auth
      const { data: profile } = await ctx.supabaseAdmin
        .from("profiles")
        .select("correo")
        .eq("auth_id", cliente.auth_id)
        .single();

      // Obtener las suscripciones web push del cliente
      const { data: subscriptions } = await ctx.supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("cliente_ref", cliente.id);

      let pushMessage = "";
      let emailSubject = "";
      let emailBody = "";

      if (record.estado === "confirmada") {
        pushMessage = "Tu cita ha sido confirmada.";
        emailSubject = "Cita Confirmada - Barbas & Bigotes";
        emailBody = `<p>Hola ${cliente.nombre}, tu cita para el ${record.fecha} ha sido confirmada.</p>`;
      } else if (record.estado === "en progreso") {
        pushMessage = "¡Es tu turno! El barbero te espera.";
        emailSubject = "Es tu turno - Barbas & Bigotes";
        emailBody = `<p>Hola ${cliente.nombre}, ¡es tu turno!</p>`;
      } else if (record.estado === "completada") {
        pushMessage = "Cita finalizada. ¡Gracias por preferirnos!";
        emailSubject = "Gracias por tu visita - Barbas & Bigotes";
        emailBody = `<p>Hola ${cliente.nombre}, esperamos que hayas disfrutado tu servicio.</p>`;
      }

      if (pushMessage && subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            }
          };
          try {
            await webpush.sendNotification(pushSubscription, JSON.stringify({
              title: "Barbas & Bigotes",
              body: pushMessage,
            }));
          } catch (err) {
            console.error("Error sending push to endpoint", sub.endpoint, err);
          }
        }
      }

      if (emailBody && profile?.correo && resendApiKey) {
        try {
          await resend.emails.send({
            from: "Barbas & Bigotes <notificaciones@resend.dev>",
            to: profile.correo,
            subject: emailSubject,
            html: emailBody,
          });
        } catch (err) {
          console.error("Error sending email", err);
        }
      }

      return Response.json({ message: "Notified successfully" });
    } catch (err: any) {
      console.error(err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }),
};

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client);

async function run() {
  // Tomar el primer usuario de la DB
  const users = await db.execute(sql.raw("SELECT id FROM users LIMIT 1"));
  const userId = (users.rows[0] as { id: string }).id;
  console.log("Usuario:", userId);

  // Insertar vacante de prueba
  const jobs = await db.execute(sql.raw(`
    INSERT INTO job_postings (
      created_by, title, slug, tagline, description, requirements,
      employment_type, status, is_public
    ) VALUES (
      '${userId}',
      'Head of Growth (Socio Operativo de Crecimiento)',
      'head-of-growth',
      'No busco un community manager. No busco alguien que publique por publicar. Busco a quien pueda hacer crecer un negocio de tecnología e IA.',
      'No busco un community manager.
No busco alguien que publique por publicar.
No busco alguien que espere instrucciones todos los días.

Busco a la persona que pueda ayudarme a crecer un negocio de tecnología, IA, automatización y productos digitales.

TU MISIÓN SERÁ SIMPLE:

• Conseguir clientes.
• Crear oportunidades de venta.
• Diseñar estrategias de crecimiento.
• Mejorar conversiones.
• Encontrar nuevos mercados.
• Medir resultados.
• Generar ingresos.

Lo único que me importa son los resultados.

No necesito títulos.
No necesito currículums bonitos.

Necesito evidencia.',
      '✓ Conseguir clientes para agencias o negocios digitales
✓ Escalar proyectos digitales desde cero
✓ Crear embudos de venta que funcionan
✓ Cerrar alianzas estratégicas
✓ Generar leads de calidad
✓ Lanzar campañas que convierten',
      'commission',
      'open',
      true
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `));

  const jobId = (jobs.rows[0] as { id: string })?.id;
  if (!jobId) {
    console.log("✅ El posting ya existía (slug duplicado)");
    return;
  }

  console.log("✅ Job posting creado:", jobId);

  // Insertar preguntas
  await db.execute(sql.raw(`
    INSERT INTO job_questions (job_id, question, type, is_required, sort_order, hint) VALUES
    ('${jobId}', '¿Cuál es el proyecto que más has ayudado a crecer?', 'textarea', true, 0,
     'Incluye: nombre del proyecto, qué vendía, qué hiciste exactamente y los resultados obtenidos con números reales.'),
    ('${jobId}', '¿Qué métricas mejoraste exactamente?', 'multiselect', true, 1, NULL),
    ('${jobId}', 'Si mañana te entrego una agencia de IA y automatización con pocos clientes, ¿cuáles serían las primeras 10 acciones que realizarías durante los próximos 30 días?', 'textarea', true, 2,
     'Aquí verás quién piensa estratégicamente.'),
    ('${jobId}', '¿Qué herramientas utilizas actualmente?', 'multiselect', true, 3, NULL),
    ('${jobId}', 'Comparte 3 campañas que hayas ejecutado personalmente', 'textarea', true, 4,
     'Con enlaces si es posible.'),
    ('${jobId}', '¿Qué libros, creadores o referentes influyen más en tu forma de crecer negocios?', 'textarea', true, 5,
     'Aquí se detecta curiosidad intelectual y nivel de formación real.'),
    ('${jobId}', '¿Cuál fue tu fracaso más grande intentando crecer un negocio y qué aprendiste?', 'textarea', true, 6,
     'Excelente detector de madurez y capacidad de aprendizaje.'),
    ('${jobId}', '¿Qué harías si tu presupuesto de marketing fuera $0 durante los próximos 30 días?', 'textarea', true, 7,
     'Esta pregunta es oro para startups y negocios en etapa temprana.'),
    ('${jobId}', '¿Qué prefieres?', 'choice', true, 8, 'Los buenos growth suelen elegir experimentar.'),
    ('${jobId}', 'Graba un video de máximo 3 minutos explicando cómo harías crecer mi negocio', 'video', true, 9,
     'Aquí eliminas inmediatamente al 80% de los candidatos.'),
    ('${jobId}', '¿Qué esquema de compensación prefieres?', 'choice', false, 10, NULL)
  `));

  // Actualizar opciones de las preguntas multiselect y choice
  await db.execute(sql.raw(`
    UPDATE job_questions SET options = ARRAY['Leads','Ventas','Conversión','Ticket promedio','Retención','ROI']
    WHERE job_id = '${jobId}' AND sort_order = 1
  `));

  await db.execute(sql.raw(`
    UPDATE job_questions SET options = ARRAY['Meta Ads','Google Ads','HubSpot','GoHighLevel','Notion','Airtable','CRM propio','Automatización / Make / n8n','IA','Email Marketing']
    WHERE job_id = '${jobId}' AND sort_order = 3
  `));

  await db.execute(sql.raw(`
    UPDATE job_questions SET options = ARRAY['Tener razón','Probar hipótesis']
    WHERE job_id = '${jobId}' AND sort_order = 8
  `));

  await db.execute(sql.raw(`
    UPDATE job_questions SET options = ARRAY['Sueldo fijo','Esquema mixto (base + comisión)','Porcentaje sobre resultados']
    WHERE job_id = '${jobId}' AND sort_order = 10
  `));

  console.log("✅ 11 preguntas creadas");
  console.log("\n🎉 Listo. Visita: http://localhost:3000/jobs/head-of-growth");
}

run().catch(e => {
  console.error("❌", e.message);
  process.exit(1);
});

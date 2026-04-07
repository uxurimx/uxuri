/**
 * seed-s8root.ts — Crea el proyecto "Root S8+" en uxuri con tareas, objetivos y contexto.
 *
 * Uso:
 *   npx tsx scripts/seed-s8root.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

try { process.loadEnvFile(".env.local"); } catch {}

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function main() {
  console.log("🤖 Creando proyecto Root S8+ en uxuri...\n");

  // ── 1. PROYECTO ──────────────────────────────────────────────────────────────
  const [project] = await db
    .insert(schema.projects)
    .values({
      name: "Root S8+",
      description:
        "Samsung Galaxy S8+ (SM-G955F) — Exynos 8895, Android 9, variante México. Convertir el teléfono en nodo Linux del ecosistema roBit: root, custom ROM, integración de sensores, SSH permanente.",
      status: "active",
      priority: "high",
      range: "short",
      category: "hardware",
    })
    .returning();

  console.log(`✅ Proyecto creado: ${project.id}`);

  // ── 2. CONTEXTO DEL PROYECTO ─────────────────────────────────────────────────
  const contextContent = `## Dispositivo
- Modelo: SM-G955F (Galaxy S8+, NO S8)
- Chipset: Samsung Exynos 8895 (octa-core ARM64)
- RAM: 3.7 GB
- Storage /data: 54 GB total / 6 GB libres ⚠️
- Android: 9 Pie (SDK 28) — último oficial Samsung
- Bootloader: G955FXXUCDVH3
- Variante: Internacional/México (XX = open market) — ideal para root
- Estado: Stock, sin root (user/release-keys)
- ADB: Conectado vía USB desde laptop Fedora 43

## Herramientas disponibles en laptop
- adb 1.0.41 ✓
- fastboot 35.0.2 ✓
- heimdall ✓ (Samsung-specific flasher)
- scrcpy: NO instalado (pendiente: sudo dnf install scrcpy)

## Proyecto en roBit
- Directorio: /home/dev/Projects/roBit/s8root/
- Objetivo: integrar S8+ como nodo de sensores/cómputo del ecosistema

## Advertencias
- Unlock bootloader TRIPS KNOX permanentemente (0x1) — irreversible
- El unlock BORRA TODOS LOS DATOS del teléfono
- Garantía queda nula tras unlock
- 6GB libres es poco — limpiar antes de instalar TWRP + ROM`;

  await db.insert(schema.contextEntries).values({
    entityType: "project",
    entityId: project.id,
    content: contextContent,
    userName: "Claude",
  });
  console.log("✅ Contexto del proyecto guardado");

  // ── 3. OBJETIVOS (FASES) ─────────────────────────────────────────────────────

  // Fase 0 — Pre-root
  const [obj0] = await db
    .insert(schema.objectives)
    .values({
      title: "Fase 0 — Pre-root (ADB + Termux)",
      description:
        "Exprimir el S8+ sin root: ADB wireless, eliminar bloatware, instalar Termux+SSH, backup completo. Base obligatoria antes de tocar el bootloader.",
      status: "active",
      priority: "high",
      horizon: "weekly",
      targetDate: "2026-04-13",
      pinnedToDashboard: true,
    })
    .returning();

  await db.insert(schema.objectiveMilestones).values([
    { objectiveId: obj0.id, title: "Liberar espacio (objetivo: >15 GB libres)", sortOrder: 0 },
    { objectiveId: obj0.id, title: "Desinstalar bloatware Samsung via ADB", sortOrder: 1 },
    { objectiveId: obj0.id, title: "Activar ADB wireless (adb tcpip 5555)", sortOrder: 2 },
    { objectiveId: obj0.id, title: "Instalar scrcpy en laptop", sortOrder: 3 },
    { objectiveId: obj0.id, title: "Instalar Termux desde F-Droid", sortOrder: 4 },
    { objectiveId: obj0.id, title: "Configurar SSH server en Termux", sortOrder: 5 },
    { objectiveId: obj0.id, title: "Instalar Termux:API", sortOrder: 6 },
    { objectiveId: obj0.id, title: "Backup completo pre-root", sortOrder: 7 },
  ]);
  console.log(`✅ Objetivo 'Fase 0' creado con milestones`);

  // Fase 1 — Root
  const [obj1] = await db
    .insert(schema.objectives)
    .values({
      title: "Fase 1 — Root (TWRP + Magisk)",
      description:
        "Proceso de root: OEM unlock → Download Mode → Heimdall flash TWRP → Magisk ZIP. O patched boot.img method si se prefiere evitar TWRP.",
      status: "draft",
      priority: "high",
      horizon: "weekly",
      targetDate: "2026-04-20",
    })
    .returning();

  await db.insert(schema.objectiveMilestones).values([
    { objectiveId: obj1.id, title: "Activar OEM Unlock en Opciones de desarrollador", sortOrder: 0 },
    { objectiveId: obj1.id, title: "Descargar TWRP para dream2lte (G955F)", sortOrder: 1 },
    { objectiveId: obj1.id, title: "Descargar Magisk APK + ZIP", sortOrder: 2 },
    { objectiveId: obj1.id, title: "Bootear Download Mode y flashear TWRP via Heimdall", sortOrder: 3 },
    { objectiveId: obj1.id, title: "Flashear Magisk desde TWRP", sortOrder: 4 },
    { objectiveId: obj1.id, title: "Verificar root: adb shell su -c id", sortOrder: 5 },
    { objectiveId: obj1.id, title: "Configurar MagiskHide para apps bancarias", sortOrder: 6 },
  ]);
  console.log(`✅ Objetivo 'Fase 1' creado con milestones`);

  // Fase 2 — Post-root
  const [obj2] = await db
    .insert(schema.objectives)
    .values({
      title: "Fase 2 — Post-root (Custom ROM + Linux)",
      description:
        "Opcional: LineageOS 20 (Android 13) para dream2lte. Linux completo via proot-distro Ubuntu o Linux Deploy. SSH server permanente al boot.",
      status: "draft",
      priority: "medium",
      horizon: "monthly",
      targetDate: "2026-05-04",
    })
    .returning();

  await db.insert(schema.objectiveMilestones).values([
    { objectiveId: obj2.id, title: "Evaluar: Magisk en stock vs LineageOS 20", sortOrder: 0 },
    { objectiveId: obj2.id, title: "Si LineageOS: descargar ROM + GApps para dream2lte", sortOrder: 1 },
    { objectiveId: obj2.id, title: "Instalar proot-distro ubuntu en Termux", sortOrder: 2 },
    { objectiveId: obj2.id, title: "Configurar SSH server permanente al boot", sortOrder: 3 },
    { objectiveId: obj2.id, title: "Instalar Python + herramientas dev en Ubuntu ARM64", sortOrder: 4 },
    { objectiveId: obj2.id, title: "Verificar acceso root completo al filesystem", sortOrder: 5 },
  ]);
  console.log(`✅ Objetivo 'Fase 2' creado con milestones`);

  // Fase 3 — Integración roBit
  const [obj3] = await db
    .insert(schema.objectives)
    .values({
      title: "Fase 3 — Integración ecosistema roBit",
      description:
        "Conectar S8+ como nodo del ecosistema: sensor_server.py (GPS, acelerómetro, cámara, BLE) → laptop. Cliente Ollama. Integración con audifonospro.",
      status: "draft",
      priority: "medium",
      horizon: "monthly",
      targetDate: "2026-05-18",
    })
    .returning();

  await db.insert(schema.objectiveMilestones).values([
    { objectiveId: obj3.id, title: "Escribir sensor_server.py (Termux:API → HTTP endpoint)", sortOrder: 0 },
    { objectiveId: obj3.id, title: "Escribir robit_node.py (cliente en laptop)", sortOrder: 1 },
    { objectiveId: obj3.id, title: "GPS logger con cron job en Termux", sortOrder: 2 },
    { objectiveId: obj3.id, title: "BLE scanner → feed a audifonospro", sortOrder: 3 },
    { objectiveId: obj3.id, title: "Cliente Ollama: S8+ → laptop:11434", sortOrder: 4 },
    { objectiveId: obj3.id, title: "OTG: probar Arduino via USB OTG", sortOrder: 5 },
  ]);
  console.log(`✅ Objetivo 'Fase 3' creado con milestones`);

  // ── 4. TAREAS DEL PROYECTO ────────────────────────────────────────────────────
  const tasks = [
    // Fase 0
    {
      title: "Analizar espacio en disco del S8+",
      description: "adb shell df -h y adb shell du -sh /sdcard/* — identificar qué ocupa espacio. Objetivo: liberar ≥15 GB antes del root.",
      status: "todo" as const,
      priority: "urgent" as const,
      projectId: project.id,
      sortOrder: 0,
    },
    {
      title: "Crear script debloat.sh para Samsung S8+",
      description: "Lista curada de paquetes Samsung/Google a desinstalar via adb pm uninstall -k --user 0. Incluir: Bixby, Samsung Pay, Game Launcher, Facebook, etc.",
      status: "todo" as const,
      priority: "high" as const,
      projectId: project.id,
      sortOrder: 1,
    },
    {
      title: "Configurar ADB wireless",
      description: "Script adb_wireless.sh: detecta IP del teléfono → adb tcpip 5555 → adb connect. Cortar cable USB.",
      status: "todo" as const,
      priority: "high" as const,
      projectId: project.id,
      sortOrder: 2,
    },
    {
      title: "Instalar scrcpy en laptop Fedora",
      description: "sudo dnf install scrcpy — control remoto de pantalla del S8+ desde la laptop.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 3,
    },
    {
      title: "Instalar Termux desde F-Droid",
      description: "Importante: instalar SOLO desde F-Droid, no Play Store (versión Play está abandonada). Configurar bootstrap: pkg update && pkg upgrade.",
      status: "todo" as const,
      priority: "high" as const,
      projectId: project.id,
      sortOrder: 4,
    },
    {
      title: "Configurar SSH server en Termux",
      description: "pkg install openssh → sshd → copiar clave pública desde laptop. Probar: ssh localhost -p 8022 desde la laptop.",
      status: "todo" as const,
      priority: "high" as const,
      projectId: project.id,
      sortOrder: 5,
    },
    {
      title: "Instalar y configurar Termux:API",
      description: "Instalar app Termux:API desde F-Droid + pkg install termux-api. Probar: termux-location, termux-battery-status, termux-sensor.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 6,
    },
    {
      title: "Backup completo pre-root",
      description: "Script backup.sh: adb pull /sdcard/ + adb backup -apk -all. Guardar en /home/dev/Projects/roBit/s8root/backup/",
      status: "todo" as const,
      priority: "urgent" as const,
      projectId: project.id,
      sortOrder: 7,
    },
    // Fase 1
    {
      title: "Investigar TWRP versión correcta para G955FXXUCDVH3",
      description: "Verificar TWRP compatible con bootloader G955FXXUCDVH3 Android 9. Device codename: dream2lte. Fuentes: twrp.me, XDA Developers.",
      status: "todo" as const,
      priority: "high" as const,
      projectId: project.id,
      sortOrder: 8,
    },
    {
      title: "Documentar proceso root paso a paso",
      description: "Crear root/root_procedure.md con pasos exactos: Download Mode → heimdall flash → Recovery Mode → Magisk install → verify.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 9,
    },
    {
      title: "Ejecutar proceso de root",
      description: "SOLO después de: backup completo ✓, TWRP verificado ✓, 70%+ batería ✓. Pasos: OEM unlock → TWRP → Magisk.",
      status: "todo" as const,
      priority: "high" as const,
      projectId: project.id,
      sortOrder: 10,
    },
    // Fase 2
    {
      title: "Evaluar LineageOS 20 vs stock + Magisk",
      description: "Comparar: LineageOS 20 (Android 13, actualizaciones de seguridad) vs stock Samsung Android 9 + Magisk. Considerar: compatibilidad de apps, Knox, Samsung Pay.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 11,
    },
    {
      title: "Instalar Linux (proot-distro Ubuntu) en Termux",
      description: "Con o sin root: pkg install proot-distro && proot-distro install ubuntu. Configurar SSH interno, Python dev environment.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 12,
    },
    // Fase 3
    {
      title: "Escribir sensor_server.py para S8+",
      description: "Flask HTTP server en Termux que expone: /gps, /battery, /sensors, /camera. Usa Termux:API CLI commands. Puerto 8765.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 13,
    },
    {
      title: "Escribir robit_node.py para laptop",
      description: "Cliente en /home/dev/Projects/roBit/s8root/integration/ que conecta al sensor_server.py del teléfono y alimenta el ecosistema roBit.",
      status: "todo" as const,
      priority: "medium" as const,
      projectId: project.id,
      sortOrder: 14,
    },
  ];

  for (const task of tasks) {
    await db.insert(schema.tasks).values(task);
  }
  console.log(`✅ ${tasks.length} tareas creadas`);

  // ── RESUMEN ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════╗
║          Root S8+ — Guardado en uxuri            ║
╠══════════════════════════════════════════════════╣
║  Proyecto ID : ${project.id.slice(0, 8)}...
║  Tareas      : ${tasks.length}
║  Objetivos   : 4 (Fases 0→3)
║  Milestones  : 8 + 7 + 6 + 6 = 27
║  Contexto    : 1 entrada (specs + advertencias)
╚══════════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});

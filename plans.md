 Plan Unificado: Módulo Marketing Uxuri + Sistema mkt                                                                                     
                                                                                                                                           
  Diagnóstico de la situación actual                                                                                                       
                                                                                                                                           
  El sistema mkt ya hace:                                                                                                                  
  - Scraping Google Maps + Instagram (Playwright, sin API)                                                                                 
  - Envío masivo por WhatsApp Web automatizado                                                                                             
  - Seguimiento de status por lead: nuevo → contactado → interesado → cerrado                                                              
  - A/B testing de copies (template_used)                                                                                                  
  - Generación de copies con OpenAI (AIDA, PAS, FOMO, Social Proof)                                                                        
  - Follow-ups automáticos por días sin respuesta                                                                                          
  - Score 1-10 por lead (rating, web propia, teléfono, email, WhatsApp)                                                                    
  - Monitor de respuestas automáticas                                                                                                      
                                                                                                                                           
  El problema central:                                                                                                                     
  SQLite local → solo 1 trabajador ve los datos                                                                                            
  No hay concepto de "estrategia" ni "campaña" → todo mezclado
  No hay historial de qué copy se envió a qué nicho qué día                                                                                
  No hay visibilidad para el equipo/dueño del negocio      
                                                                                                                                           
  Lo que se necesita:                                                                                                                      
  SQLite → Neon PostgreSQL (compartido, todos los workers)                                                                                 
  Desktop solo → Web app para visibilidad del equipo                                                                                       
  Datos sueltos → Estructura: Estrategia → Campaña → Copy → Lead → Interacción                                                             
                  
  ---                                                                                                                                      
  Arquitectura de Integración
                                                                                                                                           
  ┌─────────────────────────────────────────────────────────────┐
  │  Python Desktop App (mkt)                                   │                                                                          
  │  Playwright: scraping Google Maps + Instagram               │
  │  Playwright: WhatsApp Web automation                        │                                                                          
  │  ↓ HTTP requests con API Key                                │                                                                          
  ├─────────────────────────────────────────────────────────────┤                                                                          
  │  Next.js API Routes (/api/mkt/*)                            │                                                                          
  │  Auth por X-API-Key header (sin Clerk, para workers)        │
  │  ↓ Drizzle ORM                                              │                                                                          
  ├─────────────────────────────────────────────────────────────┤
  │  Neon PostgreSQL (DB compartida)                            │                                                                          
  │  Misma DB que Uxuri → trabajadores, clientes, proyectos     │                                                                          
  │  ↑ también leen/escriben                                    │                                                                          
  ├─────────────────────────────────────────────────────────────┤                                                                          
  │  Uxuri Web App (dashboard para dueño/manager)               │                                                                          
  │  Estrategias, campañas, copies, leads, analytics            │                                                                          
  │  Tiempo real con Pusher (actividad de workers)              │                                                                          
  └─────────────────────────────────────────────────────────────┘                                                                          
                                                                                                                                           
  Por qué REST API y no conexión directa a Neon desde Python:                                                                              
  - Las credenciales de Neon no viajan en el ejecutable/desktop de los workers                                                             
  - Se puede revocar acceso a un worker sin tocar la DB                                                                                    
  - Logging centralizado de toda actividad             
  - Misma API puede usarla WhatsApp Web, email, o cualquier canal futuro                                                                   
                                                                                                                                           
  ---                                                                                                                                      
  Nuevo Schema de DB                                                                                                                       
                                                                                                                                           
  mkt_strategies — El "qué vendo + a quién"
                                                                                                                                           
  id, title, description
  productOffered     -- "Página web", "Sistema personalizado", "App móvil"                                                                 
  targetNiche        -- "dentistas", "doctores", "abogados"                                                                                
  targetCity         -- "CDMX", "Monterrey"                                                                                                
  targetCountry      -- "México"                                                                                                           
  channel            -- whatsapp | email | ig_dm | whatsapp+email                                                                          
  status             -- draft | active | paused | completed
  notes (text)                                                                                                                             
  createdBy → users
                                                                                                                                           
  mkt_campaigns — Una ejecución específica (puede variar por día, copy, worker)                                                            
   
  id, strategyId FK, title                                                                                                                 
  copyId FK          -- qué copy usar
  scheduledAt        -- cuándo enviar                                                                                                      
  assignedTo → users -- qué worker ejecuta
  status             -- draft | queued | running | completed | paused | failed                                                             
  totalLeads, contacted, responded, interested, converted (int)                                                                            
  notes, createdBy → users
                                                                                                                                           
  mkt_copies — Biblioteca de textos                                                                                                        
   
  id, title, content (template con {nombre},{ciudad},{nicho},{plataforma})                                                                 
  type               -- whatsapp_msg | email_subject | email_body | ig_dm | script | cta
  status             -- draft | review | approved | active | archived                                                                      
  abVariant          -- A | B | C
  version, parentId FK (para variantes A/B)                                                                                                
  framework          -- AIDA | PAS | social_proof | FOMO | custom
  tone               -- amigable | profesional | urgente | empático                                                                        
  campaignId FK (opcional), createdBy → users
                                                                                                                                           
  mkt_leads — Migrado de SQLite + extendido
                                                                                                                                           
  -- Campos existentes del SQLite (migración 1:1):
  id, name, category, niche, city, country                                                                                                 
  phone, email, website, menuUrl, address, query
  rating, reviews, webSource, hasWhatsapp, score                                                                                           
  socialFb, socialIg, socialData (jsonb)
  status             -- nuevo/pendiente/contactado/interesado/no responde/sin whatsapp/descartado/cerrado                                  
  -- NUEVO - vinculación:                                                                                                                  
  strategyId FK, campaignId FK                                                                                                             
  copyId FK          -- qué copy se le envió                                                                                               
  contactedBy → users, contactedAt                                                                                                         
  -- NUEVO - follow-up:                                                                                                                    
  followupStep (int), nextFollowup (timestamp), templateUsed
  -- NUEVO - conversión:                                                                                                                   
  convertedToClientId → clients (nullable)                                                                                                 
  convertedAt
  -- Meta:                                                                                                                                 
  assignedTo → users, scrapedBy → users, scrapedAt
  createdAt, updatedAt                                                                                                                     
   
  mkt_interactions — Log de cada evento                                                                                                    
                  
  id, leadId FK                                                                                                                            
  type               -- scraped | sent | replied | followup_sent | followup_replied
                     -- interested | not_interested | call | meeting | converted | lost                                                    
  message (text, opcional — el mensaje real enviado o respuesta recibida)
  copyId FK, campaignId FK                                                                                                                 
  workerId → users
  createdAt                                                                                                                                
                                                                                                                                           
  ---
  Endpoints API Bridge (para Python app)                                                                                                   
                  
  POST  /api/mkt/leads/sync          → bulk upsert leads scrapeados (JSON array)
  GET   /api/mkt/leads               → query con filtros (niche, city, status, campaignId)                                                 
  PATCH /api/mkt/leads/[id]          → actualizar status, nota, copyId, contactedAt                                                        
  POST  /api/mkt/interactions        → registrar evento (sent, replied, etc.)                                                              
                                                                                                                                           
  GET   /api/mkt/campaigns/active    → campañas activas con su copy asignado                                                               
  GET   /api/mkt/copies/[id]         → obtener copy completo                                                                               
  GET   /api/mkt/leads/followups     → leads candidatos a follow-up (> N días sin respuesta)                                               
                                                                                                                                           
  Auth: X-API-Key: {clave} en headers — generada en Uxuri Settings, almacenada en ~/.lead_manager_v2.json                                  
                                                                                                                                           
  ---                                                                                                                                      
  UI en Uxuri — Páginas del Módulo
                                                                                                                                           
  /marketing                         → Dashboard: KPIs globales, actividad reciente
  /marketing/strategies              → Lista de estrategias                                                                                
  /marketing/strategies/[id]         → Detalle: copies, campañas, métricas
  /marketing/campaigns               → Lista de campañas (filtros: status, worker, estrategia)                                             
  /marketing/campaigns/[id]          → Detalle: leads, progreso, interacciones                                                             
  /marketing/copies                  → Biblioteca + editor + comparador A/B                                                                
  /marketing/leads                   → Tabla global con filtros avanzados                                                                  
  /marketing/leads/[id]              → Perfil del lead + timeline de interacciones                                                         
                                                                                                                                           
  ---                                                                                                                                      
  Plan de Fases   
                                                                                                                                           
  Fase 1 — Fundación DB + API Bridge (lo más urgente)
                                                                                                                                           
  Objetivo: La Python app puede ya enviar/recibir datos a Neon desde hoy                                                                   
                                                                                                                                           
  Pasos:                                                                                                                                   
  1. Crear schemas Drizzle (mkt_strategies, mkt_campaigns, mkt_copies, mkt_leads, mkt_interactions)
  2. npm run db:push                                                                                                                       
  3. Crear /api/mkt/* endpoints con auth por API Key
  4. Agregar /marketing al sidebar (página básica mientras)                                                                                
  5. Script de migración SQLite → Neon (one-shot para los datos históricos)                                                                
                                                                                                                                           
  Fase 2 — Estrategias + Copies en Uxuri                                                                                                   
                                                                                                                                           
  Objetivo: Dueño crea estrategias y copies desde el navegador, workers las usan                                                           
                  
  - Página /marketing/strategies — crear/editar estrategias (nicho + ciudad + producto)                                                    
  - Página /marketing/copies — biblioteca: editor con preview, aprobación, A/B variants
  - Asignación copy → campaña → worker                                                                                                     
                  
  Fase 3 — Leads Dashboard                                                                                                                 
                  
  Objetivo: Ver en tiempo real qué está pasando con todos los leads                                                                        
                  
  - Tabla /marketing/leads — filtros por nicho, ciudad, status, campaña, worker, fecha                                                     
  - Lead detail con timeline de interacciones
  - Botón "Convertir a cliente" → crea en tabla clients                                                                                    
  - Pusher: evento en tiempo real cuando worker envía mensaje                                                                              
                                                                                                                                           
  Fase 4 — Modificar Python App para usar Neon                                                                                             
                                                                                                                                           
  Objetivo: Reemplazar SQLite por llamadas a la API de Uxuri                                                                               
                  
  - Agregar MKT_API_URL + MKT_API_KEY a settings                                                                                           
  - Reemplazar get_conn() + queries SQLite por requests.post/get/patch a la API
  - Agregar UI en Python app para seleccionar campaña activa antes de enviar                                                               
  - El app jala el copy de la campaña, no escribe copy manualmente                                                                         
                                                                                                                                           
  Fase 5 — Analytics + Mejora Continua                                                                                                     
                                                                                                                                           
  Objetivo: Saber qué funciona y escalar lo que da resultados                                                                              
                  
  - Dashboard: tasa de respuesta por nicho / ciudad / día de semana / copy                                                                 
  - Comparador A/B: copy A vs B en misma estrategia
  - ROI si hay precio de producto definido                                                                                                 
  - "Mejor horario para dentistas en CDMX" (basado en historial real)                                                                      
  - Export CSV / reporte semanal automático                                                                                                
                                                                                                                                           
  ---                                                                                                                                      
  Flujo de Trabajo Unificado (cómo usará esto el equipo)                                                                                   
                                                                                                                                           
  Dueño en Uxuri:
    1. Crea Estrategia: "Páginas web para dentistas CDMX"                                                                                  
    2. Crea Copy A y Copy B (con variables {nombre}, {nicho})                                                                              
    3. Crea Campaña: Estrategia + Copy A + Worker Juan + Lunes mañana                                                                      
    4. Genera API Key para Juan                                                                                                            
                                                                                                                                           
  Worker (Juan) en Desktop App:                                                                                                            
    5. Abre mkt app → se conecta a Neon vía API                                                                                            
    6. Selecciona "Campaña activa: Dentistas CDMX - Lunes"                                                                                 
    7. App raspa Google Maps → sube leads a Neon automáticamente                                                                           
    8. App jala el copy de la campaña                                                                                                      
    9. Envío masivo WhatsApp → cada interacción se registra en Neon                                                                        
                                                                                                                                           
  Dueño en Uxuri (tiempo real):                                                                                                            
    10. Ve el dashboard: 47 enviados, 8 respondieron, 3 interesados                                                                        
    11. Ve quién respondió y qué dijo                                                                                                      
    12. Convierte lead interesado → Cliente en el sistema                                                                                  
    13. Al final de semana: retrospectiva de qué copy/nicho/día funcionó mejor   




    ---- Fase 1

     Script de migración                                                                                                                      
                                                                                                                                           
  # 1. Instalar dep                                         
  npm install better-sqlite3 @types/better-sqlite3 --save-dev                                                                              
   
  # 2. Correr migración                                                                                                                    
  npx tsx scripts/migrate-mkt-leads.ts                      
  # o con ruta custom:                                                                                                                     
  npx tsx scripts/migrate-mkt-leads.ts /ruta/a/leads.db
                                                                                                                                           
  Próximo paso inmediato                                                                                                                   
                                                                                                                                           
  Agrega en .env.local:                                                                                                                    
  MKT_API_KEY=$(openssl rand -hex 32)

  fase 2 -----
  
    

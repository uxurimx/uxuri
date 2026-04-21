---                                                                                                                    
  Flujo actual de agentes (cómo funciona hoy)                                                                            
                                                                                                                         
  Arquitectura                                                                                                           
                                                                                                                         
  [Usuario en web] ←→ [Uxuri DB + Pusher] ←→ [MCP Server] ←→ [Claude Code CLI]                                           
                                                                                                                         
  Tablas relevantes:                                                                                                     
  - agents — configuración del agente (modelo IA, prompt, personalidad, knowledge base)                                  
  - tasks.agentId + tasks.agentStatus — qué agente tiene la tarea y en qué estado                                        
  - agent_messages — canal de chat directo usuario ↔ agente por tarea                                                    
  - agent_sessions — cronómetro de trabajo (play/pause/stop)                                                             
  - agent_knowledge — base de conocimiento RAG por agente                                                                
  - task_comments — comentarios donde se puede @mencionar un agente                                                      
                                                                                                                         
  Flujo de una tarea:                                                                                                    
                                                                                                                         
  1. Usuario crea tarea y elige agente → agentId se guarda, agentStatus=null                                             
  2. En el panel del agente, usuario hace clic "Enviar al agente" → agentStatus='queued'                                 
  3. Claude Code (MCP) ejecuta get_queued_tasks() y ve la tarea                                                          
  4. Agente llama set_agent_status(taskId, 'analyzing') → UI muestra badge en tiempo real vía Pusher                     
  5. Agente llama get_task_details(taskId) → recibe título, descripción, comentarios, proyecto                           
  6. Trabaja: set_agent_status(taskId, 'working') + envía mensajes con send_message()                                    
  7. Termina: mark_task_done(taskId, summary) → notifica al creador vía private-user-{id}                                
                                                                                                                         
  El MCP es correcto: sí, es el mcp-server.ts en la raíz del proyecto, conectado con /mcp add uxuri -- npx tsx           
  /home/dev/Projects/uxuri/mcp-server.ts.                                                                                
                                                                                                                         
  ---             
  Problema actual vs objetivo
                             
  ┌───────────────────────────────────────────┬────────────────────────────────────────────────────────────────────┐
  │                    Hoy                    │                              Objetivo                              │     
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Agentes son privados por usuario          │ Agentes globales del sistema (ej. "Developer")                     │     
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ El agente solo puede enviar mensajes      │ El agente hace cambios reales en código                            │     
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤     
  │ No hay vínculo proyecto uxuri ↔ ruta real │ "Control Diesel" en uxuri sabe que es /Projects/tekton/Projects/WB │     
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤     
  │ El agente no sabe qué archivos tocar      │ El agente recibe contexto del repo y ejecuta git                   │
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤     
  │ Notificaciones básicas                    │ Notificación de "completado + commit URL" al que asignó            │
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤     
  │ No hay vista de agentes por proyecto      │ Tab de agentes dentro del proyecto                                 │
  └───────────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘     
                  
  ---                                                                                                                    
  Plan completo   
               
  Fase 1 — Agentes globales + vínculo código-proyecto
                                                                                                                         
  1a. agents.isGlobal boolean                                                                                            
  - Si true, visible para todos los usuarios (no solo el creador)                                                        
  - El agente "Developer" se marca global                                                                                
  - GET /api/agents ya retorna globales + propios
                                                                                                                         
  1b. projects.linkedCodePath varchar                                                                                    
  - Cada proyecto en uxuri puede tener una ruta real: /home/dev/Projects/tekton/Projects/WB                              
  - También: linkedRepo (git remote), techStack (notas del stack para contexto al agente)                                
  - UI: campo en configuración del proyecto                                                                              
                                                                                                                         
  1c. agent_project_assignments tabla                                                                                    
  - Vincula agentes a proyectos específicos con notas de contexto (ej. "solo modifica src/app/dashboard")                
  - Esto evita que el agente modifique todo el repo                                                                      
                  
  ---                                                                                                                    
  Fase 2 — Tab "Agentes" en el proyecto
                                                                                                                         
  Dentro de /projects/[id] agregar tab nuevo:
                                                                                                                         
  [Tareas] [Finanzas] [Contexto] [Chat] → [Agentes] ←nuevo                                                               
                                                                                                                         
  Contenido:                                                                                                             
  - Lista de agentes asignados al proyecto (con su contexto/scope)                                                       
  - Tareas en cola/activas de esos agentes para este proyecto                                                            
  - Botón rápido "Nueva tarea para agente"                   
  - Chat directo con el agente del proyecto (para que colaboradores hagan preguntas)                                     
                                                                                                                         
  ---                                                                                                                    
  Fase 3 — MCP con ejecución real de código                                                                              
                                                                                                                         
  Nuevas herramientas MCP:
                                                                                                                         
  get_project_config(projectId)                                                                                          
  // Retorna: linkedCodePath, linkedRepo, techStack, assignedScope
  // Claude Code sabe a qué directorio ir y qué archivos tocar                                                           
                                                                                                                         
  execute_code_task(taskId, {
    files_changed: ["src/app/page.tsx"],                                                                                 
    commit_message: "feat: cambiar opción X según tarea #123",                                                           
    branch: "main"  // o crear feature branch                                                                            
  })                                                                                                                     
  // Hace git add, commit, push y guarda el commit hash en la tarea                                                      
                                                                                                                         
  El agente autónomo en Claude Code haría:                                                                               
  1. get_queued_tasks() → ve tarea del proyecto WB                                                                       
  2. get_project_config(projectId) → recibe linkedCodePath: "/home/dev/Projects/tekton/Projects/WB"                      
  3. Lee archivos con sus herramientas nativas (Read, Grep)                                        
  4. Edita código (Edit, Write)                                                                                          
  5. Ejecuta git add && git commit && git push con Bash                                                                  
  6. mark_task_done(taskId, summary, commitUrl) → notifica con enlace al commit                                          
                                                                                                                         
  ---                                                                                                                    
  Fase 4 — Notificaciones enriquecidas                                                                                   
                                                                                                                         
  - Cuando mark_task_done incluye commitHash, la notificación muestra enlace al commit
  - El usuario que asignó la tarea recibe notificación push vía private-user-{id} (ya existe el canal)                   
  - En el task detail panel, el activity log muestra el commit como link clickeable                                      
  - tasks.commitHash varchar(40) nuevo campo opcional                                                                    
                                                                                                                         
  ---                                                                                                                    
  Resumen de cambios a implementar                                                                                       
                                  
  ┌─────────────────────────────────────────────┬───────────────────────────────────────┬─────────┐
  │                     Qué                     │                 Dónde                 │ Impacto │                      
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤
  │ agents.isGlobal                             │ DB schema + API + UI                  │ Bajo    │                      
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤
  │ projects.linkedCodePath + linkedRepo        │ DB schema + API + UI settings         │ Bajo    │
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤
  │ agent_project_assignments tabla             │ DB schema + API                       │ Medio   │
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤
  │ Tab "Agentes" en proyecto                   │ project-detail.tsx + componente nuevo │ Medio   │
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤                      
  │ get_project_config tool en MCP              │ mcp-server.ts                         │ Bajo    │
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤                      
  │ tasks.commitHash + notificación enriquecida │ DB schema + mark_task_done + UI       │ Bajo    │
  ├─────────────────────────────────────────────┼───────────────────────────────────────┼─────────┤                      
  │ Agente "Developer" global en DB             │ Seed / script                         │ Bajo    │
  └─────────────────────────────────────────────┴───────────────────────────────────────┴─────────┘                      
                  
  ---                                                                                                                    
  ¿Arrancamos con alguna fase en particular? Recomiendo empezar por Fase 1 (schema + agentes globales) y Fase 2 (tab de
  agentes en proyecto) porque son independientes del flujo de ejecución real y ya dan valor inmediato.   

Plan: App de mensajería nativa — React Native / Expo                                                                   
                                                                                                                         
  Decisión central: Proyecto nuevo, backend compartido                                                                   
                                                                                                                         
  Proyecto React Native nuevo, independiente de Uxuri como repo. Pero el backend vive como extensión de uxuri.mx:        
                                                                                                                         
  App móvil (nuevo repo)  →  https://uxuri.mx/api/v1/mobile/*  →  Neon DB (mismas tablas + nuevas)                       
                                                                                                                         
  Por qué esta separación:
  - La app móvil crece a su propio ritmo sin romper Uxuri                                                                
  - Reutilizas Neon, Pusher, Clerk, Vercel — cero costos adicionales por ahora                                           
  - Cuando agregues agentes/herramientas, ya tienes el canal abierto          
  - El día que quieras separar el backend completamente, solo cambias una URL                                            
                                                                                                                         
  ---                                                                                                                    
  Stack tecnológico                                                                                                      
                                                                                                                         
  ┌──────────────┬───────────────────────────────────────┬───────────────────────────────────────────────────────────┐ 
  │     Capa     │              Tecnología               │                          Por qué                          │   
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Framework          │ Expo SDK 52 (Expo Router)             │ File-based routing idéntico a Next.js App Router —   │  
  │                    │                                       │ tu curva de aprendizaje es casi cero                 │
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤  
  │ Lenguaje           │ TypeScript                            │ Igual que Uxuri                                      │
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤  
  │ Auth               │ @clerk/clerk-expo                     │ Mismo Clerk, mismos usuarios, magic link funciona    │
  │                    │                                       │ perfecto en móvil                                    │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Real-time          │ @pusher/pusher-websocket-react-native │ Ya tienes Pusher, SDK oficial para RN                │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Estado local       │ Zustand                               │ Ligero, simple, perfecto para chat state             │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤  
  │ Estado servidor    │ TanStack Query                        │ Cache, refetch, optimistic updates — crítico para    │
  │                    │                                       │ mensajería                                           │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤  
  │ Listas             │ FlashList (Shopify)                   │ Reemplaza FlatList, 10x más performante en listas    │
  │                    │                                       │ largas de mensajes                                   │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Imágenes           │ expo-image                            │ Caching agresivo, performance nativa                 │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤  
  │ Push               │ expo-notifications + FCM              │ Notificaciones nativas Android + iOS desde el mismo  │
  │                    │                                       │ código                                               │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ Build/Distribución │ EAS Build (Expo)                      │ Genera APK sin Play Store, OTA updates sin           │  
  │                    │                                       │ reinstalar                                           │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤
  │ UI base            │ react-native-reanimated + gestos      │ Animaciones 60fps en el hilo nativo                  │  
  ├────────────────────┼───────────────────────────────────────┼──────────────────────────────────────────────────────┤  
  │ Formularios        │ React Hook Form + Zod                 │ Ya lo conoces de Uxuri                               │
  └────────────────────┴───────────────────────────────────────┴──────────────────────────────────────────────────────┘  
                  
  ---                                                                                                                    
  Estructura del proyecto mobile

  /chat-app (nombre provisional)
  ├── app/                        ← Expo Router (= Next.js App Router)                                                   
  │   ├── (auth)/
  │   │   ├── sign-in.tsx          ← Magic link entry                                                                    
  │   │   └── verify.tsx           ← OTP verification
  │   ├── (app)/                                                                                                         
  │   │   ├── _layout.tsx          ← Bottom tab navigator
  │   │   ├── index.tsx            ← Chats list (home)                                                                   
  │   │   ├── chat/                                                                                                      
  │   │   │   └── [id].tsx         ← Conversación individual
  │   │   ├── contacts.tsx         ← Mis contactos                                                                       
  │   │   ├── search.tsx           ← Buscar usuarios
  │   │   └── profile.tsx          ← Mi perfil                                                                           
  │   └── _layout.tsx              ← Root (ClerkProvider, QueryProvider)                                                 
  ├── components/                                                                                                        
  │   ├── chat/                                                                                                          
  │   │   ├── MessageBubble.tsx                                                                                          
  │   │   ├── MessageList.tsx      ← FlashList wrapper
  │   │   ├── MessageInput.tsx     ← Composer con attach                                                                 
  │   │   └── ConversationItem.tsx ← Item en la lista de chats
  │   ├── contacts/                                                                                                      
  │   └── shared/                                                                                                        
  ├── lib/                                                                                                               
  │   ├── api.ts                   ← fetch wrapper con auth headers                                                      
  │   ├── pusher.ts                ← cliente Pusher RN                                                                   
  │   └── notifications.ts         ← FCM setup
  ├── stores/                                                                                                            
  │   ├── chat.store.ts            ← Zustand: conversaciones activas
  │   └── auth.store.ts                                                                                                  
  ├── hooks/
  │   ├── useMessages.ts           ← TanStack Query wrapper                                                              
  │   └── usePusherChannel.ts      ← Igual que Uxuri pero para RN
  └── constants/                                                                                                         
      └── theme.ts                 ← Colores, tipografía, spacing
                                                                                                                         
  ---             
  Backend: endpoints nuevos en Uxuri                                                                                     
                                    
  Namespace /api/v1/mobile/* dentro del repo de Uxuri. Clerk autentica igual que hoy.
                                                                                                                         
  Auth
    GET  /api/v1/mobile/me                → perfil del usuario autenticado                                               
    PATCH /api/v1/mobile/me               → actualizar username, avatar, bio                                             
                                                                                                                         
  Conversaciones                                                                                                         
    GET  /api/v1/mobile/conversations     → lista con último mensaje + unread count                                      
    POST /api/v1/mobile/conversations     → crear DM o grupo                                                             
    GET  /api/v1/mobile/conversations/[id] → detalle + miembros
                                                                                                                         
  Mensajes        
    GET  /api/v1/mobile/conversations/[id]/messages   → paginados (cursor-based)                                         
    POST /api/v1/mobile/conversations/[id]/messages   → enviar mensaje                                                   
    PATCH /api/v1/mobile/messages/[id]                → editar
    DELETE /api/v1/mobile/messages/[id]               → borrar                                                           
                  
  Contactos                                                                                                              
    GET  /api/v1/mobile/contacts          → mis contactos aceptados
    POST /api/v1/mobile/contacts          → enviar solicitud                                                             
    PATCH /api/v1/mobile/contacts/[id]    → aceptar/rechazar                                                             
    GET  /api/v1/mobile/users/search?q=  → buscar por username                                                           
                                                                                                                         
  Invitaciones    
    POST /api/v1/mobile/invite            → generar link único                                                           
    GET  /api/v1/mobile/invite/[token]    → resolver invitación                                                          
  
  ---                                                                                                                    
  Esquema de DB (tablas nuevas en el mismo Neon)
                                                                                                                         
  mobile_profiles          -- extensión del usuario Clerk para la app
    id, userId (FK→users), username (único), displayName,                                                                
    avatarUrl, bio, phone, lastSeenAt, pushToken                                                                         
                                                                                                                         
  conversations            -- DM + grupos                                                                                
    id, type (dm|group), name, avatarUrl,                                                                                
    createdBy, createdAt                                                                                                 
  
  conversation_members     -- membership                                                                                 
    id, conversationId, userId, role (owner|admin|member),
    joinedAt, lastReadAt, mutedUntil                                                                                     
                  
  messages                 -- el core                                                                                    
    id, conversationId, senderId, content,
    type (text|image|file|system),                                                                                       
    fileUrl, fileName, fileMime, fileSize,
    replyToId (FK→messages, nullable),                                                                                   
    editedAt, deletedAt, createdAt
                                                                                                                         
  contacts                 -- red social futura
    id, userId, contactId,                                                                                               
    status (pending|accepted|blocked),                                                                                   
    createdAt
                                                                                                                         
  invite_tokens            -- invitaciones                                                                               
    id, createdBy, token (único), usedBy,
    expiresAt, usedAt                                                                                                    
                  
  ---                                                                                                                    
  Auth y onboarding
                                                                                                                         
  Flujo para un nuevo usuario (tu hermana):

  1. Tú le mandas: https://uxuri.mx/invite/[token]
     (o el APK + un código)                                                                                              
                                                                                                                         
  2. Ella abre el APK → pantalla de bienvenida                                                                           
                                                                                                                         
  3. Ingresa su email → Clerk envía magic link (un clic, sin contraseña)                                                 
                  
  4. Primera vez: pantalla "Elige tu username + sube foto"                                                               
     → crea mobile_profile
                                                                                                                         
  5. Llega directo a la pantalla de chats
     → ya aparece el DM contigo pre-cargado (si usaste invite link)                                                      
                                                                                                                         
  Sin Google, sin Facebook, sin contraseña que olvidar. El magic link es el método más simple para gente no técnica y    
  tiene el menor abandono.                                                                                               
                                                                                                                         
  ---             
  Real-time y push
                  
  Cuando está en la app (foreground):
  - Pusher private-conversation-{id} channel                                                                             
  - Eventos: message:new, message:edited, message:deleted, typing:start, typing:stop, member:read                        
  - La app actualiza el store de Zustand + TanStack Query cache instantáneamente                                         
                                                                                                                         
  Cuando está en background o cerrada:                                                                                   
  - Servidor envía push via FCM (Android) / APNs (iOS) en cada mensaje nuevo                                             
  - expo-notifications muestra la notificación nativa                                                                    
  - Tap en notificación → abre la app directo en esa conversación                                                        
                                                                                                                         
  ---                                                                                                                    
  Modelo de privacidad y descubrimiento
                                                                                                                         
  Este es el punto más importante arquitectónicamente porque defines hoy cómo va a escalar mañana.
                                                                                                                         
  Principio: Nadie existe para ti hasta que hay una conexión explícita.                                                  
                                                                                                                         
  Puedes ver a alguien si:                                                                                               
    a) Te mandó un invite link y lo aceptaste
    b) Lo buscaste por username exacto y le enviaste solicitud                                                           
    c) Están en el mismo grupo                                                                                           
    d) (Futuro) Tienes su número y él también tiene el tuyo → auto-conecta                                               
                                                                                                                         
  Grupos:                                                                                                                
  - Solo el creador puede invitar (por ahora)                                                                            
  - Invitación via link con expiración                                                                                   
  - Membresía visible solo para miembros del grupo
                                                                                                                         
  Búsqueda:                                                                                                              
  - Solo por username exacto en el PMV (no fuzzy search pública)
  - Esto previene scraping y garantiza privacidad por defecto                                                            
                                                             
  Diseñado para evolución:                                                                                               
  - La tabla contacts con status ya soporta el grafo social completo                                                     
  - Cuando quieras "feed público", solo agregas isPublic en mobile_profiles                                              
  - Los grupos ya son el building block de comunidades futuras                                                           
                                                                                                                         
  ---             
  UI/UX: estructura visual                                                                                               
                                                                                                                         
  Bottom tabs (4):
  💬 Chats    👥 Contactos    🔍 Buscar    👤 Perfil                                                                     
                                                                                                                         
  Pantalla de Chats:
  - Lista estilo WhatsApp: avatar + nombre + último mensaje + timestamp + badge unread                                   
  - Swipe-to-delete (archivar, silenciar)                                                                                
  - FAB (botón flotante) para nuevo chat                                                                                 
                                                                                                                         
  Pantalla de Conversación:
  - Burbujas propias a la derecha (color primario), ajenas a la izquierda (gris)                                         
  - Cabecera: avatar + nombre + "en línea" / "visto hace X"                                                              
  - Input: texto + adjuntar imagen + enviar                
  - Tap en mensaje: reaccionar, responder, copiar, eliminar                                                              
  - Indicador de "escribiendo..."                                                                                        
                                                                                                                         
  Consideraciones psicológicas / UX:                                                                                     
  - El azul profundo #1e3a5f que ya tienes funciona perfecto para una app de mensajería — transmite confianza y          
  privacidad (psicología del color: azul = seguridad, comunicación)                                                      
  - Feedback inmediato: el mensaje aparece en la UI antes de que el servidor confirme (optimistic update) — percepción de
   velocidad instantánea                                                                                                 
  - Ticks de entrega: ✓ enviado, ✓✓ entregado, ✓✓ azul = leído — el usuario necesita saber que su mensaje llegó          
  - Sin algoritmo: los chats ordenados por último mensaje, sin "engagement hacks". Para app familiar, la honestidad
  genera confianza                                                                                                       
                                                                                                                         
  ---                                                                                                                    
  Distribución sin Play Store                                                                                            
                             
  EAS Build (servicio de Expo, gratis hasta cierto límite):
  eas build --platform android --profile preview                                                                         
  → genera .apk descargable desde dashboard de Expo
  → tú descargas el .apk                                                                                                 
  → lo mandas por WhatsApp, Telegram, o lo hosteas en tu propio servidor                                                 
  → familia instala activando "Fuentes desconocidas"                    
                                                                                                                         
  Instrucciones de instalación (una página web simple en uxuri.mx/instalar):                                             
  3 pasos visuales con capturas de pantalla:                                                                             
  1. Toca el archivo .apk                                                                                                
  2. Si aparece advertencia → "Instalar de todas formas"                                                                 
  3. Activa "Permitir de esta fuente" una sola vez      
                                                                                                                         
  OTA Updates (sin reinstalar):                                                                                          
  Con expo-updates, cuando tú publicas cambios de JS (sin cambiar código nativo), la app se actualiza sola en el próximo 
  arranque. Solo hay que reinstalar el APK cuando cambias módulos nativos (raramente).                                   
                  
  iOS (los 2-3 casos):                                                                                                   
  - Opción 1: TestFlight — necesitas Apple Developer ($99/año), pero puedes tener hasta 10,000 testers
  - Opción 2: PWA desde Safari — peor experiencia pero cero costo, cero burocracia                                       
  - Para el PMV: PWA en iOS es suficiente para 2-3 personas                       
                                                                                                                         
  ---                                                                                                                    
  Roadmap por fases                                                                                                      
                                                                                                                         
  Fase 1 — PMV (2–3 semanas)                                                                                             
                  
  - Proyecto Expo configurado                                                                                            
  - Auth con Clerk magic link
  - Onboarding: username + foto                                                                                          
  - DMs funcionales con real-time (Pusher)                                                                               
  - Push notifications (FCM)
  - APK distribuible via link                                                                                            
                  
  Fase 2 — Grupos + Contactos (semana 4–5)                                                                               
                  
  - Sistema de contactos (solicitud/aceptar)                                                                             
  - Grupos: crear, invitar via link, salir
  - Búsqueda por username                                                                                                
  - Editar/eliminar mensajes                                                                                             
  - Reacciones con emojis
                                                                                                                         
  Fase 3 — Media + Pulido (semana 6–7)                                                                                   
  
  - Envío de imágenes (expo-image-picker)                                                                                
  - Envío de archivos
  - Ticks de lectura (✓✓)                                                                                                
  - Indicador "escribiendo..."
  - Silenciar conversaciones                                                                                             
  
  Fase 4 — Herramientas (cuando decidas)                                                                                 
                  
  - Integrar agentes de Uxuri                                                                                            
  - Chat con AI desde la app
  - Recordatorios, tareas                                                                                                
  - Esto es cuando la app se diferencia de WhatsApp
                                                                                                                         
  Fase 5 — Red social (futuro)
                                                                                                                         
  - Perfiles públicos opcionales                                                                                         
  - Comunidades (grupos públicos)
  - Descubrimiento por intereses                                                                                         
  - La tabla contacts ya está diseñada para esto                                                                         
  
  ---                                                                                                                    
  Nombre          
        
  Mientras decides, algunos ejes para pensar:
  - Si va a crecer a red social: algo propio, memorizable, que no sea "uxuri"                                            
  - Si va a ser tu plataforma personal (para clientes y familia): puede llevar tu marca                                  
  - Dato psicológico: las apps de mensajería con nombres cortos (2 sílabas) tienen mayor retención mental — Signal,      
  Slack, Viber, Line, Wire                                                                                               
                                                                                                                         
  ---                                                                                                                    
  ¿Arrancamos con la Fase 1? ¿Tienes alguna duda sobre alguna decisión arquitectónica antes de que empiece a generar el  
  código?   

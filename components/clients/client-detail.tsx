"use client";

import { useState } from "react";
import Link from "next/link";
import type { Client, Project } from "@/db/schema";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Building2, Mail, Phone, FileText, ArrowLeft, Pencil,
  Globe, Calendar, Users, DollarSign,
} from "lucide-react";
import { ShareModal } from "@/components/sharing/share-modal";
import { EntityChatFiles } from "@/components/chat/entity-chat-files";
import { ClientEditModal } from "./client-edit-modal";
import { ContextFeed } from "@/components/context/context-feed";
import { TransactionModal, AccountOption } from "@/components/finances/transaction-modal";

type ClientWithExtra = Client & { website?: string | null; registrationDate?: string | null };

interface ClientDetailProps {
  client: ClientWithExtra;
  projects: Project[];
  currentUserId?: string;
  accounts?: AccountOption[];
}

const statusConfig = {
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  inactive: { label: "Inactivo", className: "bg-slate-100 text-slate-600" },
  prospect: { label: "Prospecto", className: "bg-amber-50 text-amber-700" },
};

const projectStatusConfig = {
  planning: { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Pausado", className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-700" },
};

export function ClientDetail({ client, projects, currentUserId, accounts = [] }: ClientDetailProps) {
  const [showEdit, setShowEdit]       = useState(false);
  const [showShare, setShowShare]     = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const status = statusConfig[client.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/clients"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>
        {accounts.length > 0 && (
          <button
            onClick={() => setShowPayment(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Registrar pago
          </button>
        )}
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          <Users className="w-3.5 h-3.5" />
          Compartir
        </button>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client info */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Información</h2>

          {client.company && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.company}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.phone}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-slate-400 mt-0.5" />
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#1e3a5f] hover:underline truncate"
              >
                {client.website}
              </a>
            </div>
          )}
          {client.registrationDate && (
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">
                Registro: {new Date(client.registrationDate).toLocaleDateString("es-MX")}
              </span>
            </div>
          )}
          {client.notes && (
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.notes}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Cliente desde {formatDate(client.createdAt)}
            </p>
          </div>
        </div>

        {/* Projects */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">
              Proyectos ({projects.length})
            </h2>
            <Link
              href={`/projects/new`}
              className="text-sm text-[#1e3a5f] hover:underline"
            >
              + Nuevo proyecto
            </Link>
          </div>

          {projects.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No hay proyectos asociados a este cliente
            </p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const pStatus = projectStatusConfig[project.status];
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        pStatus.className
                      )}
                    >
                      {pStatus.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Context */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <ContextFeed entityType="client" entityId={client.id} />
      </div>

      {/* Chat & Files */}
      {currentUserId && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <EntityChatFiles
            entityId={client.id}
            entityType="client"
            entityName={client.name}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <ClientEditModal client={client as Client} onClose={() => setShowEdit(false)} />
      )}

      {showShare && (
        <ShareModal
          resourceType="client"
          resourceId={client.id}
          resourceTitle={client.name}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Register payment modal */}
      {showPayment && (
        <TransactionModal
          accounts={accounts}
          clients={[]}
          projects={[]}
          businesses={[]}
          defaultType="income"
          defaultClientId={client.id}
          onClose={() => setShowPayment(false)}
          onSaved={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}

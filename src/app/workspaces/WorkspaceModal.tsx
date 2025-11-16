'use client';

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useRouter } from 'next/navigation';
import {
  IconArrowUpRight,
  IconHierarchy,
  IconSettings,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';
import { closeAlert, showCustomAlert } from '@/lib/alerts';

type WorkspaceIconKey = 'settings' | 'users' | 'truck';

export interface WorkspaceOption {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  highlights: string[];
  href: string;
  icon: WorkspaceIconKey;
}

interface WorkspaceModalProps {
  userName: string;
  workspaces: WorkspaceOption[];
}

const iconMap: Record<WorkspaceIconKey, typeof IconSettings> = {
  settings: IconSettings,
  users: IconUsers,
  truck: IconTruck,
};

interface WorkspaceContentProps extends WorkspaceModalProps {
  onSelect: (href: string) => void;
}

function WorkspaceModalContent({
  userName,
  workspaces,
  onSelect,
}: WorkspaceContentProps) {
  return (
    <div className="workspace-picker">
      <div className="workspace-picker__hero">
        <span className="workspace-picker__kicker">
          <IconHierarchy size={16} /> Welcome back, {userName}
        </span>
        <h2>Choose where to work today</h2>
        <p>
          Select a workspace to continue. Each space bundles the tools,
          dashboards, and automations optimized for that part of your business.
        </p>
      </div>

      <div className="workspace-picker__grid">
        {workspaces.map((workspace) => {
          const Icon = iconMap[workspace.icon];
          return (
            <article key={workspace.id} className="workspace-picker__card">
              <header className="workspace-picker__card-header">
                <Icon size={32} color="#2563eb" />
                <span className="workspace-picker__badge">
                  {workspace.badge}
                </span>
              </header>
              <div className="workspace-picker__card-title">
                <h3>{workspace.title}</h3>
                <span>{workspace.subtitle}</span>
              </div>
              <div className="workspace-picker__highlights">
                {workspace.highlights.map((item) => (
                  <span key={item} className="workspace-picker__pill">
                    {item}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="workspace-picker__cta"
                onClick={() => onSelect(workspace.href)}
              >
                Enter workspace <IconArrowUpRight size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkspaceModal({
  userName,
  workspaces,
}: WorkspaceModalProps) {
  const router = useRouter();

  useEffect(() => {
    let root: Root | null = null;

    if (workspaces.length === 0) {
      void showCustomAlert({
        title: 'No workspaces yet',
        html: `
          <div class="workspace-picker__empty">
            <p>You don\'t have workspace permissions assigned. Please contact a Super Admin to request access.</p>
          </div>
        `,
        icon: 'info',
        confirmButtonText: 'Close',
        customClass: {
          popup: 'swal-popup-custom workspace-swal-popup',
          htmlContainer: 'swal-html-custom workspace-swal-html',
          confirmButton: 'swal-confirm-btn',
        },
      });
      return () => {
        closeAlert();
      };
    }

    void showCustomAlert({
      title: '',
      html: '<div id="workspace-modal-root"></div>',
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: true,
      customClass: {
        popup: 'swal-popup-custom workspace-swal-popup',
        htmlContainer: 'swal-html-custom workspace-swal-html',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn',
      },
      didOpen: (popup) => {
        const mountNode = popup.querySelector('#workspace-modal-root');
        if (!mountNode) {
          return;
        }

        root = createRoot(mountNode as HTMLElement);
        root.render(
          <WorkspaceModalContent
            userName={userName}
            workspaces={workspaces}
            onSelect={(href) => {
              closeAlert();
              router.push(href);
            }}
          />
        );
      },
      willClose: () => {
        root?.unmount();
        root = null;
      },
    });

    return () => {
      root?.unmount();
      closeAlert();
    };
  }, [router, userName, workspaces]);

  return null;
}

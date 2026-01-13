import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface ModalContextType {
  isModalOpen: boolean;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [openModals, setOpenModals] = useState<Set<string>>(new Set());

  const openModal = useCallback((id: string) => {
    setOpenModals(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const closeModal = useCallback((id: string) => {
    setOpenModals(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    isModalOpen: openModals.size > 0,
    openModal,
    closeModal,
  }), [openModals.size, openModal, closeModal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal(modalId?: string) {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }

  const { isModalOpen, openModal, closeModal } = context;

  // Convenience methods when modalId is provided
  const open = useCallback(() => {
    if (modalId) openModal(modalId);
  }, [modalId, openModal]);

  const close = useCallback(() => {
    if (modalId) closeModal(modalId);
  }, [modalId, closeModal]);

  return {
    isModalOpen,
    openModal,
    closeModal,
    open,
    close,
  };
}

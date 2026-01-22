import React, { createContext, useContext } from "react";

interface InkContextValue {
  clearScreen: () => void;
}

const InkContext = createContext<InkContextValue | null>(null);

interface InkProviderProps {
  children: React.ReactNode;
  clearScreen: () => void;
}

export function InkProvider({ children, clearScreen }: InkProviderProps) {
  return (
    <InkContext.Provider value={{ clearScreen }}>
      {children}
    </InkContext.Provider>
  );
}

export function useInk(): InkContextValue {
  const context = useContext(InkContext);
  if (!context) {
    throw new Error("useInk must be used within an InkProvider");
  }
  return context;
}

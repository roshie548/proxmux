import React, { createContext, useContext, useState, useCallback } from "react";

interface EditModeContextValue {
  isEditing: boolean;
  setEditing: (editing: boolean) => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  isEditing: false,
  setEditing: () => {},
});

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);

  const setEditing = useCallback((editing: boolean) => {
    setIsEditing(editing);
  }, []);

  return (
    <EditModeContext.Provider value={{ isEditing, setEditing }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}

import { IconContext } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface IconProviderProps {
  children: ReactNode;
}

export function IconProvider({ children }: IconProviderProps) {
  return (
    <IconContext.Provider value={{ size: 20, weight: "regular" }}>
      {children}
    </IconContext.Provider>
  );
}

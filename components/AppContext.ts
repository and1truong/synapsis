import { createContext } from 'react';

export interface AppContextType {
  globals: Record<string, any>;
}

export const AppContext = createContext<AppContextType>({
  globals: {},
});

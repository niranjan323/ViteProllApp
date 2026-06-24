import React, { createContext, useContext } from 'react';

const UserEmailContext = createContext<string>('');

export function useUserEmail(): string {
    return useContext(UserEmailContext);
}

export const UserEmailProvider = UserEmailContext.Provider;
